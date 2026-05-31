defmodule SymphoniaService.Sandbox.OpenSandboxOperations do
  @moduledoc """
  Private local operations state for OpenSandbox.

  This stores only sanitized status flags for readiness and Settings. Provider
  runtime material such as sandbox ids, endpoints, tokens, logs, and patches is
  intentionally not accepted.
  """

  @provider "opensandbox"
  @workspace_mode "source_bundle"
  @statuses ~w(passed failed never_run)

  def path(registry_path) do
    Path.join([Path.dirname(registry_path), "sandbox", "opensandbox_operations.json"])
  end

  def public(nil, _repository), do: default_public()

  def public(registry_path, repository) do
    registry_path
    |> read()
    |> Map.get(repo_key(repository), %{})
    |> public_record()
  end

  def record_smoke_started(registry_path, repository) do
    update(registry_path, repository, %{
      "provider" => @provider,
      "workspaceMode" => @workspace_mode,
      "lastSmokeStatus" => "running",
      "lastSmokeAt" => now(),
      "reasonCode" => nil
    })
  end

  def record_smoke_passed(registry_path, repository, cleanup_warning? \\ false) do
    update(registry_path, repository, %{
      "provider" => @provider,
      "workspaceMode" => @workspace_mode,
      "lastSmokeStatus" => "passed",
      "lastSmokeAt" => now(),
      "reasonCode" => nil,
      "cleanupWarning" => cleanup_warning? == true
    })
  end

  def record_smoke_failed(registry_path, repository, reason, cleanup_warning? \\ false) do
    update(registry_path, repository, %{
      "provider" => @provider,
      "workspaceMode" => @workspace_mode,
      "lastSmokeStatus" => "failed",
      "lastSmokeAt" => now(),
      "reasonCode" => safe_reason(reason),
      "cleanupWarning" => cleanup_warning? == true
    })
  end

  def record_cleanup(registry_path, repository, :ok) do
    update(registry_path, repository, %{
      "provider" => @provider,
      "workspaceMode" => @workspace_mode,
      "cleanupWarning" => false,
      "lastCleanupStatus" => "released",
      "lastCleanupAt" => now(),
      "lastCleanupReasonCode" => nil
    })
  end

  def record_cleanup(registry_path, repository, {:error, reason}) do
    update(registry_path, repository, %{
      "provider" => @provider,
      "workspaceMode" => @workspace_mode,
      "cleanupWarning" => true,
      "lastCleanupStatus" => "warning",
      "lastCleanupAt" => now(),
      "lastCleanupReasonCode" => safe_reason(reason)
    })
  end

  defp update(registry_path, repository, attrs) do
    repo_key = repo_key(repository)

    registry_path
    |> read()
    |> Map.update(repo_key, attrs, &Map.merge(&1, reject_nil(attrs)))
    |> write(registry_path)

    public(registry_path, repository)
  end

  defp read(registry_path) do
    case File.read(path(registry_path)) do
      {:ok, body} ->
        case JSON.decode(body) do
          {:ok, %{"repositories" => repositories}} when is_map(repositories) ->
            repositories

          {:ok, repositories} when is_map(repositories) ->
            repositories

          _other ->
            %{}
        end

      {:error, :enoent} ->
        %{}

      {:error, reason} ->
        raise File.Error, reason: reason, action: "read file", path: path(registry_path)
    end
  end

  defp write(records, registry_path) do
    file_path = path(registry_path)
    file_path |> Path.dirname() |> File.mkdir_p!()
    temp_path = "#{file_path}.tmp-#{System.unique_integer([:positive])}"
    File.write!(temp_path, JSON.encode!(%{"repositories" => records}))
    File.rename!(temp_path, file_path)
    chmod_private(file_path)
    records
  end

  defp public_record(record) when is_map(record) do
    %{
      "provider" => @provider,
      "lastSmokeStatus" => status(record["lastSmokeStatus"]),
      "lastSmokeAt" => safe_timestamp(record["lastSmokeAt"]),
      "reasonCode" => safe_reason_or_nil(record["reasonCode"]),
      "cleanupWarning" => record["cleanupWarning"] == true,
      "workspaceMode" => @workspace_mode,
      "lastCleanupStatus" => cleanup_status(record["lastCleanupStatus"]),
      "lastCleanupAt" => safe_timestamp(record["lastCleanupAt"]),
      "lastCleanupReasonCode" => safe_reason_or_nil(record["lastCleanupReasonCode"])
    }
    |> reject_nil()
  end

  defp default_public do
    %{
      "provider" => @provider,
      "lastSmokeStatus" => "never_run",
      "cleanupWarning" => false,
      "workspaceMode" => @workspace_mode
    }
  end

  defp repo_key(%{"key" => key}) when is_binary(key), do: key
  defp repo_key(key) when is_binary(key), do: key
  defp repo_key(_repository), do: "GLOBAL"

  defp status("running"), do: "running"
  defp status(value) when value in @statuses, do: value
  defp status(_value), do: "never_run"

  defp cleanup_status(value) when value in ["released", "warning"], do: value
  defp cleanup_status(_value), do: nil

  defp safe_timestamp(value) when is_binary(value), do: String.slice(value, 0, 40)
  defp safe_timestamp(_value), do: nil

  defp safe_reason_or_nil(nil), do: nil
  defp safe_reason_or_nil(value), do: safe_reason(value)

  defp safe_reason(reason) do
    reason
    |> to_string()
    |> String.replace(~r/[^a-zA-Z0-9._-]/, "_")
    |> String.slice(0, 80)
    |> case do
      "" -> "sandbox_failed"
      value -> value
    end
  end

  defp reject_nil(map) do
    map
    |> Enum.reject(fn
      {_key, nil} -> true
      _entry -> false
    end)
    |> Map.new()
  end

  defp now, do: DateTime.utc_now() |> DateTime.truncate(:second) |> DateTime.to_iso8601()

  defp chmod_private(file_path) do
    File.chmod(file_path, 0o600)
    :ok
  rescue
    _error -> :ok
  end
end
