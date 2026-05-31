defmodule SymphoniaService.Runners.AssignmentStore do
  @moduledoc """
  Private local assignment store for remote runner work.
  """

  @states ~w(queued claimed running result_received importing completed failed canceled)
  @terminal_states ~w(completed failed canceled)

  @transitions %{
    "queued" => ~w(claimed canceled failed),
    "claimed" => ~w(running failed canceled),
    "running" => ~w(result_received failed canceled),
    "result_received" => ~w(importing failed),
    "importing" => ~w(completed failed),
    "completed" => [],
    "failed" => [],
    "canceled" => []
  }

  def states, do: @states
  def terminal_states, do: @terminal_states

  def path(registry_path) do
    Path.join([Path.dirname(registry_path), "runners", "assignments.json"])
  end

  def list(registry_path) do
    registry_path
    |> read()
    |> Enum.sort_by(&(&1["created_at"] || ""))
  end

  def get(registry_path, assignment_id) when is_binary(assignment_id) do
    Enum.find(list(registry_path), &(&1["id"] == assignment_id))
  end

  def get(_registry_path, _assignment_id), do: nil

  def create(registry_path, attrs) when is_map(attrs) do
    now = now()

    assignment =
      attrs
      |> Map.merge(%{
        "id" => Map.get(attrs, "id") || assignment_id(),
        "state" => "queued",
        "created_at" => now,
        "updated_at" => now,
        "claimed_at" => nil,
        "completed_at" => nil,
        "failure_class" => nil,
        "public_message" => nil,
        "result_digest" => nil,
        "changed_files_digest" => nil,
        "changed_files" => [],
        "public_timeline" => []
      })
      |> reject_nil()

    update_all(registry_path, fn assignments -> assignments ++ [assignment] end)
    assignment
  end

  def claim_next(registry_path, runner_id) when is_binary(runner_id) do
    assignments = read(registry_path)

    case Enum.find(assignments, &(&1["runner_id"] == runner_id and &1["state"] == "queued")) do
      nil ->
        nil

      assignment ->
        transition(registry_path, assignment["id"], "claimed", %{
          "claimed_at" => now(),
          "public_message" => "Runner claimed the assignment."
        })
    end
  end

  def current_for_runner(registry_path, runner_id) when is_binary(runner_id) do
    list(registry_path)
    |> Enum.find(fn assignment ->
      assignment["runner_id"] == runner_id and assignment["state"] not in @terminal_states
    end)
  end

  def transition(registry_path, assignment_id, next_state, attrs \\ %{}) do
    update(registry_path, assignment_id, fn assignment ->
      with :ok <- validate_transition(assignment["state"], next_state) do
        {:ok,
         assignment
         |> Map.merge(attrs)
         |> Map.merge(%{
           "state" => next_state,
           "updated_at" => now(),
           "completed_at" => completed_at(next_state, attrs)
         })
         |> reject_nil()}
      end
    end)
  end

  def update(registry_path, assignment_id, fun) when is_function(fun, 1) do
    assignments = read(registry_path)
    index = Enum.find_index(assignments, &(&1["id"] == assignment_id))

    case index do
      nil ->
        {:error, :not_found}

      index ->
        assignment = Enum.at(assignments, index)

        case fun.(assignment) do
          {:ok, updated} ->
            updated = updated |> Map.put("updated_at", now()) |> reject_nil()
            write(registry_path, List.replace_at(assignments, index, updated))
            {:ok, updated}

          {:error, reason} ->
            {:error, reason}
        end
    end
  end

  def append_public_event(registry_path, assignment_id, event) when is_map(event) do
    update(registry_path, assignment_id, fn assignment ->
      event =
        event
        |> Map.take(["step", "message", "at"])
        |> Map.put_new("at", now())
        |> reject_nil()

      timeline = List.wrap(assignment["public_timeline"]) ++ [event]
      {:ok, Map.put(assignment, "public_timeline", timeline)}
    end)
  end

  def same_result?(assignment, digest) when is_map(assignment) and is_binary(digest) do
    assignment["result_digest"] == digest
  end

  def terminal?(%{"state" => state}), do: state in @terminal_states
  def terminal?(_assignment), do: false

  def public(assignment) when is_map(assignment) do
    %{
      "id" => assignment["id"],
      "runId" => assignment["run_id"],
      "repoKey" => assignment["repo_key"],
      "taskKey" => assignment["task_key"],
      "runnerId" => assignment["runner_id"],
      "runnerMode" => assignment["runner_mode"],
      "state" => assignment["state"],
      "provider" => assignment["provider"],
      "workspaceProvider" => assignment["workspace_provider"],
      "baseBranch" => assignment["base_branch"],
      "baseSha" => assignment["base_sha"],
      "createdAt" => assignment["created_at"],
      "claimedAt" => assignment["claimed_at"],
      "completedAt" => assignment["completed_at"],
      "failureClass" => assignment["failure_class"],
      "publicMessage" => assignment["public_message"],
      "changedFileCount" => length(List.wrap(assignment["changed_files"])),
      "cleanupWarning" => assignment["cleanup_warning"],
      "cancellationRequested" => assignment["cancellation_requested"] == true
    }
    |> reject_nil()
  end

  def runner_payload(assignment) when is_map(assignment) do
    %{
      "id" => assignment["id"],
      "runId" => assignment["run_id"],
      "repoKey" => assignment["repo_key"],
      "taskKey" => assignment["task_key"],
      "provider" => assignment["provider"],
      "workspaceProvider" => assignment["workspace_provider"],
      "baseBranch" => assignment["base_branch"],
      "baseSha" => assignment["base_sha"],
      "repository" => assignment["repository"],
      "contextPack" => assignment["context_pack"],
      "cancellationRequested" => assignment["cancellation_requested"] == true
    }
    |> reject_nil()
  end

  defp validate_transition(state, state), do: :ok

  defp validate_transition(state, next_state) do
    if next_state in Map.get(@transitions, state, []) do
      :ok
    else
      {:error, :invalid_transition}
    end
  end

  defp completed_at(next_state, attrs) when next_state in @terminal_states do
    attrs["completed_at"] || now()
  end

  defp completed_at(_next_state, attrs), do: attrs["completed_at"]

  defp update_all(registry_path, fun) do
    registry_path
    |> read()
    |> fun.()
    |> then(&write(registry_path, &1))
  end

  defp read(registry_path) do
    case File.read(path(registry_path)) do
      {:ok, body} ->
        case JSON.decode(body) do
          {:ok, %{"assignments" => assignments}} when is_list(assignments) ->
            Enum.filter(assignments, &is_map/1)

          {:ok, assignments} when is_list(assignments) ->
            Enum.filter(assignments, &is_map/1)

          _ ->
            []
        end

      {:error, :enoent} ->
        []

      {:error, reason} ->
        raise File.Error, reason: reason, action: "read file", path: path(registry_path)
    end
  end

  defp write(registry_path, assignments) do
    file_path = path(registry_path)
    file_path |> Path.dirname() |> File.mkdir_p!()
    temp_path = "#{file_path}.tmp-#{System.unique_integer([:positive])}"
    File.write!(temp_path, JSON.encode!(%{"assignments" => assignments}))
    File.rename!(temp_path, file_path)
    chmod_private(file_path)
    :ok
  end

  defp assignment_id do
    suffix = :crypto.strong_rand_bytes(8) |> Base.url_encode64(padding: false)
    "assignment_#{System.system_time(:millisecond)}_#{suffix}"
  end

  defp reject_nil(map), do: map |> Enum.reject(fn {_key, value} -> is_nil(value) end) |> Map.new()
  defp now, do: DateTime.utc_now() |> DateTime.truncate(:second) |> DateTime.to_iso8601()

  defp chmod_private(path) do
    File.chmod(path, 0o600)
    :ok
  rescue
    _ -> :ok
  end
end
