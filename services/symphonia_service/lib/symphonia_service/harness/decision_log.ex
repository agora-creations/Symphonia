defmodule SymphoniaService.Harness.DecisionLog do
  @moduledoc """
  Public-safe transient decision entries for Harness status.
  """

  @kinds ~w(dispatch skip error reconcile retry pause)

  def decision(kind, code, opts \\ []) when kind in @kinds and is_binary(code) do
    repository = Keyword.get(opts, :repository)
    task = Keyword.get(opts, :task)
    dispatched? = Keyword.get(opts, :dispatched, kind in ["dispatch", "retry"])

    %{
      "at" => Keyword.get(opts, :at) || now(),
      "kind" => kind,
      "code" => code,
      "repo" => key_for(repository),
      "task" => key_for(task),
      "reason" => Keyword.get(opts, :reason),
      "runId" => Keyword.get(opts, :run_id),
      "dispatched" => dispatched?
    }
    |> reject_nil()
  end

  def dispatch(repository, task, code, reason, opts \\ []) do
    decision("dispatch", code,
      repository: repository,
      task: task,
      reason: reason,
      run_id: Keyword.get(opts, :run_id),
      dispatched: true
    )
  end

  def skip(repository, task, code, reason) do
    decision("skip", code, repository: repository, task: task, reason: reason, dispatched: false)
  end

  def error(repository, task, code, reason) do
    decision("error", code, repository: repository, task: task, reason: reason, dispatched: false)
  end

  def reconcile(repository, task, code, reason, opts \\ []) do
    decision("reconcile", code,
      repository: repository,
      task: task,
      reason: reason,
      run_id: Keyword.get(opts, :run_id),
      dispatched: false
    )
  end

  def retry(repository, task, code, reason, opts \\ []) do
    decision("retry", code,
      repository: repository,
      task: task,
      reason: reason,
      run_id: Keyword.get(opts, :run_id),
      dispatched: Keyword.get(opts, :dispatched, true)
    )
  end

  def pause(code, reason, opts \\ []) do
    decision("pause", code,
      repository: Keyword.get(opts, :repository),
      task: Keyword.get(opts, :task),
      reason: reason,
      dispatched: false
    )
  end

  defp key_for(%{"key" => key}) when is_binary(key), do: key
  defp key_for(%{key: key}) when is_binary(key), do: key
  defp key_for(key) when is_binary(key), do: key
  defp key_for(_value), do: nil

  defp reject_nil(map), do: map |> Enum.reject(fn {_key, value} -> is_nil(value) end) |> Map.new()
  defp now, do: DateTime.utc_now() |> DateTime.truncate(:second) |> DateTime.to_iso8601()
end
