defmodule SymphoniaService.CodingAssistant.ValidationEvidence do
  @moduledoc """
  Review-safe validation evidence derived from task review expectations.
  """

  @default_detail "No machine validation evidence was recorded for this expectation."
  @statuses ~w(passed failed not_run)

  def from_task(task) when is_map(task) do
    task
    |> review_expectations()
    |> Enum.map(fn expectation ->
      %{
        "label" => expectation,
        "status" => "not_run",
        "detail" => @default_detail
      }
    end)
  end

  def normalize(values) do
    values
    |> List.wrap()
    |> Enum.filter(&is_map/1)
    |> Enum.map(&normalize_one/1)
    |> Enum.reject(&blank?(&1["label"]))
  end

  def markdown_list(values) do
    values
    |> normalize()
    |> case do
      [] ->
        "- No validation evidence recorded."

      evidence ->
        Enum.map_join(evidence, "\n", fn item ->
          "- #{item["label"]}: #{item["status"]} - #{item["detail"]}"
        end)
    end
  end

  defp review_expectations(task) do
    (task["reviewExpectations"] || get_in(task, [:frontmatter, "review_expectations"]))
    |> List.wrap()
    |> Enum.map(&to_string/1)
    |> Enum.map(&String.trim/1)
    |> Enum.reject(&(&1 == ""))
  end

  defp normalize_one(item) do
    status = item["status"] |> to_string() |> String.trim()

    %{
      "label" => item["label"] |> to_string() |> String.trim(),
      "status" => if(status in @statuses, do: status, else: "not_run"),
      "detail" => clean_detail(item["detail"])
    }
  end

  defp clean_detail(value) do
    value
    |> to_string()
    |> String.trim()
    |> case do
      "" -> @default_detail
      detail -> detail
    end
  end

  defp blank?(value), do: is_nil(value) or (is_binary(value) and String.trim(value) == "")
end
