defmodule SymphoniaService.CodingAssistant.Cancellation do
  @moduledoc """
  Cancel active Coding Assistant runs without canceling the task.
  """

  alias SymphoniaService.CodingAssistant.{RunEvents, RunRegistry, RunStore, RunWorker}
  alias SymphoniaService.Runners.Assignments

  def cancel(
        run_id,
        registry_path \\ SymphoniaService.default_registry_path(),
        repository \\ nil,
        task_key \\ nil
      )
      when is_binary(run_id) do
    case RunRegistry.lookup(run_id) do
      {:ok, pid} ->
        RunWorker.cancel(pid)

      :error ->
        case RunStore.get(run_id) do
          nil ->
            {:error, "Run #{run_id} not found."}

          run ->
            cond do
              RunEvents.terminal?(run) ->
                {:ok, %{"run" => RunStore.public(run), "task" => nil}}

              is_binary(run["assignment_id"]) and is_map(repository) and is_binary(task_key) ->
                Assignments.cancel_run(registry_path, repository, task_key, run)

              true ->
                {:error, "The run is no longer active."}
            end
        end
    end
  end
end
