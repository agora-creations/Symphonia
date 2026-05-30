defmodule SymphoniaService.Runners.RemoteResult do
  @moduledoc """
  Public-safe normalization helpers for remote runner results.
  """

  alias SymphoniaService.Validation.Evidence

  def public_summary(result) when is_map(result) do
    result["publicSummary"] || result["public_summary"] || "Runner produced a reviewable patch."
  end

  def advisory_validation(result) when is_map(result) do
    result["runnerValidation"] || result["runner_validation"] || result["validation"] || []
  end

  def public_timeline(result) when is_map(result) do
    result
    |> Map.get("publicTimeline", result["public_timeline"] || [])
    |> List.wrap()
    |> Enum.filter(&is_map/1)
    |> Enum.map(fn item ->
      %{
        "step" => Evidence.sanitize_public_text(item["step"] || "runner_update"),
        "message" => Evidence.sanitize_public_text(item["message"] || "Runner reported progress.")
      }
    end)
  end

  def failure_digest(payload) when is_map(payload) do
    [
      payload["failureClass"] || payload["failure_class"],
      payload["publicMessage"] || payload["public_message"] || payload["message"]
    ]
    |> Enum.map(&to_string/1)
    |> Enum.join("\n")
    |> then(&:crypto.hash(:sha256, &1))
    |> Base.encode16(case: :lower)
  end
end
