defmodule SymphoniaService.HarnessEligibilityTest do
  use ExUnit.Case

  alias SymphoniaService.Clarise.{MilestoneLoop, PlanToTaskCompiler}
  alias SymphoniaService.CodingAssistant.RunStore
  alias SymphoniaService.Harness.{Automation, Eligibility}
  alias SymphoniaService.{RepositoryRegistry, TaskStore, Workspace}

  setup do
    root =
      Path.join(
        System.tmp_dir!(),
        "symphonia-harness-eligibility-#{System.unique_integer([:positive])}"
      )

    repo_path = Path.join(root, "repo")
    registry_path = Path.join(root, "registry.json")
    runs_root = Path.join(root, "runs")
    File.mkdir_p!(Path.join(repo_path, ".git"))

    previous_runs_root = System.get_env("SYMPHONIA_RUNS_ROOT")
    System.put_env("SYMPHONIA_RUNS_ROOT", runs_root)

    on_exit(fn ->
      restore_env("SYMPHONIA_RUNS_ROOT", previous_runs_root)
      File.rm_rf(root)
    end)

    repository = RepositoryRegistry.add(registry_path, %{"path" => repo_path, "key" => "SYM"})
    Workspace.initialize(repository)

    repository =
      RepositoryRegistry.update(registry_path, "SYM", fn repo ->
        Map.put(repo, "github", %{
          "owner" => "agora-creations",
          "name" => "symphonia",
          "clone_url" => Path.join(root, "remote.git"),
          "default_branch" => "main"
        })
      end)

    milestone = approved_milestone(repository)
    PlanToTaskCompiler.propose(repository, milestone["id"])
    PlanToTaskCompiler.create_tasks(registry_path, repository, milestone["id"])
    repository = Automation.enable(registry_path, "SYM")

    %{
      registry_path: registry_path,
      repository: repository
    }
  end

  test "explains eligible Clarise tasks and incomplete dependencies", %{repository: repository} do
    [first, second | _rest] = TaskStore.list_tasks(repository)

    first_explanation = Eligibility.explain(repository, first)
    assert first_explanation["eligible"] == true
    assert first_explanation["code"] == "eligible"

    second_explanation = Eligibility.explain(repository, second)
    assert second_explanation["eligible"] == false
    assert second_explanation["code"] == "dependencies_incomplete"
    assert second_explanation["reason"] =~ first["key"]
  end

  test "requires repository automation opt-in", %{
    registry_path: registry_path,
    repository: repository
  } do
    repository = Automation.disable(registry_path, repository["key"])
    [task | _rest] = TaskStore.list_tasks(repository)

    explanation = Eligibility.explain(repository, task)
    assert explanation["eligible"] == false
    assert explanation["code"] == "automation_disabled"
  end

  test "requires Clarise generated tasks from approved milestones", %{
    registry_path: registry_path,
    repository: repository
  } do
    manual_task = TaskStore.create_task(registry_path, repository, %{"title" => "Manual task"})

    manual_explanation = Eligibility.explain(repository, manual_task)
    assert manual_explanation["eligible"] == false
    assert manual_explanation["code"] == "not_clarise_generated"

    [generated_task | _rest] = TaskStore.list_tasks(repository)
    unapproved = MilestoneLoop.start(repository, %{"title" => "Not approved"})["milestone"]

    generated_task =
      TaskStore.patch_task(repository, generated_task["key"], %{
        "frontmatter" => %{
          "depends_on" => [],
          "source_milestone" => unapproved["id"],
          "generated_by" => "clarise_plan_to_task"
        }
      })

    unapproved_explanation = Eligibility.explain(repository, generated_task)
    assert unapproved_explanation["eligible"] == false
    assert unapproved_explanation["code"] == "source_milestone_not_approved"
  end

  test "rejects tasks with active runs or pending handoffs", %{repository: repository} do
    [active_run_task, handoff_task | _rest] = TaskStore.list_tasks(repository)

    RunStore.create(%{
      "repository" => repository["key"],
      "task" => active_run_task["key"],
      "provider" => "codex_app_server"
    })

    active_run_explanation = Eligibility.explain(repository, active_run_task)
    assert active_run_explanation["eligible"] == false
    assert active_run_explanation["code"] == "active_run_exists"

    handoff_task =
      TaskStore.patch_task(repository, handoff_task["key"], %{
        "frontmatter" => %{
          "depends_on" => [],
          "handoff" => %{"summary" => "Pending review"}
        }
      })

    handoff_explanation = Eligibility.explain(repository, handoff_task)
    assert handoff_explanation["eligible"] == false
    assert handoff_explanation["code"] == "handoff_exists"
  end

  test "dependency completion makes the next generated task eligible", %{repository: repository} do
    [first, second | _rest] = TaskStore.list_tasks(repository)

    TaskStore.patch_task(repository, first["key"], %{
      "frontmatter" => %{"status" => "completed"}
    })

    second = TaskStore.get_task(repository, second["key"])

    explanation = Eligibility.explain(repository, second)
    assert explanation["eligible"] == true
  end

  defp approved_milestone(repository) do
    milestone =
      MilestoneLoop.start(repository, %{"title" => "Harness eligibility"})["milestone"]

    milestone =
      MilestoneLoop.discuss(repository, milestone["id"], %{
        "title" => "Harness eligibility",
        "goal" => "Dispatch approved milestone tasks through the daemon.",
        "answers" => %{
          "accomplish" => "Find eligible generated tasks.",
          "why" => "The daemon needs deterministic dispatch rules.",
          "include" => "Approval, dependencies, runs, and handoff checks.",
          "exclude" => "No external PR creation.",
          "complete" => "Eligible tasks explain why they can run.",
          "codebase" => "Harness service modules.",
          "risks" => "Duplicate dispatch."
        }
      })["milestone"]

    milestone = MilestoneLoop.requirements(repository, milestone["id"])["milestone"]
    milestone = MilestoneLoop.plan(repository, milestone["id"])["milestone"]
    MilestoneLoop.approve(repository, milestone["id"])["milestone"]
  end

  defp restore_env(key, nil), do: System.delete_env(key)
  defp restore_env(key, value), do: System.put_env(key, value)
end
