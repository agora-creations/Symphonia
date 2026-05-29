defmodule SymphoniaService.CodingAssistant.CuratedSummary do
  @moduledoc """
  Writes review-safe run summaries that can be committed with task branches.
  """

  alias SymphoniaService.CodingAssistant.ValidationEvidence

  def write!(
        repo_path,
        task,
        _run,
        files_changed,
        assistant_summary,
        validation_evidence \\ nil
      ) do
    validation_evidence = validation_evidence || ValidationEvidence.from_task(task)

    relative_path =
      Path.join([
        "symphonia",
        "run-summaries",
        "#{slug(task["key"])}-codex-handoff.md"
      ])

    full_path = Path.join(repo_path, relative_path)
    full_path |> Path.dirname() |> File.mkdir_p!()

    File.write!(
      full_path,
      body(task, files_changed, assistant_summary, validation_evidence)
    )

    relative_path
  end

  defp body(task, files_changed, assistant_summary, validation_evidence) do
    summary =
      assistant_summary
      |> to_string()
      |> String.trim()
      |> case do
        "" -> "Codex App Server completed this task and produced reviewable changes."
        value -> value
      end

    """
    # #{task["key"]} Codex Run Summary

    ## Task

    #{task["title"]}

    ## Run

    - Worker: Codex
    - Completed at: #{DateTime.utc_now() |> DateTime.truncate(:second) |> DateTime.to_iso8601()}

    ## Summary

    #{summary}

    ## Review Files

    #{markdown_list(files_changed)}

    ## Validation Evidence

    #{ValidationEvidence.markdown_list(validation_evidence)}

    ## Evidence Boundary

    Raw app-server events remain in the local Symphonía run store. This committed summary contains only curated review evidence.
    """
    |> String.trim_trailing()
    |> Kernel.<>("\n")
  end

  defp markdown_list(items) do
    items
    |> List.wrap()
    |> Enum.reject(&blank?/1)
    |> Enum.map_join("\n", &"- #{&1}")
    |> case do
      "" -> "- No files recorded."
      body -> body
    end
  end

  defp slug(value) do
    value
    |> to_string()
    |> String.downcase()
    |> String.replace(~r/[^a-z0-9._-]/, "-")
    |> String.trim("-")
    |> case do
      "" -> "run"
      slug -> slug
    end
  end

  defp blank?(value), do: is_nil(value) or (is_binary(value) and String.trim(value) == "")
end
