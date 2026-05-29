defmodule SymphoniaService.GitHub.PullRequestsTest do
  use ExUnit.Case

  alias SymphoniaService.{RepositoryRegistry, Workspace}
  alias SymphoniaService.GitHub.{InstallationStore, PullRequests}

  defmodule StubClient do
    def create_installation_token(jwt, installation_id) do
      assert String.split(jwt, ".") |> length() == 3
      assert to_string(installation_id) == "123"

      {:ok,
       %{
         "token" => "installation-token",
         "expires_at" =>
           DateTime.utc_now() |> DateTime.add(3600, :second) |> DateTime.to_iso8601()
       }}
    end

    def get_branch("installation-token", "agora-creations", "symphonia", "task-branch") do
      {:ok, %{"name" => "task-branch"}}
    end

    def get_branch("installation-token", "agora-creations", "symphonia", "missing-branch") do
      {:error, %{"status" => 404, "message" => "Branch not found"}}
    end

    def create_pull_request("installation-token", "agora-creations", "symphonia", payload) do
      assert payload["head"] == "task-branch"
      assert payload["base"] == "main"

      {:ok,
       %{
         "number" => 456,
         "html_url" => "https://github.com/agora-creations/symphonia/pull/456",
         "state" => "open",
         "head" => %{"ref" => "task-branch"},
         "base" => %{"ref" => "main"}
       }}
    end

    def get_pull_request("installation-token", "agora-creations", "symphonia", 456) do
      case Application.get_env(:symphonia_service, :github_pull_request_stub_state, :merged) do
        :open ->
          {:ok,
           %{
             "number" => 456,
             "html_url" => "https://github.com/agora-creations/symphonia/pull/456",
             "state" => "open",
             "merged" => false,
             "head" => %{"ref" => "task-branch"},
             "base" => %{"ref" => "main"}
           }}

        :closed ->
          {:ok,
           %{
             "number" => 456,
             "html_url" => "https://github.com/agora-creations/symphonia/pull/456",
             "state" => "closed",
             "merged" => false,
             "head" => %{"ref" => "task-branch"},
             "base" => %{"ref" => "main"}
           }}

        _ ->
          {:ok,
           %{
             "number" => 456,
             "html_url" => "https://github.com/agora-creations/symphonia/pull/456",
             "state" => "closed",
             "merged" => true,
             "head" => %{"ref" => "task-branch"},
             "base" => %{"ref" => "main"}
           }}
      end
    end

    def update_issue("installation-token", "agora-creations", "symphonia", 123, payload) do
      assert payload == %{"state" => "closed", "state_reason" => "completed"}

      {:ok,
       %{
         "number" => 123,
         "html_url" => "https://github.com/agora-creations/symphonia/issues/123",
         "state" => "closed"
       }}
    end
  end

  setup do
    root =
      Path.join(System.tmp_dir!(), "symphonia-pr-test-#{System.unique_integer([:positive])}")

    repo_path = Path.join(root, "repo")
    registry_path = Path.join(root, "registry.json")
    github_home = Path.join(root, "github")
    private_key_path = Path.join(root, "github-app.pem")
    File.mkdir_p!(Path.join(repo_path, ".git"))
    write_private_key!(private_key_path)

    previous_app_id = System.get_env("SYMPHONIA_GITHUB_APP_ID")
    previous_private_key = System.get_env("SYMPHONIA_GITHUB_APP_PRIVATE_KEY_PATH")
    System.put_env("SYMPHONIA_GITHUB_APP_ID", "42")
    System.put_env("SYMPHONIA_GITHUB_APP_PRIVATE_KEY_PATH", private_key_path)

    Application.put_env(:symphonia_service, :github_client, StubClient)
    Application.put_env(:symphonia_service, :github_home, github_home)

    on_exit(fn ->
      restore_env("SYMPHONIA_GITHUB_APP_ID", previous_app_id)
      restore_env("SYMPHONIA_GITHUB_APP_PRIVATE_KEY_PATH", previous_private_key)
      Application.delete_env(:symphonia_service, :github_client)
      Application.delete_env(:symphonia_service, :github_home)
      Application.delete_env(:symphonia_service, :github_pull_request_stub_state)
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
          "default_branch" => "main"
        }
      ]
    })

    repository =
      RepositoryRegistry.update(registry_path, "SYM", fn repo ->
        Map.put(repo, "github", %{
          "owner" => "agora-creations",
          "name" => "symphonia",
          "url" => "https://github.com/agora-creations/symphonia",
          "default_branch" => "main",
          "installation_id" => 123,
          "auth_mode" => "app_installation"
        })
      end)

    %{root: root, repo_path: repo_path, repository: repository}
  end

  test "opens a pull request from an approved task with a pushed head branch", %{
    repo_path: repo_path,
    repository: repository
  } do
    write_task(repo_path, "task-branch")

    task = PullRequests.open_from_task(repository, "SYM-1")

    assert task["status"] == "in_review"
    assert task["githubPrState"] == "open"
    assert task["githubPr"] == "https://github.com/agora-creations/symphonia/pull/456"
    assert task["reviewApproved"] == true
    assert File.read!(Path.join([repo_path, "symphonia", "tasks", "SYM-1.md"])) =~ "github:"

    assert File.read!(Path.join([repo_path, "symphonia", "tasks", "SYM-1.md"])) =~
             "head_branch: task-branch"
  end

  test "opening a pull request requires an in-review task", %{
    repo_path: repo_path,
    repository: repository
  } do
    write_task(repo_path, "task-branch", true, status: "todo")

    assert_raise ArgumentError, "A task must be in review before opening a pull request.", fn ->
      PullRequests.open_from_task(repository, "SYM-1")
    end

    task_markdown = File.read!(Path.join([repo_path, "symphonia", "tasks", "SYM-1.md"]))
    refute task_markdown =~ "html_url"
    refute task_markdown =~ "https://github.com/agora-creations/symphonia/pull/456"
  end

  test "opening a pull request requires a handoff", %{
    repo_path: repo_path,
    repository: repository
  } do
    write_task(repo_path, "task-branch", true, handoff: false)

    assert_raise ArgumentError, "No review handoff exists for this task.", fn ->
      PullRequests.open_from_task(repository, "SYM-1")
    end
  end

  test "returns a plain error when the head branch is missing on GitHub", %{
    repo_path: repo_path,
    repository: repository
  } do
    write_task(repo_path, "missing-branch")

    assert_raise ArgumentError, PullRequests.push_branch_error(), fn ->
      PullRequests.open_from_task(repository, "SYM-1")
    end
  end

  test "opening a pull request requires a review branch in the handoff", %{
    repo_path: repo_path,
    repository: repository
  } do
    write_task(repo_path, nil)

    assert_raise ArgumentError, "No review branch was found for this handoff.", fn ->
      PullRequests.open_from_task(repository, "SYM-1")
    end
  end

  test "opening a pull request is approval-gated", %{
    repo_path: repo_path,
    repository: repository
  } do
    write_task(repo_path, "task-branch", false)

    assert_raise ArgumentError, "Approve the handoff before opening a pull request.", fn ->
      PullRequests.open_from_task(repository, "SYM-1")
    end
  end

  test "opening a pull request requires a linked GitHub repository", %{
    repo_path: repo_path,
    repository: repository
  } do
    write_task(repo_path, "task-branch")
    unlinked_repository = Map.delete(repository, "github")

    assert_raise ArgumentError,
                 "Link this local repository to GitHub before opening a pull request.",
                 fn ->
                   PullRequests.open_from_task(unlinked_repository, "SYM-1")
                 end
  end

  test "refreshing an open pull request keeps the task in review", %{
    repo_path: repo_path,
    repository: repository
  } do
    Application.put_env(:symphonia_service, :github_pull_request_stub_state, :open)
    write_task(repo_path, "task-branch")
    PullRequests.open_from_task(repository, "SYM-1")

    result = PullRequests.refresh_with_result(repository, "SYM-1")
    task = result["task"]

    assert task["status"] == "in_review"
    assert task["githubPrState"] == "open"
    assert result["refreshResult"]["state"] == "open"
    assert result["refreshResult"]["message"] == "Pull request is still open."
  end

  test "merged pull request completes task and closes linked issue", %{
    repo_path: repo_path,
    repository: repository
  } do
    write_task(repo_path, "task-branch")
    PullRequests.open_from_task(repository, "SYM-1")

    task = PullRequests.refresh(repository, "SYM-1")

    assert task["status"] == "completed"
    assert task["githubPrState"] == "merged"
    assert task["githubIssueState"] == "closed"
    assert task["body"] =~ "Pull request merged."
    assert task["body"] =~ "Task completed."
    assert task["body"] =~ "Linked GitHub issue closed automatically."
  end

  test "closed unmerged pull request stays in review with clear next action", %{
    repo_path: repo_path,
    repository: repository
  } do
    Application.put_env(:symphonia_service, :github_pull_request_stub_state, :closed)
    write_task(repo_path, "task-branch")
    PullRequests.open_from_task(repository, "SYM-1")

    result = PullRequests.refresh_with_result(repository, "SYM-1")
    task = result["task"]

    assert task["status"] == "in_review"
    assert task["githubPrState"] == "closed"

    assert task["nextReviewAction"] ==
             "Pull request was closed without merge. Task remains in review."

    refute task["body"] =~ "Task completed."
    assert result["refreshResult"]["state"] == "closed"

    assert result["refreshResult"]["message"] ==
             "Pull request was closed without merge. Task remains in review."
  end

  test "GitHub credentials are never written to repository files", %{
    repo_path: repo_path,
    root: root,
    repository: repository
  } do
    write_task(repo_path, "task-branch")
    PullRequests.open_from_task(repository, "SYM-1")

    task_markdown = File.read!(Path.join([repo_path, "symphonia", "tasks", "SYM-1.md"]))
    registry = File.read!(Path.join(root, "registry.json"))

    for forbidden <- [
          "private_key",
          "access_token",
          "refresh_token",
          "installation_token",
          "client_secret",
          "installation-token"
        ] do
      refute task_markdown =~ forbidden
      refute registry =~ forbidden
    end
  end

  defp write_task(repo_path, head_branch, approved \\ true, opts \\ []) do
    status = Keyword.get(opts, :status, "in_review")
    handoff? = Keyword.get(opts, :handoff, true)

    handoff =
      if handoff? do
        """
        handoff:
          summary: Approved handoff.
          files_changed:
            - app/page.tsx
          next_review_action: Approve or request changes.
        #{if head_branch, do: "  head_branch: #{head_branch}\n", else: ""}  base_branch: main
          curated_summary_path: symphonia/run-summaries/SYM-1.md
        """
      else
        ""
      end

    File.write!(Path.join([repo_path, "symphonia", "tasks", "SYM-1.md"]), """
    ---
    key: SYM-1
    title: GitHub PR task
    status: #{status}
    priority: high
    review_approved: #{approved}
    review_state: #{if(approved, do: "approved", else: "changes_requested")}
    files_changed:
      - app/page.tsx
    #{handoff}
    github:
      issue:
        owner: agora-creations
        repo: symphonia
        number: 123
        url: https://github.com/agora-creations/symphonia/issues/123
        state: open
      pull_request:
        base_branch: main
    ---

    # GitHub PR task

    Approved handoff.
    """)
  end

  defp write_private_key!(path) do
    key = :public_key.generate_key({:rsa, 1024, 65_537})
    entry = :public_key.pem_entry_encode(:RSAPrivateKey, key)
    File.write!(path, :public_key.pem_encode([entry]))
  end

  defp restore_env(key, nil), do: System.delete_env(key)
  defp restore_env(key, value), do: System.put_env(key, value)
end
