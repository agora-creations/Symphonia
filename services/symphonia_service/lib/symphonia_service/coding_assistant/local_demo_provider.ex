defmodule SymphoniaService.CodingAssistant.LocalDemoProvider do
  @moduledoc """
  Deterministic local provider that exercises the Coding Assistant contract.
  """

  @behaviour SymphoniaService.CodingAssistant.Provider

  alias SymphoniaService.CodingAssistant.{BranchManager, FailureClass, HandoffBuilder, RunStore}

  @impl true
  def id, do: "local_demo"

  @impl true
  def label, do: "Local Demo"

  @impl true
  def capabilities do
    %{
      "context_pack" => false,
      "persistent_workspace" => false,
      "streamed_public_steps" => false,
      "change_detection" => false,
      "validation_pipeline" => false,
      "curated_summary" => false,
      "review_branch" => true,
      "handoff" => true,
      "retry_classification" => true
    }
  end

  @impl true
  def readiness(_opts \\ []) do
    %{
      "configured" => true,
      "ready" => false,
      "reason" => "Local demo provider is not runnable by Harness V2."
    }
  end

  @impl true
  def preflight(_repository, _task, _params), do: :ok

  @impl true
  def run(repository, task, run, params) do
    if force_failure?(params) do
      {:error, "The Coding Assistant could not produce a reviewable handoff."}
    else
      RunStore.mark_step(run, "Creating branch")
      file = HandoffBuilder.demo_file(task)
      body = HandoffBuilder.demo_body(task, Map.get(params, "assistant_input"))
      branch = BranchManager.create_and_push_demo_change(repository, task, file, body)
      {:ok, HandoffBuilder.build(task, branch)}
    end
  rescue
    error -> {:error, Exception.message(error)}
  end

  @impl true
  def classify_failure(reason, context), do: FailureClass.classify(reason, context)

  defp force_failure?(params) do
    Map.get(params, "forceFailure") == true or Map.get(params, "force_failure") == true
  end
end
