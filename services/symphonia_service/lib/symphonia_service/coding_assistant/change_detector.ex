defmodule SymphoniaService.CodingAssistant.ChangeDetector do
  @moduledoc """
  Detects Coding Assistant work-product changes and separates local metadata.
  """

  @excluded_prefixes [
    ".symphonia/",
    "symphonia/tasks/",
    "symphonia/run-summaries/"
  ]

  @excluded_files [
    "WORKFLOW.md",
    "registry.json",
    "repositories.json",
    "symphonia/registry.json",
    "symphonia/repositories.json"
  ]

  def detect!(repo_path) do
    files =
      repo_path
      |> status!()
      |> parse_status()
      |> Enum.uniq()
      |> Enum.sort()

    {excluded, committable} = Enum.split_with(files, &excluded?/1)

    %{
      "committable" => committable,
      "excluded" => excluded
    }
  end

  def excluded?(path) when is_binary(path) do
    path in @excluded_files or Enum.any?(@excluded_prefixes, &String.starts_with?(path, &1))
  end

  defp status!(repo_path) do
    case System.cmd("git", ["-C", repo_path, "status", "--porcelain", "--untracked-files=all"],
           stderr_to_stdout: true
         ) do
      {output, 0} ->
        output

      {output, _status} ->
        raise ArgumentError, clean_git_error(output)
    end
  end

  defp parse_status(output) do
    output
    |> String.split("\n", trim: true)
    |> Enum.map(&parse_status_line/1)
    |> Enum.reject(&blank?/1)
  end

  defp parse_status_line(line) do
    path = String.slice(line, 3..-1//1) || ""

    case String.split(path, " -> ", parts: 2) do
      [_from, to] -> String.trim(to)
      [single] -> String.trim(single)
    end
  end

  defp clean_git_error(output) do
    output
    |> to_string()
    |> String.trim()
    |> case do
      "" -> "Git status failed."
      message -> message
    end
  end

  defp blank?(value), do: is_nil(value) or (is_binary(value) and String.trim(value) == "")
end
