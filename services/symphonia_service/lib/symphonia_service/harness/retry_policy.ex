defmodule SymphoniaService.Harness.RetryPolicy do
  @moduledoc """
  Conservative retry policy for Harness-owned daemon assignment runs.
  """

  alias SymphoniaService.CodingAssistant.AppServerClient

  @retryable_classes ~w(transient_provider transient_workspace)
  @max_attempts 2
  @backoff_seconds %{1 => 30, 2 => 120}

  def max_attempts, do: @max_attempts

  def schedule(run, reason, public_message \\ nil)

  def schedule(%{"kind" => "daemon_assignment"} = run, reason, public_message) do
    failure_class = classify(reason, public_message)
    current_attempt = integer(run["attempt"], 0)
    max_attempts = integer(run["max_attempts"], @max_attempts)

    cond do
      failure_class not in @retryable_classes ->
        {:no_retry, %{"failure_class" => failure_class}}

      current_attempt >= max_attempts ->
        {:exhausted,
         %{
           "failure_class" => failure_class,
           "retry_reason" => "Transient Harness failure reached the retry limit.",
           "message" =>
             "Transient Harness failure reached the retry limit. Edit the task brief or retry manually."
         }}

      true ->
        next_attempt = current_attempt + 1
        seconds = Map.get(@backoff_seconds, next_attempt, 120)

        {:retry,
         %{
           "failure_class" => failure_class,
           "retry_at" => DateTime.utc_now() |> DateTime.add(seconds, :second) |> iso8601(),
           "retry_reason" => retry_reason(failure_class, seconds),
           "message" => retry_reason(failure_class, seconds),
           "max_attempts" => max_attempts
         }}
    end
  end

  def schedule(_run, _reason, _public_message), do: {:no_retry, %{"failure_class" => "unknown"}}

  def classify(reason, public_message \\ nil) do
    text =
      [reason, public_message]
      |> Enum.filter(&is_binary/1)
      |> Enum.join(" ")
      |> String.downcase()

    cond do
      Enum.any?([reason, public_message], &AppServerClient.setup_blocker?/1) ->
        "setup_blocked"

      text =~ "validation" and text =~ "failed" ->
        "validation_failed"

      text =~ "no reviewable" or text =~ "did not produce any files" or
          text =~ "no committable" ->
        "no_reviewable_files"

      text =~ "waiting for user" or text =~ "needs input" ->
        "user_blocked"

      text =~ "workspace" and
          (text =~ "temporar" or text =~ "lock" or text =~ "unavailable" or text =~ "missing") ->
        "transient_workspace"

      text =~ "codex app server did not respond" or text =~ "timed out" or
          text =~ "timeout" or text =~ "econn" or text =~ "connection refused" or
          text =~ "status interrupted" or text =~ "transient" or text =~ "temporar" or
          text =~ "unavailable" ->
        "transient_provider"

      true ->
        "unknown"
    end
  end

  def retryable_class?(class), do: class in @retryable_classes

  def scheduled?(%{"retry_at" => retry_at} = run) when is_binary(retry_at) do
    retryable_class?(run["failure_class"]) and run["state"] == "failed"
  end

  def scheduled?(_run), do: false

  def due?(run, now \\ DateTime.utc_now())

  def due?(%{"retry_at" => retry_at} = run, now) when is_binary(retry_at) do
    scheduled?(run) and compare_iso8601(retry_at, now) != :gt
  end

  def due?(_run, _now), do: false

  def next_attempt(run), do: integer(run["attempt"], 0) + 1

  def retry_reason("transient_workspace", seconds) do
    "Transient workspace error. Retry scheduled in #{seconds} seconds."
  end

  def retry_reason(_class, seconds) do
    "Transient Codex App Server error. Retry scheduled in #{seconds} seconds."
  end

  defp compare_iso8601(value, %DateTime{} = now) do
    case DateTime.from_iso8601(value) do
      {:ok, parsed, _offset} -> DateTime.compare(parsed, now)
      _ -> :lt
    end
  end

  defp integer(value, _default) when is_integer(value), do: value

  defp integer(value, default) when is_binary(value) do
    case Integer.parse(value) do
      {number, ""} -> number
      _ -> default
    end
  end

  defp integer(_value, default), do: default

  defp iso8601(datetime), do: datetime |> DateTime.truncate(:second) |> DateTime.to_iso8601()
end
