defmodule SymphoniaService.Runners.TokenStore do
  @moduledoc """
  One-way runner credential helpers.
  """

  import Bitwise

  def pairing_token do
    "sym_pair_" <> token_suffix()
  end

  def runner_token do
    "sym_runner_" <> token_suffix()
  end

  def hash(token) when is_binary(token) do
    :crypto.hash(:sha256, token) |> Base.encode16(case: :lower)
  end

  def hash(_token), do: hash("")

  def secure_equal_hash?(stored_hash, token) when is_binary(stored_hash) do
    candidate = hash(to_string(token || ""))
    byte_size(stored_hash) == byte_size(candidate) and constant_time_compare(stored_hash, candidate) == 0
  end

  def secure_equal_hash?(_stored_hash, _token), do: false

  def token_fingerprint(token) when is_binary(token) do
    token
    |> hash()
    |> String.slice(0, 16)
  end

  def token_fingerprint(_token), do: token_fingerprint("")

  defp token_suffix do
    :crypto.strong_rand_bytes(32) |> Base.url_encode64(padding: false)
  end

  defp constant_time_compare(left, right) do
    left
    |> :binary.bin_to_list()
    |> Enum.zip(:binary.bin_to_list(right))
    |> Enum.reduce(0, fn {a, b}, acc -> bor(acc, bxor(a, b)) end)
  end
end
