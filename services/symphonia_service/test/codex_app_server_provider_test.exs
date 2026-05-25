defmodule SymphoniaService.CodexAppServerProviderTest do
  use ExUnit.Case

  alias SymphoniaService.Clarise.{MilestoneLoop, PlanToTaskCompiler}
  alias SymphoniaService.CodingAssistant.{AppServerClient, RunStore}
  alias SymphoniaService.GitHub.InstallationStore
  alias SymphoniaService.Harness.{Automation, Daemon, Eligibility}
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
        "symphonia-codex-app-server-provider-#{System.unique_integer([:positive])}"
      )

    File.mkdir_p!(root)
    private_key_path = Path.join(root, "github-app.pem")
    write_private_key!(private_key_path)

    %{remote_path: remote_path, repo_path: repo_path} = setup_git!(root)

    registry_path = Path.join(root, "registry.json")
    github_home = Path.join(root, "github")
    runs_root = Path.join(root, "runs")
    workspaces_root = Path.join(root, "workspaces")
    fake_app_server = Path.join(root, "fake-app-server.js")
    requests_file = Path.join(root, "app-server-requests.json")

    write_fake_app_server!(fake_app_server)

    previous_app_id = System.get_env("SYMPHONIA_GITHUB_APP_ID")
    previous_private_key = System.get_env("SYMPHONIA_GITHUB_APP_PRIVATE_KEY_PATH")
    previous_runs_root = System.get_env("SYMPHONIA_RUNS_ROOT")
    previous_workspaces_root = System.get_env("SYMPHONIA_WORKSPACES_ROOT")
    previous_skip_daemon = System.get_env("SYMPHONIA_CODEX_APP_SERVER_SKIP_DAEMON")
    previous_app_server_command = System.get_env("SYMPHONIA_CODEX_APP_SERVER_COMMAND")
    previous_requests_file = System.get_env("FAKE_APP_SERVER_REQUESTS_FILE")
    previous_fake_mode = System.get_env("FAKE_APP_SERVER_MODE")
    previous_output_suffix = System.get_env("FAKE_APP_SERVER_OUTPUT_SUFFIX")

    System.put_env("SYMPHONIA_GITHUB_APP_ID", "42")
    System.put_env("SYMPHONIA_GITHUB_APP_PRIVATE_KEY_PATH", private_key_path)
    System.put_env("SYMPHONIA_RUNS_ROOT", runs_root)
    System.put_env("SYMPHONIA_WORKSPACES_ROOT", workspaces_root)
    System.put_env("SYMPHONIA_CODEX_APP_SERVER_SKIP_DAEMON", "true")
    System.put_env("SYMPHONIA_CODEX_APP_SERVER_COMMAND", fake_app_server)
    System.put_env("FAKE_APP_SERVER_REQUESTS_FILE", requests_file)

    Application.put_env(:symphonia_service, :github_client, StubClient)
    Application.put_env(:symphonia_service, :github_home, github_home)

    on_exit(fn ->
      restore_env("SYMPHONIA_GITHUB_APP_ID", previous_app_id)
      restore_env("SYMPHONIA_GITHUB_APP_PRIVATE_KEY_PATH", previous_private_key)
      restore_env("SYMPHONIA_RUNS_ROOT", previous_runs_root)
      restore_env("SYMPHONIA_WORKSPACES_ROOT", previous_workspaces_root)
      restore_env("SYMPHONIA_CODEX_APP_SERVER_SKIP_DAEMON", previous_skip_daemon)
      restore_env("SYMPHONIA_CODEX_APP_SERVER_COMMAND", previous_app_server_command)
      restore_env("FAKE_APP_SERVER_REQUESTS_FILE", previous_requests_file)
      restore_env("FAKE_APP_SERVER_MODE", previous_fake_mode)
      restore_env("FAKE_APP_SERVER_OUTPUT_SUFFIX", previous_output_suffix)
      Application.delete_env(:symphonia_service, :github_client)
      Application.delete_env(:symphonia_service, :github_home)
      File.rm_rf(root)
    end)

    repository = RepositoryRegistry.add(registry_path, %{"path" => repo_path, "key" => "SYM"})
    Workspace.initialize(repository)

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

    milestone = approved_milestone(repository)
    PlanToTaskCompiler.propose(repository, milestone["id"])
    PlanToTaskCompiler.create_tasks(registry_path, repository, milestone["id"])
    repository = Automation.enable(registry_path, "SYM")

    %{
      registry_path: registry_path,
      fake_app_server: fake_app_server,
      remote_path: remote_path,
      repository: repository,
      requests_file: requests_file,
      runs_root: runs_root,
      workspaces_root: workspaces_root
    }
  end

  test "daemon dispatches an eligible task through fake Codex App Server", %{
    registry_path: registry_path,
    remote_path: remote_path,
    repository: repository,
    requests_file: requests_file,
    runs_root: runs_root,
    workspaces_root: workspaces_root
  } do
    name = :"harness_daemon_test_#{System.unique_integer([:positive])}"
    {:ok, _pid} = Daemon.start_link(registry_path: registry_path, timer?: false, name: name)

    result = Daemon.tick(name)

    assert [%{"code" => "dispatched", "dispatched" => true} | _rest] = result["decisions"]
    second_result = Daemon.tick(name)
    refute Enum.any?(second_result["decisions"], &(&1["task"] == "SYM-1" and &1["dispatched"]))

    [task | _rest] = TaskStore.list_tasks(repository)
    run = wait_for_latest_run(runs_root, "completed")
    task = wait_for_task_status(repository, task["key"], "in_review")

    assert run["provider"] == "codex_app_server"
    assert run["workspace_path"] == Path.join([workspaces_root, "sym", "sym-1"])
    assert run["codex_thread_id"] == "thread-fake"
    assert run["turn_id"] == "turn-fake"
    assert run["curated_summary_path"] =~ "symphonia/run-summaries/sym-1-"
    assert run["provider_output"]["app_server_events"] != []
    assert task["handoff"]["curatedSummaryPath"] == run["curated_summary_path"]
    assert "app/app-server-output.txt" in task["handoff"]["filesChanged"]
    assert run["curated_summary_path"] in task["handoff"]["filesChanged"]

    branch_files =
      git_output!([
        "--git-dir",
        remote_path,
        "ls-tree",
        "-r",
        "--name-only",
        "refs/heads/symphonia/task/sym-1"
      ])

    assert branch_files =~ "app/app-server-output.txt"
    assert branch_files =~ run["curated_summary_path"]
    refute branch_files =~ "symphonia/tasks/SYM-1.md"

    summary =
      git_output!([
        "--git-dir",
        remote_path,
        "show",
        "refs/heads/symphonia/task/sym-1:#{run["curated_summary_path"]}"
      ])

    assert summary =~ "Raw app-server events remain in the local Symphonía run store."
    refute summary =~ "turn/completed"

    requests = JSON.decode!(File.read!(requests_file))
    assert Enum.any?(requests, &(&1["method"] == "thread/start"))
    assert Enum.any?(requests, &(&1["method"] == "turn/start"))

    turn_start = Enum.find(requests, &(&1["method"] == "turn/start"))
    assert turn_start["params"]["approvalPolicy"] == "never"
    assert turn_start["params"]["cwd"] == run["workspace_path"]

    review_blocked_task =
      TaskStore.patch_task(repository, task["key"], %{
        "frontmatter" => %{
          "depends_on" => [],
          "handoff" => %{},
          "run" => %{"state" => "completed"},
          "status" => "todo"
        }
      })

    review_branch_explanation = Eligibility.explain(repository, review_blocked_task)
    assert review_branch_explanation["eligible"] == false
    assert review_branch_explanation["code"] == "review_branch_exists"
  end

  test "client resumes existing app-server threads", %{
    requests_file: requests_file,
    workspaces_root: workspaces_root
  } do
    workspace_path = Path.join(workspaces_root, "direct-resume")
    File.mkdir_p!(workspace_path)

    assert {:ok, output} =
             AppServerClient.run_turn(workspace_path, "Resume this thread.",
               thread_id: "thread-existing"
             )

    assert output["thread_id"] == "thread-existing"
    assert output["turn_id"] == "turn-fake"

    requests = JSON.decode!(File.read!(requests_file))
    assert Enum.any?(requests, &(&1["method"] == "thread/resume"))
    refute Enum.any?(requests, &(&1["method"] == "thread/start"))
  end

  test "client returns bounded errors for failed, interrupted, and malformed turns", %{
    workspaces_root: workspaces_root
  } do
    cases = [
      {"failed", "Fake turn failure."},
      {"interrupted", "status interrupted"},
      {"malformed_json", ""}
    ]

    for {mode, expected} <- cases do
      System.put_env("FAKE_APP_SERVER_MODE", mode)
      workspace_path = Path.join(workspaces_root, "direct-#{mode}")
      File.mkdir_p!(workspace_path)

      assert {:error, reason, events} =
               AppServerClient.run_turn(workspace_path, "Exercise #{mode}.", timeout_ms: 500)

      assert is_binary(reason)
      assert String.trim(reason) != ""
      assert is_list(events)

      if expected != "" do
        assert reason =~ expected
      end
    end
  end

  test "persistent workspace is reused after a failed run retry", %{
    registry_path: registry_path,
    repository: repository,
    runs_root: runs_root
  } do
    [task | _rest] = TaskStore.list_tasks(repository)

    System.put_env("FAKE_APP_SERVER_MODE", "failed")

    first_result =
      CodingAssistant.start_harness_run(registry_path, repository, task["key"], %{
        "eligibility_reason" => "Task is eligible for daemon dispatch."
      })

    failed_run = wait_for_run(runs_root, first_result["run"]["id"], "failed")
    failed_task = wait_for_task_status(repository, task["key"], "paused")

    assert failed_task["pausedReason"] == "run_failed"
    assert failed_run["workspace_path"] =~ Path.join(["sym", "sym-1"])

    System.delete_env("FAKE_APP_SERVER_MODE")
    System.put_env("FAKE_APP_SERVER_OUTPUT_SUFFIX", " retry")

    retry_result =
      CodingAssistant.start_harness_run(registry_path, repository, task["key"], %{
        "eligibility_reason" => "Retry after failure."
      })

    completed_run = wait_for_run(runs_root, retry_result["run"]["id"], "completed")
    wait_for_task_status(repository, task["key"], "in_review")

    assert completed_run["workspace_path"] == failed_run["workspace_path"]

    assert File.read!(Path.join(completed_run["workspace_path"], "app/app-server-output.txt")) =~
             "retry"
  end

  test "completed app-server turn with no committable changes pauses the task", %{
    registry_path: registry_path,
    repository: repository,
    runs_root: runs_root
  } do
    [task | _rest] = TaskStore.list_tasks(repository)
    System.put_env("FAKE_APP_SERVER_MODE", "no_change")

    result =
      CodingAssistant.start_harness_run(registry_path, repository, task["key"], %{
        "eligibility_reason" => "Task is eligible for daemon dispatch."
      })

    run = wait_for_run(runs_root, result["run"]["id"], "failed")
    task = wait_for_task_status(repository, task["key"], "paused")

    assert run["provider_output"]["app_server_events"] != []
    assert run["provider_output"]["change_detection"]["committable"] == []
    assert task["pausedReason"] == "run_failed"

    assert task["pausedExplanation"] ==
             "The Coding Assistant did not produce any files that can be reviewed."
  end

  test "persistent workspace and Codex thread are reused for request-changes continuation", %{
    registry_path: registry_path,
    repository: repository,
    requests_file: requests_file,
    runs_root: runs_root
  } do
    [task | _rest] = TaskStore.list_tasks(repository)

    initial_result =
      CodingAssistant.start_harness_run(registry_path, repository, task["key"], %{
        "eligibility_reason" => "Task is eligible for daemon dispatch."
      })

    initial_run = wait_for_run(runs_root, initial_result["run"]["id"], "completed")
    wait_for_task_status(repository, task["key"], "in_review")

    assert initial_run["codex_thread_id"] == "thread-fake"

    System.put_env("FAKE_APP_SERVER_OUTPUT_SUFFIX", " continuation")

    continuation_result =
      CodingAssistant.continue_from_review_notes(registry_path, repository, task["key"], %{
        "feedback" => "Please update the generated file for continuation coverage."
      })

    continuation_run = wait_for_run(runs_root, continuation_result["run"]["id"], "completed")
    continued_task = wait_for_task_status(repository, task["key"], "in_review")

    assert continuation_run["workspace_path"] == initial_run["workspace_path"]
    assert continuation_run["codex_thread_id"] == initial_run["codex_thread_id"]

    assert File.read!(Path.join(continuation_run["workspace_path"], "app/app-server-output.txt")) =~
             "continuation"

    assert continued_task["body"] =~ "Review notes"

    requests = JSON.decode!(File.read!(requests_file))
    assert Enum.any?(requests, &(&1["method"] == "thread/resume"))
    refute Enum.any?(requests, &(&1["method"] == "thread/start"))
  end

  defp approved_milestone(repository) do
    milestone =
      MilestoneLoop.start(repository, %{"title" => "Codex App Server harness"})["milestone"]

    milestone =
      MilestoneLoop.discuss(repository, milestone["id"], %{
        "title" => "Codex App Server harness",
        "goal" => "Run approved milestone tasks through a persistent Codex App Server workspace.",
        "answers" => %{
          "accomplish" => "Dispatch eligible tasks to Codex App Server.",
          "why" => "Execution should happen through Symphonía.",
          "include" => "Daemon dispatch, app-server provider, summary artifacts.",
          "exclude" => "Opening pull requests automatically.",
          "complete" => "A branch contains code changes and a curated summary.",
          "codebase" => "Harness daemon and provider modules.",
          "risks" => "Raw logs must stay local."
        }
      })["milestone"]

    milestone = MilestoneLoop.requirements(repository, milestone["id"])["milestone"]
    milestone = MilestoneLoop.plan(repository, milestone["id"])["milestone"]
    MilestoneLoop.approve(repository, milestone["id"])["milestone"]
  end

  defp wait_for_latest_run(runs_root, state, attempts \\ 80) do
    run =
      runs_root
      |> Path.join("run_*.json")
      |> Path.wildcard()
      |> Enum.map(&JSON.decode!(File.read!(&1)))
      |> Enum.max_by(& &1["created_at"], fn -> nil end)

    if run && run["state"] == state do
      run
    else
      if attempts <= 0 do
        flunk("run did not reach #{state}; last state: #{inspect(run && run["state"])}")
      end

      Process.sleep(50)
      wait_for_latest_run(runs_root, state, attempts - 1)
    end
  end

  defp wait_for_run(runs_root, run_id, state, attempts \\ 80) do
    run = RunStore.get(run_id, root: runs_root)

    if run && run["state"] == state do
      run
    else
      if attempts <= 0 do
        flunk("run #{run_id} did not reach #{state}; last state: #{inspect(run && run["state"])}")
      end

      Process.sleep(50)
      wait_for_run(runs_root, run_id, state, attempts - 1)
    end
  end

  defp wait_for_task_status(repository, task_key, status, attempts \\ 80) do
    task = TaskStore.get_task(repository, task_key)

    if task && task["status"] == status do
      task
    else
      if attempts <= 0 do
        flunk(
          "task #{task_key} did not reach #{status}; last status: #{inspect(task && task["status"])}"
        )
      end

      Process.sleep(50)
      wait_for_task_status(repository, task_key, status, attempts - 1)
    end
  end

  defp write_fake_app_server!(path) do
    File.write!(path, """
    #!/usr/bin/env node
    const fs = require("fs");
    const readline = require("readline");
    const requestsFile = process.env.FAKE_APP_SERVER_REQUESTS_FILE;
    const mode = process.env.FAKE_APP_SERVER_MODE || "success";
    const outputSuffix = process.env.FAKE_APP_SERVER_OUTPUT_SUFFIX || "";
    const requests = [];

    function save() {
      fs.writeFileSync(requestsFile, JSON.stringify(requests, null, 2));
    }

    function send(message) {
      process.stdout.write(JSON.stringify(message) + "\\n");
    }

    readline.createInterface({ input: process.stdin }).on("line", (line) => {
      const message = JSON.parse(line);
      requests.push(message);
      save();

      if (message.method === "initialize") {
        send({ jsonrpc: "2.0", id: message.id, result: { codexHome: "/tmp/codex-home", platformFamily: "unix", platformOs: "macos", userAgent: "fake" } });
      } else if (message.method === "thread/start") {
        send({ jsonrpc: "2.0", id: message.id, result: { thread: { id: "thread-fake" }, cwd: message.params.cwd, approvalPolicy: "never", approvalsReviewer: "auto_review", model: "fake", modelProvider: "fake", sandbox: "workspace-write" } });
      } else if (message.method === "thread/resume") {
        send({ jsonrpc: "2.0", id: message.id, result: { thread: { id: message.params.threadId } } });
      } else if (message.method === "turn/start") {
        const cwd = message.params.cwd;
        const threadId = message.params.threadId || "thread-fake";
        if (mode !== "no_change") {
          fs.mkdirSync(cwd + "/app", { recursive: true });
          fs.writeFileSync(cwd + "/app/app-server-output.txt", "Fake App Server work product" + outputSuffix + "\\n");
        }
        send({ jsonrpc: "2.0", id: message.id, result: { turn: { id: "turn-fake", status: "running" } } });
        if (mode === "malformed_json") {
          process.stdout.write("{malformed-json\\n");
          return;
        }
        send({ jsonrpc: "2.0", method: "agent/message/delta", params: { threadId, turnId: "turn-fake", text: "Fake App Server changed app/app-server-output.txt." } });
        if (mode === "failed") {
          send({ jsonrpc: "2.0", method: "turn/completed", params: { threadId, turn: { id: "turn-fake", status: "failed", error: "Fake turn failure." } } });
        } else if (mode === "interrupted") {
          send({ jsonrpc: "2.0", method: "turn/completed", params: { threadId, turn: { id: "turn-fake", status: "interrupted" } } });
        } else {
          send({ jsonrpc: "2.0", method: "turn/completed", params: { threadId, turn: { id: "turn-fake", status: "completed" } } });
        }
      }
    });
    """)

    File.chmod(path, 0o700)
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
