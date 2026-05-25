defmodule SymphoniaService.Harness.Eligibility do
  @moduledoc """
  Deterministic eligibility checks for the always-on task harness.
  """

  alias SymphoniaService.{SpecWorkspace, TaskStore}
  alias SymphoniaService.CodingAssistant.{BranchManager, RunEvents, RunStore}
  alias SymphoniaService.Harness.Automation

  @generated_by "clarise_plan_to_task"

  def explain(repository, task) when is_map(repository) and is_map(task) do
    checks = [
      automation_check(repository),
      github_check(repository),
      status_check(task),
      source_check(repository, task),
      dependency_check(repository, task),
      active_run_check(repository, task),
      handoff_check(task),
      review_branch_check(repository, task)
    ]

    eligible? = Enum.all?(checks, & &1["ok"])
    first_failure = Enum.find(checks, &(!&1["ok"]))

    %{
      "eligible" => eligible?,
      "code" => if(eligible?, do: "eligible", else: first_failure["code"]),
      "reason" =>
        if(eligible?,
          do: "Task is eligible for daemon dispatch.",
          else: first_failure["message"]
        ),
      "checks" => checks
    }
  end

  def explain(repository, task_key) when is_binary(task_key) do
    case TaskStore.get_task(repository, task_key) do
      nil ->
        %{
          "eligible" => false,
          "code" => "task_not_found",
          "reason" => "Task #{task_key} was not found.",
          "checks" => []
        }

      task ->
        explain(repository, task)
    end
  end

  def eligible?(repository, task), do: explain(repository, task)["eligible"] == true

  defp automation_check(repository) do
    if Automation.enabled?(repository) do
      ok("automation_enabled", "Repository automation is enabled.")
    else
      fail("automation_disabled", "Repository automation is disabled.")
    end
  end

  defp github_check(repository) do
    case repository["github"] do
      %{"owner" => owner, "name" => name} when is_binary(owner) and is_binary(name) ->
        ok("github_linked", "Repository is linked to GitHub.")

      _ ->
        fail("github_not_linked", "Repository must be linked to GitHub before daemon dispatch.")
    end
  end

  defp status_check(%{"status" => "todo"}) do
    ok("status_todo", "Task is To-do.")
  end

  defp status_check(task) do
    fail(
      "status_not_todo",
      "Task status must be todo; current status is #{task["status"] || "unknown"}."
    )
  end

  defp source_check(repository, task) do
    source_milestone = task["sourceMilestone"] || get_in(task, [:frontmatter, "source_milestone"])
    generated_by = task["generatedBy"] || get_in(task, [:frontmatter, "generated_by"])

    cond do
      generated_by != @generated_by ->
        fail("not_clarise_generated", "Task was not generated from a Clarise milestone plan.")

      blank?(source_milestone) ->
        fail("missing_source_milestone", "Task is missing source milestone metadata.")

      approved_milestone?(repository, source_milestone) ->
        ok("approved_milestone", "Source milestone #{source_milestone} is approved.")

      true ->
        fail(
          "source_milestone_not_approved",
          "Source milestone #{source_milestone} is not approved."
        )
    end
  end

  defp dependency_check(repository, task) do
    dependencies = List.wrap(task["dependsOn"] || get_in(task, [:frontmatter, "depends_on"]))

    incomplete =
      dependencies
      |> Enum.reject(&blank?/1)
      |> Enum.reject(fn dependency_key ->
        case TaskStore.get_task(repository, dependency_key) do
          %{"status" => "completed"} -> true
          _ -> false
        end
      end)

    if incomplete == [] do
      ok("dependencies_complete", "Task dependencies are complete.")
    else
      fail(
        "dependencies_incomplete",
        "Task dependencies are not complete: #{Enum.join(incomplete, ", ")}."
      )
    end
  end

  defp active_run_check(repository, task) do
    active? =
      public_run_active?(task["run"]) ||
        Enum.any?(RunStore.list(), fn run ->
          run["repository"] == repository["key"] and run["task"] == task["key"] and
            RunEvents.active?(run)
        end)

    if active? do
      fail("active_run_exists", "Task already has an active Coding Assistant run.")
    else
      ok("no_active_run", "Task has no active Coding Assistant run.")
    end
  end

  defp handoff_check(task) do
    handoff = task["handoff"] || get_in(task, [:frontmatter, "handoff"])

    if is_map(handoff) and map_size(handoff) > 0 do
      fail("handoff_exists", "Task already has a pending review handoff.")
    else
      ok("no_handoff", "Task has no pending review handoff.")
    end
  end

  defp review_branch_check(repository, task) do
    if BranchManager.review_branch_exists?(repository, task) do
      fail("review_branch_exists", "Task already has a review branch.")
    else
      ok("no_review_branch", "Task has no review branch.")
    end
  rescue
    _error -> ok("review_branch_not_confirmed", "No review branch was found.")
  end

  defp approved_milestone?(repository, source_milestone) do
    case SpecWorkspace.read_artifact(repository, "milestone", source_milestone) do
      %{"status" => "approved"} -> true
      %{"metadata" => %{"status" => "approved"}} -> true
      _ -> false
    end
  rescue
    _ -> false
  end

  defp public_run_active?(%{"state" => state}), do: state in RunEvents.active_states()
  defp public_run_active?(_run), do: false

  defp ok(code, message), do: %{"ok" => true, "code" => code, "message" => message}
  defp fail(code, message), do: %{"ok" => false, "code" => code, "message" => message}
  defp blank?(value), do: is_nil(value) or (is_binary(value) and String.trim(value) == "")
end
