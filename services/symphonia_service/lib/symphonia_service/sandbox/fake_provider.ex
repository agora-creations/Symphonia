defmodule SymphoniaService.Sandbox.FakeProvider do
  @moduledoc """
  Test and local-development sandbox provider.

  It creates a disposable checkout, produces a deterministic patch bundle, and
  releases the sandbox root. It is intentionally not a real cloud integration.
  """

  @behaviour SymphoniaService.Sandbox.Provider

  alias SymphoniaService.Sandbox.{Result, Session}

  @impl true
  def create(opts) do
    if fail_at?(opts, "create") do
      {:error, "sandbox_create_failed"}
    else
      root = sandbox_root(opts)
      File.mkdir_p!(root)

      sandbox_id = sandbox_id()
      sandbox_root = Path.join(root, sandbox_id)
      File.mkdir_p!(sandbox_root)

      session =
        Session.new("fake_sandbox", %{
          "sandbox_id" => sandbox_id,
          "sandbox_root" => sandbox_root,
          "params" => sandbox_params(opts)
        })

      record_event(opts, "create")
      {:ok, session}
    end
  rescue
    _error -> {:error, "sandbox_create_failed"}
  end

  @impl true
  def prepare(session, repository, assignment) do
    if fail_at?(assignment, "prepare") do
      {:error, "sandbox_prepare_failed"}
    else
      sandbox_root = session["sandbox_root"]
      repo_path = Path.join(sandbox_root, "repo")
      File.mkdir_p!(sandbox_root)

      with :ok <- git(["clone", "--no-hardlinks", repository["path"], repo_path]),
           :ok <- git(["-C", repo_path, "checkout", "--detach", assignment["base_sha"]]) do
        record_event(assignment, "prepare")

        {:ok,
         session
         |> Session.mark("prepared")
         |> Map.merge(%{
           "repo_path" => repo_path,
           "base_branch" => assignment["base_branch"],
           "base_sha" => assignment["base_sha"],
           "repo_key" => assignment["repo_key"]
         })}
      else
        {:error, _reason} -> {:error, "sandbox_prepare_failed"}
      end
    end
  rescue
    _error -> {:error, "sandbox_prepare_failed"}
  end

  @impl true
  def run(session, _context, assignment) do
    if fail_at?(assignment, "run") do
      {:error, "sandbox_run_failed"}
    else
      path = fake_patch_path(assignment)
      body = fake_patch_body(assignment)
      diff = added_file_diff(path, body)

      result =
        Result.completed(
          assignment,
          diff,
          [%{"path" => path, "status" => "added"}],
          public_summary: "Sandbox produced a reviewable patch.",
          public_timeline: [
            %{
              "step" => "running_in_sandbox",
              "message" => "Sandbox completed the Coding Assistant turn."
            }
          ]
        )

      record_event(assignment, "run")
      {:ok, Map.put(result, "sandboxSession", Session.public_context(session))}
    end
  end

  @impl true
  def release(session) do
    if fail_at?(session, "release") do
      {:error, "sandbox_release_failed"}
    else
      session
      |> Map.get("sandbox_root")
      |> remove_sandbox_root()

      record_event(session, "release")
      :ok
    end
  rescue
    _error -> {:error, "sandbox_release_failed"}
  end

  @impl true
  def readiness(_opts) do
    %{
      "ready" => true,
      "reason" => nil,
      "mode" => "manual_only"
    }
  end

  defp fake_patch_path(source) do
    source["fakePatchPath"] || source["fake_patch_path"] ||
      get_in(source, ["params", "fakePatchPath"]) ||
      get_in(source, ["params", "fake_patch_path"]) ||
      "lib/cloud_sandbox_output.ex"
  end

  defp fake_patch_body(source) do
    source["fakePatchBody"] || source["fake_patch_body"] ||
      get_in(source, ["params", "fakePatchBody"]) ||
      get_in(source, ["params", "fake_patch_body"]) ||
      "defmodule CloudSandboxOutput do\nend\n"
  end

  defp added_file_diff(path, body) do
    added_lines =
      body
      |> String.split("\n", trim: false)
      |> Enum.reject(&(&1 == ""))
      |> Enum.map_join("\n", &"+#{&1}")

    line_count = body |> String.split("\n", trim: true) |> length()

    """
    diff --git a/#{path} b/#{path}
    new file mode 100644
    index 0000000..1269488
    --- /dev/null
    +++ b/#{path}
    @@ -0,0 +1,#{line_count} @@
    #{added_lines}
    """
    |> String.trim_leading()
  end

  defp git(args) do
    case System.cmd("git", args, stderr_to_stdout: true) do
      {_output, 0} -> :ok
      {_output, _status} -> {:error, "git_command_failed"}
    end
  rescue
    _error -> {:error, "git_command_failed"}
  end

  defp sandbox_root(opts) do
    opts["sandboxRoot"] || opts["sandbox_root"] ||
      System.get_env("SYMPHONIA_SANDBOXES_ROOT") ||
      Path.join(System.tmp_dir!(), "symphonia-cloud-sandboxes")
  end

  defp remove_sandbox_root(nil), do: :ok

  defp remove_sandbox_root(path) when is_binary(path) do
    if safe_sandbox_path?(path), do: File.rm_rf(path)
    :ok
  end

  defp safe_sandbox_path?(path) do
    expanded = Path.expand(path)

    roots =
      [
        System.get_env("SYMPHONIA_SANDBOXES_ROOT"),
        Path.join(System.tmp_dir!(), "symphonia-cloud-sandboxes")
      ]
      |> Enum.reject(&is_nil/1)
      |> Enum.map(&Path.expand/1)

    Enum.any?(roots, fn root -> expanded == root or String.starts_with?(expanded, root <> "/") end)
  end

  defp fail_at?(source, step) do
    value =
      source["fakeSandboxFailure"] || source["fake_sandbox_failure"] ||
        get_in(source, ["params", "fakeSandboxFailure"]) ||
        get_in(source, ["params", "fake_sandbox_failure"]) ||
        System.get_env("SYMPHONIA_FAKE_SANDBOX_FAILURE")

    value == step
  end

  defp sandbox_params(opts) do
    opts
    |> Map.take([
      "fakeSandboxFailure",
      "fake_sandbox_failure",
      "fakeSandboxEventsPath",
      "fake_sandbox_events_path",
      "fakePatchPath",
      "fake_patch_path",
      "fakePatchBody",
      "fake_patch_body"
    ])
    |> Enum.reject(fn {_key, value} -> is_nil(value) end)
    |> Map.new()
  end

  defp record_event(source, step) do
    path =
      source["fakeSandboxEventsPath"] || source["fake_sandbox_events_path"] ||
        get_in(source, ["params", "fakeSandboxEventsPath"]) ||
        get_in(source, ["params", "fake_sandbox_events_path"]) ||
        System.get_env("SYMPHONIA_FAKE_SANDBOX_EVENTS_PATH")

    if is_binary(path) and path != "" do
      path |> Path.dirname() |> File.mkdir_p!()
      File.write!(path, JSON.encode!(%{"step" => step}) <> "\n", [:append])
    end

    :ok
  rescue
    _error -> :ok
  end

  defp sandbox_id do
    suffix = :crypto.strong_rand_bytes(8) |> Base.url_encode64(padding: false)
    "sandbox_#{System.system_time(:millisecond)}_#{suffix}"
  end
end
