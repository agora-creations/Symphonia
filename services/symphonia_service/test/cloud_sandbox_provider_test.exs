defmodule SymphoniaService.CloudSandboxProviderTest do
  use ExUnit.Case

  alias SymphoniaService.Access.AuditLog
  alias SymphoniaService.CodingAssistant.RunStore
  alias SymphoniaService.GitHub.InstallationStore
  alias SymphoniaService.Runners.AssignmentStore
  alias SymphoniaService.Sandbox.Policy, as: SandboxPolicy
  alias SymphoniaService.{CodingAssistant, RepositoryRegistry, TaskStore, Workspace}

  defmodule StubClient do
    def create_installation_token(_jwt, _installation_id) do
      {:ok,
       %{
         "token" => "installation-token",
         "expires_at" =>
           DateTime.utc_now() |> DateTime.add(3600, :second) |> DateTime.to_iso8601()
       }}
    end
  end

  setup do
    root =
      Path.join(
        System.tmp_dir!(),
        "symphonia-cloud-sandbox-#{System.unique_integer([:positive])}"
      )

    File.mkdir_p!(root)

    private_key_path = Path.join(root, "github-app.pem")
    write_private_key!(private_key_path)

    %{remote_path: remote_path, repo_path: repo_path} = setup_git!(root)

    registry_path = Path.join(root, "repositories.json")
    runs_root = Path.join(root, "runs")
    workspaces_root = Path.join(root, "workspaces")
    sandboxes_root = Path.join(root, "sandboxes")
    github_home = Path.join(root, "github")

    previous_app_id = System.get_env("SYMPHONIA_GITHUB_APP_ID")
    previous_private_key = System.get_env("SYMPHONIA_GITHUB_APP_PRIVATE_KEY_PATH")
    previous_runs_root = System.get_env("SYMPHONIA_RUNS_ROOT")
    previous_workspaces_root = System.get_env("SYMPHONIA_WORKSPACES_ROOT")
    previous_sandboxes_root = System.get_env("SYMPHONIA_SANDBOXES_ROOT")

    System.put_env("SYMPHONIA_GITHUB_APP_ID", "42")
    System.put_env("SYMPHONIA_GITHUB_APP_PRIVATE_KEY_PATH", private_key_path)
    System.put_env("SYMPHONIA_RUNS_ROOT", runs_root)
    System.put_env("SYMPHONIA_WORKSPACES_ROOT", workspaces_root)
    System.put_env("SYMPHONIA_SANDBOXES_ROOT", sandboxes_root)

    Application.put_env(:symphonia_service, :github_client, StubClient)
    Application.put_env(:symphonia_service, :github_home, github_home)

    on_exit(fn ->
      restore_env("SYMPHONIA_GITHUB_APP_ID", previous_app_id)
      restore_env("SYMPHONIA_GITHUB_APP_PRIVATE_KEY_PATH", previous_private_key)
      restore_env("SYMPHONIA_RUNS_ROOT", previous_runs_root)
      restore_env("SYMPHONIA_WORKSPACES_ROOT", previous_workspaces_root)
      restore_env("SYMPHONIA_SANDBOXES_ROOT", previous_sandboxes_root)
      Application.delete_env(:symphonia_service, :github_client)
      Application.delete_env(:symphonia_service, :github_home)
      File.rm_rf(root)
    end)

    repository = RepositoryRegistry.add(registry_path, %{"path" => repo_path, "key" => "SYM"})
    Workspace.initialize(repository)
    Workspace.create_workflow_from_template(repository, "review-first")

    InstallationStore.upsert_installation(%{
      "id" => 123,
      "account" => %{"login" => "agora-creations", "type" => "Organization"},
      "repositories" => [
        %{
          "owner" => "agora-creations",
          "name" => "symphonia",
          "repo_id" => 99,
          "url" => "https://github.com/agora-creations/symphonia",
          "clone_url" => remote_path,
          "default_branch" => "main"
        }
      ]
    })

    repository =
      RepositoryRegistry.update(registry_path, "SYM", fn repo ->
        Map.put(repo, "github", %{
          "owner" => "agora-creations",
          "name" => "symphonia",
          "repo_id" => 99,
          "url" => "https://github.com/agora-creations/symphonia",
          "clone_url" => remote_path,
          "default_branch" => "main",
          "installation_id" => 123,
          "auth_mode" => "app_installation"
        })
      end)

    %{
      root: root,
      registry_path: registry_path,
      remote_path: remote_path,
      repository: repository
    }
  end

  test "manual cloud sandbox run imports through the patch importer and releases", %{
    root: root,
    registry_path: registry_path,
    remote_path: remote_path
  } do
    repository = enable_sandbox(registry_path)
    task = create_task(registry_path, repository, "Cloud sandbox success")
    events_path = Path.join(root, "sandbox-events.jsonl")

    result =
      start_sandbox_run(registry_path, repository, task, %{
        "fakeSandboxEventsPath" => events_path
      })

    completed_task = wait_for_task(repository, task["key"], "in_review")
    assignment = AssignmentStore.get(registry_path, result["assignment"]["id"])

    assert assignment["state"] == "completed"
    assert completed_task["run"]["executionMode"] == "cloud_sandbox"
    assert completed_task["run"]["workspaceProvider"] == "cloud_sandbox"
    assert completed_task["handoff"]["summary"] == "Sandbox produced a reviewable patch."
    assert "lib/cloud_sandbox_output.ex" in completed_task["handoff"]["filesChanged"]

    branch_files =
      git_output!([
        "--git-dir",
        remote_path,
        "ls-tree",
        "-r",
        "--name-only",
        "refs/heads/symphonia/task/#{String.downcase(task["key"])}"
      ])

    assert branch_files =~ "lib/cloud_sandbox_output.ex"
    assert branch_files =~ completed_task["handoff"]["curatedSummaryPath"]

    events = wait_for_event_steps(events_path, ["create", "prepare", "run", "release"])
    assert Enum.map(events, & &1["step"]) == ["create", "prepare", "run", "release"]

    run = RunStore.get(result["run"]["id"])
    public_run = JSON.encode!(RunStore.public(run))
    refute Regex.match?(~r/sandbox_\d/, public_run)
    refute public_run =~ "diff --git"

    actions = audit_actions(registry_path)
    assert "sandbox.run_selected" in actions
    assert "sandbox.create_started" in actions
    assert "sandbox.prepare_completed" in actions
    assert "sandbox.result_received" in actions
    assert "sandbox.release_completed" in actions
  end

  test "release failure is a cleanup warning and does not block review", %{
    registry_path: registry_path,
    repository: _repository
  } do
    repository = enable_sandbox(registry_path)
    task = create_task(registry_path, repository, "Cloud sandbox cleanup warning")

    result =
      start_sandbox_run(registry_path, repository, task, %{
        "fakeSandboxFailure" => "release"
      })

    completed_task = wait_for_task(repository, task["key"], "in_review")
    assignment = AssignmentStore.get(registry_path, result["assignment"]["id"])

    assert assignment["state"] == "completed"
    assert completed_task["run"]["cleanupWarning"]["code"] == "sandbox_release_failed"
    assert completed_task["run"]["cleanupWarning"]["message"] == "Sandbox cleanup needs attention."

    actions = audit_actions(registry_path)
    assert "sandbox.release_failed" in actions

    encoded = JSON.encode!(completed_task["run"])
    refute Regex.match?(~r/sandbox_\d/, encoded)
    refute encoded =~ "diff --git"
  end

  test "release is attempted after prepare failure", %{
    root: root,
    registry_path: registry_path
  } do
    repository = enable_sandbox(registry_path)
    task = create_task(registry_path, repository, "Cloud sandbox prepare failure")
    events_path = Path.join(root, "sandbox-prepare-failure.jsonl")

    result =
      start_sandbox_run(registry_path, repository, task, %{
        "fakeSandboxFailure" => "prepare",
        "fakeSandboxEventsPath" => events_path
      })

    failed_task = wait_for_task(repository, task["key"], "paused")
    assignment = AssignmentStore.get(registry_path, result["assignment"]["id"])

    assert assignment["state"] == "failed"
    assert failed_task["pausedReason"] == "run_failed"
    events = wait_for_event_steps(events_path, ["create", "release"])
    assert Enum.map(events, & &1["step"]) == ["create", "release"]
  end

  test "release is attempted after run and import failures", %{
    root: root,
    registry_path: registry_path
  } do
    repository = enable_sandbox(registry_path)

    run_failure_task = create_task(registry_path, repository, "Cloud sandbox run failure")
    run_failure_events = Path.join(root, "sandbox-run-failure.jsonl")

    run_failure =
      start_sandbox_run(registry_path, repository, run_failure_task, %{
        "fakeSandboxFailure" => "run",
        "fakeSandboxEventsPath" => run_failure_events
      })

    wait_for_task(repository, run_failure_task["key"], "paused")
    assert AssignmentStore.get(registry_path, run_failure["assignment"]["id"])["state"] == "failed"
    assert Enum.map(wait_for_event_steps(run_failure_events, ["create", "prepare", "release"]), & &1["step"]) ==
             ["create", "prepare", "release"]

    import_failure_task = create_task(registry_path, repository, "Cloud sandbox import failure")
    import_failure_events = Path.join(root, "sandbox-import-failure.jsonl")

    import_failure =
      start_sandbox_run(registry_path, repository, import_failure_task, %{
        "fakePatchPath" => "symphonia/tasks/SYM-1.md",
        "fakeSandboxEventsPath" => import_failure_events
      })

    wait_for_task(repository, import_failure_task["key"], "paused")
    assert AssignmentStore.get(registry_path, import_failure["assignment"]["id"])["state"] == "failed"

    events = wait_for_event_steps(import_failure_events, ["create", "prepare", "run", "release"])
    assert Enum.map(events, & &1["step"]) == ["create", "prepare", "run", "release"]
  end

  test "sandbox policy is default off and requires explicit run flag", %{
    registry_path: registry_path,
    repository: repository
  } do
    task = create_task(registry_path, repository, "Cloud sandbox policy")
    actor = %{"id" => "maintainer", "name" => "Maintainer", "role" => "maintainer"}

    refute SandboxPolicy.public(repository)["sandboxExecutionAllowed"]

    assert {:error, {403, %{"reasonCode" => "sandbox_execution_disabled"}}} =
             SandboxPolicy.authorize_run(registry_path, repository, actor, task, %{
               "executionMode" => "cloud_sandbox"
             })
  end

  defp enable_sandbox(registry_path) do
    SandboxPolicy.set(registry_path, "SYM", %{
      "sandboxExecutionAllowed" => true,
      "sandboxProvider" => "fake_sandbox"
    })

    SymphoniaService.Runners.RepositoryPolicy.update_policy(registry_path, "SYM", %{
      "allowedSandboxProviders" => ["fake_sandbox"]
    })
  end

  defp create_task(registry_path, repository, title) do
    TaskStore.create_task(registry_path, repository, %{
      "title" => title,
      "body" => "Create a sandbox fixture file."
    })
  end

  defp start_sandbox_run(registry_path, repository, task, params) do
    CodingAssistant.start_run(
      registry_path,
      repository,
      task["key"],
      Map.merge(
        %{
          "executionMode" => "cloud_sandbox",
          "allowSandboxExecution" => true,
          "actor" => %{"id" => "maintainer", "name" => "Maintainer", "role" => "maintainer"}
        },
        params
      )
    )
  end

  defp wait_for_task(repository, task_key, status, attempts \\ 100)

  defp wait_for_task(repository, task_key, status, attempts) when attempts > 0 do
    task = TaskStore.get_task(repository, task_key)

    if task["status"] == status do
      task
    else
      Process.sleep(50)
      wait_for_task(repository, task_key, status, attempts - 1)
    end
  end

  defp wait_for_task(repository, task_key, status, 0) do
    flunk("task #{task_key} did not reach #{status}: #{inspect(TaskStore.get_task(repository, task_key))}")
  end

  defp sandbox_events(path) do
    path
    |> File.read!()
    |> String.split("\n", trim: true)
    |> Enum.map(&JSON.decode!/1)
  end

  defp wait_for_event_steps(path, expected_steps, attempts \\ 100)

  defp wait_for_event_steps(path, expected_steps, attempts) when attempts > 0 do
    events = if File.exists?(path), do: sandbox_events(path), else: []
    steps = Enum.map(events, & &1["step"])

    if steps == expected_steps do
      events
    else
      Process.sleep(50)
      wait_for_event_steps(path, expected_steps, attempts - 1)
    end
  end

  defp wait_for_event_steps(path, expected_steps, 0) do
    events = if File.exists?(path), do: sandbox_events(path), else: []
    flunk("sandbox events did not reach #{inspect(expected_steps)}: #{inspect(events)}")
  end

  defp audit_actions(registry_path) do
    registry_path
    |> AuditLog.list(%{"key" => "SYM"}, limit: :all)
    |> Enum.map(& &1["action"])
  end

  defp setup_git!(root) do
    remote_path = Path.join(root, "remote.git")
    seed_path = Path.join(root, "seed")
    repo_path = Path.join(root, "repo")

    git_output!(["init", "--bare", remote_path])
    File.mkdir_p!(seed_path)
    git_output!(["-C", seed_path, "init"])
    File.write!(Path.join(seed_path, "README.md"), "# Symphonia test repo\n")
    git_output!(["-C", seed_path, "add", "README.md"])

    git_output!([
      "-C",
      seed_path,
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.invalid",
      "commit",
      "-m",
      "Initial commit"
    ])

    git_output!(["-C", seed_path, "branch", "-M", "main"])
    git_output!(["-C", seed_path, "remote", "add", "origin", remote_path])
    git_output!(["-C", seed_path, "push", "origin", "main"])
    git_output!(["--git-dir", remote_path, "symbolic-ref", "HEAD", "refs/heads/main"])
    git_output!(["clone", remote_path, repo_path])

    %{remote_path: remote_path, repo_path: repo_path}
  end

  defp git_output!(args) do
    case System.cmd("git", args, stderr_to_stdout: true) do
      {output, 0} -> output
      {output, _status} -> flunk("git #{Enum.join(args, " ")} failed:\n#{output}")
    end
  end

  defp write_private_key!(path) do
    key = :public_key.generate_key({:rsa, 1024, 65_537})
    entry = :public_key.pem_entry_encode(:RSAPrivateKey, key)
    File.write!(path, :public_key.pem_encode([entry]))
  end

  defp restore_env(key, nil), do: System.delete_env(key)
  defp restore_env(key, value), do: System.put_env(key, value)
end
