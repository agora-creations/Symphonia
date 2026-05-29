defmodule SymphoniaService.CodingAssistant.ValidationEvidence do
  @moduledoc """
  Compatibility helpers for review-safe machine-validation evidence.
  """

  alias SymphoniaService.Validation.Evidence

  def from_task(_task), do: Evidence.public([Evidence.not_configured_result()])

  def normalize(values), do: Evidence.public(values)

  def markdown_list(values), do: Evidence.markdown_list(values)
end
