defmodule SymphoniaService.Harness.LocalState do
  @moduledoc """
  Private local operational state for the Harness daemon.
  """

  def load(registry_path) do
    registry_path
    |> path()
    |> read()
    |> normalize()
  end

  def pause(registry_path) do
    update(registry_path, fn state ->
      state
      |> Map.put("paused", true)
      |> Map.put("pausedAt", now())
    end)
  end

  def resume(registry_path) do
    update(registry_path, fn state ->
      state
      |> Map.put("paused", false)
      |> Map.put("resumedAt", now())
    end)
  end

  def mark_manual_tick(registry_path) do
    update(registry_path, &Map.put(&1, "lastManualTickAt", now()))
  end

  def mark_reconciliation(registry_path, summary) when is_map(summary) do
    update(registry_path, fn state ->
      state
      |> Map.put("lastReconciliationAt", summary["at"] || now())
      |> Map.put("lastReconciliation", summary)
    end)
  end

  def path(registry_path) do
    Path.join(Path.dirname(registry_path), "harness_state.json")
  end

  defp update(registry_path, fun) when is_function(fun, 1) do
    state =
      registry_path
      |> load()
      |> fun.()
      |> normalize()

    save(registry_path, state)
    state
  end

  defp read(path) do
    case File.read(path) do
      {:ok, ""} -> %{}
      {:ok, body} -> JSON.decode!(body)
      {:error, :enoent} -> %{}
      {:error, reason} -> raise File.Error, reason: reason, action: "read file", path: path
    end
  end

  defp save(registry_path, state) do
    state_path = path(registry_path)
    state_path |> Path.dirname() |> File.mkdir_p!()
    temp_path = "#{state_path}.tmp-#{System.unique_integer([:positive])}"
    File.write!(temp_path, JSON.encode!(state))
    File.rename!(temp_path, state_path)
    chmod_private(state_path)
    :ok
  end

  defp normalize(state) when is_map(state) do
    %{
      "paused" => truthy?(state["paused"]),
      "pausedAt" => state["pausedAt"],
      "resumedAt" => state["resumedAt"],
      "lastManualTickAt" => state["lastManualTickAt"],
      "lastReconciliationAt" => state["lastReconciliationAt"],
      "lastReconciliation" => state["lastReconciliation"]
    }
    |> reject_nil()
  end

  defp truthy?(true), do: true
  defp truthy?("true"), do: true
  defp truthy?(_), do: false

  defp reject_nil(map), do: map |> Enum.reject(fn {_key, value} -> is_nil(value) end) |> Map.new()
  defp now, do: DateTime.utc_now() |> DateTime.truncate(:second) |> DateTime.to_iso8601()

  defp chmod_private(path) do
    File.chmod(path, 0o600)
    :ok
  rescue
    _ -> :ok
  end
end
