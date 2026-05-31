defmodule SymphoniaService.Runners.Registry do
  @moduledoc """
  Private runner registry with public-safe serialization.
  """

  alias SymphoniaService.Runners.{Capabilities, Heartbeat, LocalService, Pairing, TokenStore}

  def list(registry_path, opts \\ []) do
    now = Keyword.get(opts, :now, DateTime.utc_now())

    [LocalService.status(registry_path) | remote(registry_path, now: now)]
  end

  def remote(registry_path, opts \\ []) do
    now = Keyword.get(opts, :now, DateTime.utc_now())

    registry_path
    |> read_remote()
    |> Enum.map(&public(&1, now: now))
  end

  def capacity(registry_path, opts \\ []) do
    now = Keyword.get(opts, :now, DateTime.utc_now())

    %{
      "localService" => LocalService.status(registry_path),
      "remote" => remote(registry_path, now: now)
    }
  end

  def get(registry_path, runner_id, opts \\ [])

  def get(registry_path, "local-service", _opts), do: {:ok, LocalService.status(registry_path)}

  def get(registry_path, runner_id, opts) when is_binary(runner_id) do
    now = Keyword.get(opts, :now, DateTime.utc_now())

    case Enum.find(read_remote(registry_path), &(&1["id"] == runner_id)) do
      nil -> {:error, :not_found}
      runner -> {:ok, with_runtime_status(runner, now)}
    end
  end

  def get(_registry_path, _runner_id, _opts), do: {:error, :not_found}

  def register(registry_path, actor, attrs) when is_map(attrs) do
    pairing_token = attrs["pairingToken"] || attrs["pairing_token"]

    with {:ok, pairing} <- Pairing.consume(registry_path, pairing_token) do
      runner_token = TokenStore.runner_token()
      now = now()

      runner =
        %{
          "id" => runner_id(),
          "name" => normalized_name(attrs["name"] || pairing["name"]),
          "mode" => "remote_runner",
          "enabled" => true,
          "trustState" => "pending",
          "tokenState" => "active",
          "requiresTokenRotation" => false,
          "createdAt" => now,
          "registeredAt" => now,
          "lastHeartbeatAt" => now,
          "lastObservedStatus" => "online",
          "capabilities" => Capabilities.sanitize(attrs["capabilities"] || %{}),
          "limits" => sanitize_limits(attrs["limits"] || %{}),
          "currentRuns" => nonnegative_integer(attrs["currentRuns"] || attrs["current_runs"], 0),
          "tokenHash" => TokenStore.hash(runner_token),
          "pairingId" => pairing["id"],
          "registrationSource" => actor_source(actor)
        }

      update_remote(registry_path, fn runners -> runners ++ [runner] end)
      {:ok, runner, runner_token}
    end
  end

  def heartbeat(registry_path, runner_id, token, attrs) when is_map(attrs) do
    update_existing(registry_path, runner_id, fn runner ->
      case authenticate_runner_token(runner, token) do
        :ok ->
          before_status = public_status(runner)

          updated =
            runner
            |> Map.put("lastHeartbeatAt", now())
            |> Map.put("lastObservedStatus", "online")
            |> Map.put(
              "capabilities",
              Capabilities.sanitize(attrs["capabilities"] || runner["capabilities"] || %{})
            )
            |> Map.put(
              "currentRuns",
              nonnegative_integer(
                attrs["currentRuns"] || attrs["current_runs"],
                runner["currentRuns"] || 0
              )
            )
            |> maybe_update_limits(attrs["limits"])

          after_status = public_status(updated)
          {:ok, updated, %{before: before_status, after: after_status}}

        {:error, reason} ->
          {:error, reason}
      end
    end)
  end

  def heartbeat(_registry_path, _runner_id, _token, _attrs), do: {:error, :invalid_payload}

  def authenticate(registry_path, runner_id, token) when is_binary(runner_id) do
    case Enum.find(read_remote(registry_path), &(&1["id"] == runner_id)) do
      nil ->
        {:error, :not_found}

      runner ->
        case authenticate_runner_token(runner, token) do
          :ok -> {:ok, with_runtime_status(runner)}
          {:error, reason} -> {:error, reason}
        end
    end
  end

  def authenticate(_registry_path, _runner_id, _token), do: {:error, :not_found}

  def approve(_registry_path, "local-service"), do: {:error, :local_service_immutable}

  def approve(registry_path, runner_id) do
    update_existing(registry_path, runner_id, fn runner ->
      case trust_state(runner) do
        "pending" ->
          {:ok, runner |> Map.put("trustState", "trusted") |> Map.put("enabled", true), %{}}

        "trusted" ->
          {:ok, runner, %{}}

        "disabled" ->
          {:error, :runner_disabled}

        "revoked" ->
          {:error, :runner_revoked}

        _state ->
          {:error, :invalid_trust_state}
      end
    end)
  end

  def enable(_registry_path, "local-service"), do: {:error, :local_service_immutable}

  def enable(registry_path, runner_id) do
    update_existing(registry_path, runner_id, fn runner ->
      case trust_state(runner) do
        "disabled" ->
          restored = runner["previousTrustState"] || "pending"

          {:ok,
           runner
           |> Map.put("trustState", restored)
           |> Map.put("enabled", true)
           |> Map.delete("previousTrustState"), %{}}

        "revoked" ->
          {:error, :runner_revoked}

        _state ->
          {:ok, Map.put(runner, "enabled", true), %{}}
      end
    end)
  end

  def disable(_registry_path, "local-service"), do: {:error, :local_service_immutable}

  def disable(registry_path, runner_id) do
    update_existing(registry_path, runner_id, fn runner ->
      case trust_state(runner) do
        "revoked" ->
          {:error, :runner_revoked}

        "disabled" ->
          {:ok, Map.put(runner, "enabled", false), %{}}

        state ->
          updated =
            runner
            |> Map.put("previousTrustState", state)
            |> Map.put("trustState", "disabled")
            |> Map.put("enabled", false)

          {:ok, updated, %{}}
      end
    end)
  end

  def revoke(_registry_path, "local-service"), do: {:error, :local_service_immutable}

  def revoke(registry_path, runner_id) do
    update_existing(registry_path, runner_id, fn runner ->
      updated =
        runner
        |> Map.put("trustState", "revoked")
        |> Map.put("tokenState", "revoked")
        |> Map.put("enabled", false)
        |> Map.put("revokedAt", now())

      {:ok, updated, %{}}
    end)
  end

  def rotate_token(_registry_path, "local-service"), do: {:error, :local_service_immutable}

  def rotate_token(registry_path, runner_id) do
    token = TokenStore.runner_token()

    update_existing(registry_path, runner_id, fn runner ->
      case trust_state(runner) do
        "revoked" ->
          {:error, :runner_revoked}

        _state ->
          updated =
            runner
            |> Map.put("rotatedTokenHashes", rotated_token_hashes(runner))
            |> Map.put("tokenHash", TokenStore.hash(token))
            |> Map.put("tokenState", "active")
            |> Map.put("requiresTokenRotation", false)
            |> Map.put("tokenRotatedAt", now())

          {:ok, updated, %{"runnerToken" => token}}
      end
    end)
    |> case do
      {:ok, runner, meta} -> {:ok, runner, Map.fetch!(meta, "runnerToken")}
      error -> error
    end
  end

  def mark_stale(registry_path, now \\ DateTime.utc_now()) do
    runners = read_remote(registry_path)

    {next_runners, transitions} =
      Enum.map_reduce(runners, [], fn runner, transitions ->
        before_status = runner["lastObservedStatus"] || health_state(runner, now)
        after_status = health_state(runner, now)
        updated = Map.put(runner, "lastObservedStatus", after_status)

        transition =
          if Heartbeat.transition?(before_status, after_status) and
               after_status in ["stale", "offline"] do
            [
              %{
                "runner" => public(updated, now: now),
                "before" => before_status,
                "after" => after_status
              }
            ]
          else
            []
          end

        {updated, transitions ++ transition}
      end)

    if next_runners != runners, do: write_remote(registry_path, next_runners)
    transitions
  end

  def public(runner, opts \\ [])

  def public(%{"mode" => "local_service"} = runner, _opts) do
    runner
    |> Map.put("trustState", "local_service")
    |> Map.put("healthState", runner["healthState"] || runner["status"] || "online")
    |> Map.put("tokenState", "active")
  end

  def public(runner, opts) when is_map(runner) do
    now = Keyword.get(opts, :now, DateTime.utc_now())

    %{
      "id" => string_or_default(runner["id"], "runner_unknown"),
      "name" => string_or_default(runner["name"], "Remote runner"),
      "mode" => "remote_runner",
      "status" => public_status(runner, now),
      "healthState" => health_state(runner, now),
      "trustState" => trust_state(runner),
      "tokenState" => token_state(runner),
      "lastHeartbeatAt" => runner["lastHeartbeatAt"],
      "capabilities" => Capabilities.sanitize(runner["capabilities"] || %{}),
      "limits" => sanitize_limits(runner["limits"] || %{}),
      "currentRuns" => nonnegative_integer(runner["currentRuns"], 0),
      "requiresTokenRotation" => runner["requiresTokenRotation"] == true
    }
    |> reject_nil()
  end

  def path(registry_path), do: Path.join([Path.dirname(registry_path), "runners", "runners.json"])

  def token_hash(token) when is_binary(token), do: TokenStore.hash(token)

  def trust_state(%{"mode" => "local_service"}), do: "local_service"
  def trust_state(%{"trustState" => state}) when state in ~w(pending trusted disabled revoked), do: state
  def trust_state(%{"trusted" => true}), do: "pending"
  def trust_state(%{"enabled" => false}), do: "disabled"
  def trust_state(_runner), do: "pending"

  def token_state(%{"mode" => "local_service"}), do: "active"
  def token_state(%{"tokenState" => state}) when state in ~w(active rotated revoked), do: state
  def token_state(%{"requiresTokenRotation" => true}), do: "rotated"
  def token_state(_runner), do: "rotated"

  def health_state(runner, now \\ DateTime.utc_now())

  def health_state(%{"mode" => "local_service"} = runner, _now), do: runner["status"] || "online"

  def health_state(runner, now) when is_map(runner) do
    Heartbeat.status(Map.put(runner, "enabled", true), now)
  end

  def public_status(runner, now \\ DateTime.utc_now())

  def public_status(%{"mode" => "local_service"} = runner, _now), do: runner["status"] || "online"

  def public_status(runner, now) when is_map(runner) do
    case trust_state(runner) do
      "disabled" -> "disabled"
      "revoked" -> "disabled"
      _state -> health_state(runner, now)
    end
  end

  defp authenticate_runner_token(runner, token) do
    cond do
      trust_state(runner) == "revoked" ->
        {:error, :runner_revoked}

      token_state(runner) == "revoked" ->
        {:error, :runner_token_revoked}

      token_state(runner) == "rotated" ->
        {:error, :runner_token_rotated}

      rotated_token?(runner, token) ->
        {:error, :runner_token_rotated}

      not TokenStore.secure_equal_hash?(runner["tokenHash"], token) ->
        {:error, :invalid_token}

      true ->
        :ok
    end
  end

  defp rotated_token?(runner, token) do
    runner
    |> Map.get("rotatedTokenHashes", [])
    |> List.wrap()
    |> Enum.any?(&TokenStore.secure_equal_hash?(&1, token))
  end

  defp rotated_token_hashes(runner) do
    ([runner["tokenHash"]] ++ List.wrap(runner["rotatedTokenHashes"]))
    |> Enum.filter(&is_binary/1)
    |> Enum.uniq()
    |> Enum.take(5)
  end

  defp with_runtime_status(runner, now \\ DateTime.utc_now()) do
    runner
    |> Map.put("status", public_status(runner, now))
    |> Map.put("healthState", health_state(runner, now))
  end

  defp update_existing(registry_path, runner_id, fun) do
    runners = read_remote(registry_path)
    index = Enum.find_index(runners, &(&1["id"] == runner_id))

    case index do
      nil ->
        {:error, :not_found}

      index ->
        runner = Enum.at(runners, index)

        case fun.(runner) do
          {:ok, updated, meta} ->
            next_runners = List.replace_at(runners, index, updated)
            write_remote(registry_path, next_runners)
            {:ok, updated, meta}

          {:error, reason} ->
            {:error, reason}
        end
    end
  end

  defp update_remote(registry_path, fun) do
    registry_path
    |> read_remote()
    |> fun.()
    |> then(&write_remote(registry_path, &1))
  end

  defp read_remote(registry_path) do
    case File.read(path(registry_path)) do
      {:ok, body} ->
        runners =
          case JSON.decode(body) do
            {:ok, %{"runners" => runners}} when is_list(runners) -> Enum.filter(runners, &is_map/1)
            {:ok, runners} when is_list(runners) -> Enum.filter(runners, &is_map/1)
            _ -> []
          end

        Enum.map(runners, &normalize_runner/1)

      {:error, :enoent} ->
        []

      {:error, reason} ->
        raise File.Error, reason: reason, action: "read file", path: path(registry_path)
    end
  end

  defp write_remote(registry_path, runners) do
    file_path = path(registry_path)
    file_path |> Path.dirname() |> File.mkdir_p!()
    temp_path = "#{file_path}.tmp-#{System.unique_integer([:positive])}"
    File.write!(temp_path, JSON.encode!(%{"runners" => runners}))
    File.rename!(temp_path, file_path)
    chmod_private(file_path)
    :ok
  end

  defp normalize_runner(%{"mode" => "local_service"} = runner), do: runner

  defp normalize_runner(runner) when is_map(runner) do
    legacy? = not Map.has_key?(runner, "trustState")

    runner
    |> Map.put_new("mode", "remote_runner")
    |> Map.put("trustState", runner["trustState"] || if(legacy?, do: "pending", else: "pending"))
    |> Map.put("tokenState", runner["tokenState"] || if(legacy?, do: "rotated", else: "active"))
    |> Map.put("requiresTokenRotation", runner["requiresTokenRotation"] || legacy?)
    |> Map.put("enabled", runner["enabled"] == true and not legacy?)
    |> Map.put_new("limits", %{"maxConcurrentRuns" => 1})
    |> Map.put_new("capabilities", %{})
  end

  defp maybe_update_limits(runner, nil), do: runner
  defp maybe_update_limits(runner, limits), do: Map.put(runner, "limits", sanitize_limits(limits))

  defp sanitize_limits(limits) when is_map(limits) do
    %{
      "maxConcurrentRuns" =>
        positive_integer(limits["maxConcurrentRuns"] || limits["max_concurrent_runs"], 1)
    }
  end

  defp sanitize_limits(_limits), do: %{"maxConcurrentRuns" => 1}

  defp normalized_name(value) when is_binary(value) do
    case String.trim(value) do
      "" -> "Remote runner"
      name -> String.slice(name, 0, 80)
    end
  end

  defp normalized_name(_value), do: "Remote runner"

  defp positive_integer(value, default) do
    case integer(value) do
      nil -> default
      value -> max(1, min(value, 32))
    end
  end

  defp nonnegative_integer(value, default) do
    case integer(value) do
      nil -> default
      value -> max(0, value)
    end
  end

  defp integer(value) when is_integer(value), do: value

  defp integer(value) when is_binary(value) do
    case Integer.parse(value) do
      {number, ""} -> number
      _ -> nil
    end
  end

  defp integer(_value), do: nil

  defp actor_source(%{"source" => source}) when is_binary(source), do: String.slice(source, 0, 40)
  defp actor_source(_actor), do: "local"

  defp string_or_default(value, default) when is_binary(value) do
    case String.trim(value) do
      "" -> default
      value -> String.slice(value, 0, 120)
    end
  end

  defp string_or_default(_value, default), do: default

  defp runner_id do
    suffix = :crypto.strong_rand_bytes(8) |> Base.url_encode64(padding: false)
    "runner_#{suffix}"
  end

  defp reject_nil(map), do: Map.reject(map, fn {_key, value} -> is_nil(value) end)

  defp now, do: DateTime.utc_now() |> DateTime.truncate(:second) |> DateTime.to_iso8601()

  defp chmod_private(path) do
    File.chmod(path, 0o600)
  rescue
    _error -> :ok
  end
end
