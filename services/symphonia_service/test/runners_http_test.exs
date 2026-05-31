defmodule SymphoniaService.RunnersHTTPTest do
  use ExUnit.Case

  alias SymphoniaService.Access.AuditLog
  alias SymphoniaService.CodingAssistant.RunStore
  alias SymphoniaService.Secrets.ReferenceStore, as: SecretReferences
  alias SymphoniaService.{HTTPServer, RepositoryRegistry, TaskStore, Workspace}

  defmodule MockOpenSandboxClient do
    def create(_config, _body), do: {:ok, %{"id" => "sandbox_http_mock", "status" => %{"state" => "Running"}}}
    def get(_config, sandbox_id), do: {:ok, %{"id" => sandbox_id, "status" => %{"state" => "Running"}}}

    def endpoint(_config, _sandbox_id, _port) do
      {:ok, %{"url" => "http://execd.example.invalid", "headers" => %{"X-EXECD-ACCESS-TOKEN" => "exec-token"}}}
    end

    def upload_file(_execd, _path, _content), do: :ok
    def run_command(_execd, _command, _opts), do: {:ok, "completed"}

    def download_file(_execd, _path) do
      {:ok,
       JSON.encode!(%{
         "status" => "completed",
         "patchBundle" => %{
           "format" => "git_diff",
           "encoding" => "utf8",
           "diff" => """
           diff --git a/lib/opensandbox_http_smoke.ex b/lib/opensandbox_http_smoke.ex
           new file mode 100644
           index 0000000..1269488
           --- /dev/null
           +++ b/lib/opensandbox_http_smoke.ex
           @@ -0,0 +1,2 @@
           +defmodule OpenSandboxHTTPSmoke do
           +end
           """
         },
         "changedFiles" => [%{"path" => "lib/opensandbox_http_smoke.ex", "status" => "added"}]
       })}
    end

    def delete(_config, _sandbox_id), do: :ok
  end

  setup do
    root =
      Path.join(System.tmp_dir!(), "symphonia-runners-http-#{System.unique_integer([:positive])}")

    repo_path = Path.join(root, "repo")
    registry_path = Path.join(root, "repositories.json")
    runs_root = Path.join(root, "runs")
    File.mkdir_p!(Path.join(repo_path, ".git"))

    previous_runs_root = System.get_env("SYMPHONIA_RUNS_ROOT")
    previous_opensandbox_endpoint = System.get_env("SYMPHONIA_OPENSANDBOX_ENDPOINT")
    previous_opensandbox_api_key = System.get_env("SYMPHONIA_OPENSANDBOX_API_KEY")
    System.put_env("SYMPHONIA_RUNS_ROOT", runs_root)

    repository = RepositoryRegistry.add(registry_path, %{"path" => repo_path, "key" => "SYM"})
    Workspace.initialize(repository)
    task = TaskStore.create_task(registry_path, repository, %{"title" => "Remote runner task"})

    port = free_port()

    {:ok, pid} =
      HTTPServer.start_link(
        port: port,
        registry_path: registry_path,
        name: :"runners_http_#{System.unique_integer([:positive])}"
      )

    on_exit(fn ->
      if Process.alive?(pid), do: GenServer.stop(pid)
      restore_env("SYMPHONIA_RUNS_ROOT", previous_runs_root)
      restore_env("SYMPHONIA_OPENSANDBOX_ENDPOINT", previous_opensandbox_endpoint)
      restore_env("SYMPHONIA_OPENSANDBOX_API_KEY", previous_opensandbox_api_key)
      Application.delete_env(:symphonia_service, :opensandbox_client)
      File.rm_rf(root)
    end)

    %{port: port, registry_path: registry_path, repository: repository, task: task}
  end

  test "runner routes enforce permissions and never serialize tokens", %{
    port: port,
    registry_path: registry_path
  } do
    assert http_json(port, "GET", "/api/runners", "", [{"x-symphonia-role", "viewer"}]).status ==
             200

    denied =
      http_json(
        port,
        "POST",
        "/api/runners/pairing-tokens",
        pairing_body(),
        [{"x-symphonia-role", "viewer"}]
      )

    assert denied.status == 403

    pairing =
      http_json(
        port,
        "POST",
        "/api/runners/pairing-tokens",
        pairing_body(),
        [{"x-symphonia-role", "owner"}]
      )

    assert pairing.status == 201
    pairing_token = pairing.body["pairingToken"]
    assert pairing_token =~ "sym_pair_"

    registered =
      http_json(
        port,
        "POST",
        "/api/runners/register",
        registration_body(pairing_token),
        []
      )

    assert registered.status == 201
    runner = registered.body["runner"]
    runner_token = registered.body["runnerToken"]
    assert runner["mode"] == "remote_runner"
    assert runner["trustState"] == "pending"
    assert runner_token =~ "sym_runner_"
    refute JSON.encode!(runner) =~ "local-dev-token"
    refute JSON.encode!(runner) =~ runner_token
    refute JSON.encode!(runner) =~ pairing_token

    bad_heartbeat =
      http_json(
        port,
        "POST",
        "/api/runners/#{runner["id"]}/heartbeat",
        ~s({"token":"wrong"}),
        []
      )

    assert bad_heartbeat.status == 403

    heartbeat =
      http_json(
        port,
        "POST",
        "/api/runners/#{runner["id"]}/heartbeat",
        JSON.encode!(%{
          "token" => runner_token,
          "currentRuns" => 0,
          "capabilities" => %{"codexAppServer" => true, "validation" => true}
        }),
        []
      )

    assert heartbeat.status == 200
    assert heartbeat.body["runner"]["status"] == "online"

    bad_claim =
      http_json(
        port,
        "POST",
        "/api/runners/#{runner["id"]}/assignments/claim",
        ~s({"token":"wrong"}),
        []
      )

    assert bad_claim.status == 403
    assert bad_claim.body["reasonCode"] == "invalid_runner_token"

    pairing_claim =
      http_json(
        port,
        "POST",
        "/api/runners/#{runner["id"]}/assignments/claim",
        JSON.encode!(%{"token" => pairing_token}),
        []
      )

    assert pairing_claim.status == 403
    assert pairing_claim.body["reasonCode"] == "invalid_runner_token"

    empty_claim =
      http_json(
        port,
        "POST",
        "/api/runners/#{runner["id"]}/assignments/claim",
        JSON.encode!(%{"token" => runner_token}),
        []
      )

    assert empty_claim.status == 200
    assert empty_claim.body["assignment"] == nil

    disabled =
      http_json(
        port,
        "POST",
        "/api/runners/#{runner["id"]}/disable",
        "",
        [{"x-symphonia-role", "owner"}]
      )

    assert disabled.status == 200
    assert disabled.body["runner"]["status"] == "disabled"

    enabled =
      http_json(
        port,
        "POST",
        "/api/runners/#{runner["id"]}/enable",
        "",
        [{"x-symphonia-role", "owner"}]
      )

    assert enabled.status == 200

    actions =
      registry_path
      |> AuditLog.list(%{"key" => "GLOBAL"}, limit: :all)
      |> Enum.map(& &1["action"])

    assert "runner.pairing_token_created" in actions
    assert "runner.paired" in actions
    assert "runner.disabled" in actions
    assert "runner.enabled" in actions
  end

  test "manual remote runner selection is rejected before a run starts", %{
    port: port,
    registry_path: registry_path,
    task: task
  } do
    registered = register_runner!(port, %{"localGitWorktree" => true})

    runner_id = registered.body["runner"]["id"]

    rejected =
      http_json(
        port,
        "POST",
        "/api/repositories/SYM/tasks/#{task["key"]}/coding-assistant/runs",
        JSON.encode!(%{"runnerId" => runner_id}),
        [{"x-symphonia-role", "maintainer"}]
      )

    assert rejected.status == 403
    assert rejected.body["reasonCode"] == "runner_not_trusted"
    assert RunStore.list() == []

    assert [%{"action" => "runner.selection_denied"} | _rest] =
             AuditLog.list(registry_path, %{"key" => "SYM"}, limit: :all)
  end

  test "sandbox policy route is permission gated and audited", %{
    port: port,
    registry_path: registry_path
  } do
    default =
      http_json(
        port,
        "GET",
        "/api/repositories/SYM/sandbox-policy",
        "",
        [{"x-symphonia-role", "viewer"}]
      )

    assert default.status == 200
    refute default.body["policy"]["sandboxExecutionAllowed"]

    denied =
      http_json(
        port,
        "POST",
        "/api/repositories/SYM/sandbox-policy",
        JSON.encode!(%{"sandboxExecutionAllowed" => true, "sandboxProvider" => "fake_sandbox"}),
        [{"x-symphonia-role", "maintainer"}]
      )

    assert denied.status == 403

    enabled =
      http_json(
        port,
        "POST",
        "/api/repositories/SYM/sandbox-policy",
        JSON.encode!(%{"sandboxExecutionAllowed" => true, "sandboxProvider" => "fake_sandbox"}),
        [{"x-symphonia-role", "owner"}]
      )

    assert enabled.status == 200
    assert enabled.body["policy"]["sandboxExecutionAllowed"]
    assert enabled.body["policy"]["sandboxProvider"] == "fake_sandbox"

    actions =
      registry_path
      |> AuditLog.list(%{"key" => "SYM"}, limit: :all)
      |> Enum.map(& &1["action"])

    assert "sandbox.policy_enabled" in actions
  end

  test "opensandbox smoke route is owner gated and sanitized", %{
    port: port,
    registry_path: registry_path,
    repository: repository
  } do
    Application.put_env(:symphonia_service, :opensandbox_client, MockOpenSandboxClient)
    System.put_env("SYMPHONIA_OPENSANDBOX_ENDPOINT", "http://opensandbox.example.invalid")
    System.put_env("SYMPHONIA_OPENSANDBOX_API_KEY", "opensandbox-secret-value")

    {:ok, _reference} =
      SecretReferences.create(registry_path, repository, %{
        "label" => "OpenSandbox API key",
        "scope" => "sandbox.provider",
        "source" => "environment",
        "envName" => "SYMPHONIA_OPENSANDBOX_API_KEY"
      })

    denied =
      http_json(
        port,
        "POST",
        "/api/repositories/SYM/sandbox/opensandbox/smoke",
        "{}",
        [{"x-symphonia-role", "maintainer"}]
      )

    assert denied.status == 403

    smoke =
      http_json(
        port,
        "POST",
        "/api/repositories/SYM/sandbox/opensandbox/smoke",
        "{}",
        [{"x-symphonia-role", "owner"}]
      )

    assert smoke.status == 200
    assert smoke.body["smoke"]["status"] == "passed"
    assert smoke.body["smoke"]["workspaceMode"] == "source_bundle"
    refute JSON.encode!(smoke.body) =~ "sandbox_http_mock"
    refute JSON.encode!(smoke.body) =~ "exec-token"
    refute JSON.encode!(smoke.body) =~ "opensandbox-secret-value"
    refute JSON.encode!(smoke.body) =~ "diff --git"

    audit = JSON.encode!(AuditLog.list(registry_path, %{"key" => "SYM"}, limit: :all))
    assert audit =~ "sandbox.opensandbox_smoke_started"
    assert audit =~ "sandbox.opensandbox_smoke_completed"
    refute audit =~ "sandbox_http_mock"
    refute audit =~ "exec-token"
    refute audit =~ "opensandbox-secret-value"
    refute audit =~ "diff --git"
  end

  defp register_runner!(port, extra_capabilities) do
    pairing =
      http_json(
        port,
        "POST",
        "/api/runners/pairing-tokens",
        pairing_body(),
        [{"x-symphonia-role", "owner"}]
      )

    assert pairing.status == 201

    registered =
      http_json(
        port,
        "POST",
        "/api/runners/register",
        registration_body(pairing.body["pairingToken"], extra_capabilities),
        []
      )

    assert registered.status == 201
    registered
  end

  defp pairing_body do
    JSON.encode!(%{
      "name" => "runner-mac-mini",
      "expiresInMinutes" => 15,
      "capabilityHint" => %{"codexAppServer" => true, "validation" => true}
    })
  end

  defp registration_body(pairing_token, extra_capabilities \\ %{}) do
    JSON.encode!(%{
      "name" => "runner-mac-mini",
      "pairingToken" => pairing_token,
      "capabilities" =>
        Map.merge(
          %{
            "codexAppServer" => true,
            "localGitWorktree" => false,
            "experimentalSandbox" => false,
            "validation" => true
          },
          extra_capabilities
        ),
      "limits" => %{"maxConcurrentRuns" => 1}
    })
  end

  defp http_json(port, method, path, body, headers) do
    {:ok, socket} = :gen_tcp.connect(~c"localhost", port, [:binary, active: false], 5_000)

    header_lines =
      [{"host", "localhost"}, {"content-length", byte_size(body)} | headers]
      |> Enum.map(fn {key, value} -> "#{key}: #{value}\r\n" end)
      |> Enum.join()

    :ok = :gen_tcp.send(socket, "#{method} #{path} HTTP/1.1\r\n#{header_lines}\r\n#{body}")
    {:ok, raw} = :gen_tcp.recv(socket, 0, 5_000)
    :gen_tcp.close(socket)

    [head, response_body] = String.split(raw, "\r\n\r\n", parts: 2)
    [status_line | _headers] = String.split(head, "\r\n")
    ["HTTP/1.1", status, reason] = String.split(status_line, " ", parts: 3)

    %{
      status: String.to_integer(status),
      reason: reason,
      body: if(response_body == "", do: %{}, else: JSON.decode!(response_body))
    }
  end

  defp free_port do
    {:ok, socket} = :gen_tcp.listen(0, [:binary, active: false])
    {:ok, {_address, port}} = :inet.sockname(socket)
    :gen_tcp.close(socket)
    port
  end

  defp restore_env(key, nil), do: System.delete_env(key)
  defp restore_env(key, value), do: System.put_env(key, value)
end
