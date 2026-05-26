defmodule SymphoniaService.LifecycleTest do
  use ExUnit.Case, async: true

  alias SymphoniaService.Lifecycle

  defp task do
    %{
      frontmatter: %{
        "key" => "SYM-120",
        "title" => "Improve repository overview",
        "status" => "in_review",
        "github_sync_enabled" => true,
        "github_issue_state" => "open"
      },
      body: "# Improve repository overview\n"
    }
  end

  test "failed run pauses the task with a fixed reason" do
    updated = Lifecycle.apply_event(task(), "fail_run")

    assert updated.frontmatter["status"] == "paused"
    assert updated.frontmatter["paused_reason"] == "run_failed"
  end

  test "setup blocker pauses the task with setup reason" do
    updated = Lifecycle.apply_event(task(), "fail_run", %{"paused_reason" => "blocked_by_setup"})

    assert updated.frontmatter["status"] == "paused"
    assert updated.frontmatter["paused_reason"] == "blocked_by_setup"
  end

  test "request changes stores original feedback and checklist" do
    feedback =
      "The card is too dense. Remove validation from the default card. Keep retry visible only when paused."

    updated = Lifecycle.apply_event(task(), "request_changes", %{"feedback" => feedback})

    assert updated.frontmatter["status"] == "in_progress"
    assert updated.body =~ "Original feedback:"
    assert updated.body =~ feedback
    assert updated.body =~ "- [ ] Remove validation from the default card"
    assert updated.body =~ "- [ ] Keep retry visible only when paused"
  end

  test "approval only marks the handoff approved and keeps PR publishing gated" do
    updated = Lifecycle.apply_event(task(), "approve", %{"requires_pr" => false})

    assert updated.frontmatter["status"] == "in_review"
    assert updated.frontmatter["review_approved"] == true
    assert updated.frontmatter["review_state"] == "approved"
    assert updated.frontmatter["next_step"] == "open_pull_request"
    refute updated.frontmatter["github_pr"]
  end

  test "merged pull request completes the task and closes linked issue" do
    updated = Lifecycle.apply_event(task(), "merge_pr")

    assert updated.frontmatter["status"] == "completed"
    assert updated.frontmatter["github_pr_state"] == "merged"
    assert updated.frontmatter["github_issue_state"] == "closed"
  end
end
