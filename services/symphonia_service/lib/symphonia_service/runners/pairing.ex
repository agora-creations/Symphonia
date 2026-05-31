defmodule SymphoniaService.Runners.Pairing do
  @moduledoc """
  One-time runner pairing tokens.
  """

  alias SymphoniaService.Runners.TokenStore

  @default_expiry_minutes 15
  @max_expiry_minutes 60

  def path(registry_path) do
    Path.join([Path.dirname(registry_path), "runners", "pairing_tokens.json"])
  end

  def create(registry_path, actor, attrs \\ %{}) when is_map(attrs) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)
    token = TokenStore.pairing_token()
    minutes = expiry_minutes(attrs["expiresInMinutes"] || attrs["expires_in_minutes"])
    expires_at = DateTime.add(now, minutes * 60, :second)

    pairing =
      %{
        "id" => pairing_id(),
        "name" => normalized_name(attrs["name"]),
        "token_hash" => TokenStore.hash(token),
        "created_by" => actor_id(actor),
        "created_at" => DateTime.to_iso8601(now),
        "expires_at" => DateTime.to_iso8601(expires_at),
        "used_at" => nil,
        "revoked_at" => nil,
        "capability_hint" => sanitize_capability_hint(attrs["capabilityHint"] || attrs["capability_hint"])
      }
      |> reject_nil()

    update_all(registry_path, fn pairings -> pairings ++ [pairing] end)

    {:ok, public(pairing), token}
  end

  def consume(registry_path, token) when is_binary(token) do
    now = DateTime.utc_now()

    update_matching(registry_path, fn pairing ->
      cond do
        not TokenStore.secure_equal_hash?(pairing["token_hash"], token) ->
          :skip

        pairing["revoked_at"] ->
          {:error, :pairing_token_revoked}

        pairing["used_at"] ->
          {:error, :pairing_token_used}

        expired?(pairing, now) ->
          {:error, :pairing_token_expired}

        true ->
          {:ok, Map.put(pairing, "used_at", now_iso()), pairing}
      end
    end)
  end

  def consume(_registry_path, _token), do: {:error, :pairing_token_invalid}

  def revoke(registry_path, pairing_id) when is_binary(pairing_id) do
    update(registry_path, pairing_id, fn pairing ->
      if pairing["used_at"] do
        {:error, :pairing_token_used}
      else
        {:ok, Map.put(pairing, "revoked_at", now_iso())}
      end
    end)
  end

  def list(registry_path) do
    registry_path
    |> read()
    |> Enum.map(&public/1)
  end

  def public(pairing) when is_map(pairing) do
    %{
      "id" => pairing["id"],
      "name" => pairing["name"],
      "createdBy" => pairing["created_by"],
      "createdAt" => pairing["created_at"],
      "expiresAt" => pairing["expires_at"],
      "usedAt" => pairing["used_at"],
      "revokedAt" => pairing["revoked_at"],
      "capabilityHint" => pairing["capability_hint"]
    }
    |> reject_nil()
  end

  defp update_matching(registry_path, fun) do
    pairings = read(registry_path)

    case Enum.find_index(pairings, fn pairing -> match?({:ok, _, _}, fun.(pairing)) end) do
      nil ->
        pairings
        |> Enum.reduce_while(nil, fn pairing, _acc ->
          case fun.(pairing) do
            {:error, reason} -> {:halt, {:error, reason}}
            _ -> {:cont, nil}
          end
        end) || {:error, :pairing_token_invalid}

      index ->
        pairing = Enum.at(pairings, index)
        {:ok, updated, original} = fun.(pairing)
        write(registry_path, List.replace_at(pairings, index, updated))
        {:ok, original}
    end
  end

  defp update(registry_path, pairing_id, fun) do
    pairings = read(registry_path)
    index = Enum.find_index(pairings, &(&1["id"] == pairing_id))

    case index do
      nil ->
        {:error, :not_found}

      index ->
        pairing = Enum.at(pairings, index)

        case fun.(pairing) do
          {:ok, updated} ->
            write(registry_path, List.replace_at(pairings, index, updated))
            {:ok, public(updated)}

          {:error, reason} ->
            {:error, reason}
        end
    end
  end

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
          {:ok, %{"pairingTokens" => pairings}} when is_list(pairings) -> Enum.filter(pairings, &is_map/1)
          {:ok, pairings} when is_list(pairings) -> Enum.filter(pairings, &is_map/1)
          _ -> []
        end

      {:error, :enoent} ->
        []

      {:error, reason} ->
        raise File.Error, reason: reason, action: "read file", path: path(registry_path)
    end
  end

  defp write(registry_path, pairings) do
    file_path = path(registry_path)
    file_path |> Path.dirname() |> File.mkdir_p!()
    temp_path = "#{file_path}.tmp-#{System.unique_integer([:positive])}"
    File.write!(temp_path, JSON.encode!(%{"pairingTokens" => pairings}))
    File.rename!(temp_path, file_path)
    chmod_private(file_path)
    :ok
  end

  defp expired?(pairing, now) do
    with value when is_binary(value) <- pairing["expires_at"],
         {:ok, expires_at, _offset} <- DateTime.from_iso8601(value) do
      DateTime.compare(expires_at, now) != :gt
    else
      _ -> true
    end
  end

  defp expiry_minutes(value) when is_integer(value), do: max(1, min(value, @max_expiry_minutes))

  defp expiry_minutes(value) when is_binary(value) do
    case Integer.parse(value) do
      {number, ""} -> expiry_minutes(number)
      _ -> @default_expiry_minutes
    end
  end

  defp expiry_minutes(_value), do: @default_expiry_minutes

  defp normalized_name(value) when is_binary(value) do
    case String.trim(value) do
      "" -> "Remote runner"
      name -> String.slice(name, 0, 80)
    end
  end

  defp normalized_name(_value), do: "Remote runner"

  defp sanitize_capability_hint(value) when is_map(value) do
    value
    |> Map.take(["codexAppServer", "validation"])
    |> Enum.filter(fn {_key, enabled?} -> enabled? in [true, false] end)
    |> Map.new()
  end

  defp sanitize_capability_hint(_value), do: %{}

  defp actor_id(%{"id" => id}) when is_binary(id), do: String.slice(id, 0, 80)
  defp actor_id(_actor), do: "unknown"

  defp pairing_id do
    suffix = :crypto.strong_rand_bytes(8) |> Base.url_encode64(padding: false)
    "pair_#{suffix}"
  end

  defp now_iso, do: DateTime.utc_now() |> DateTime.truncate(:second) |> DateTime.to_iso8601()

  defp reject_nil(map), do: Map.reject(map, fn {_key, value} -> is_nil(value) end)

  defp chmod_private(path) do
    File.chmod(path, 0o600)
  rescue
    _error -> :ok
  end
end
