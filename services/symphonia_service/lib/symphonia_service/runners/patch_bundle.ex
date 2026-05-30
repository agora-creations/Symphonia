defmodule SymphoniaService.Runners.PatchBundle do
  @moduledoc """
  Validates V1 git-diff patch bundles before local import.
  """

  alias SymphoniaService.CodingAssistant.ChangeDetector

  @max_patch_bytes 5 * 1024 * 1024
  @max_changed_files 100

  @protected_prefixes [
    ".git/",
    ".symphonia/",
    "symphonia/tasks/",
    "symphonia/run-summaries/"
  ]

  @protected_files MapSet.new([
                     ".git",
                     ".symphonia",
                     "WORKFLOW.md",
                     "registry.json",
                     "repositories.json",
                     "symphonia/registry.json",
                     "symphonia/repositories.json"
                   ])

  def validate(result, assignment) when is_map(result) and is_map(assignment) do
    bundle = result["patchBundle"] || result["patch_bundle"] || %{}
    diff = bundle["diff"]

    with :ok <- require_completed_status(result),
         :ok <- require_assignment_match(result, assignment),
         :ok <- require_base_match(result, assignment),
         :ok <- require_format(bundle),
         :ok <- require_patch_body(diff),
         :ok <- require_patch_size(diff),
         :ok <- reject_binary(diff),
         digest <- sha256(diff),
         :ok <- require_digest(bundle, digest),
         {:ok, parsed_paths} <- parse_paths(diff),
         changed_paths <-
           normalize_changed_files(result["changedFiles"] || result["changed_files"]),
         :ok <- require_changed_file_match(changed_paths, parsed_paths),
         :ok <- require_changed_files_digest(result, parsed_paths),
         :ok <- require_file_count(parsed_paths),
         :ok <- validate_paths(parsed_paths) do
      {:ok,
       %{
         "diff" => diff,
         "patch_digest" => digest,
         "changed_files" => parsed_paths,
         "changed_files_digest" => changed_files_digest(parsed_paths),
         "changed_file_count" => length(parsed_paths)
       }}
    end
  end

  def validate(_result, _assignment), do: {:error, "invalid_result"}

  def changed_files_digest(paths), do: paths |> Enum.sort() |> Enum.join("\n") |> sha256()
  def sha256(value), do: :crypto.hash(:sha256, to_string(value)) |> Base.encode16(case: :lower)

  defp require_completed_status(%{"status" => status}) when status in ["completed", "succeeded"],
    do: :ok

  defp require_completed_status(_result), do: {:error, "result_not_completed"}

  defp require_assignment_match(result, assignment) do
    cond do
      result["assignmentId"] != assignment["id"] and result["assignment_id"] != assignment["id"] ->
        {:error, "assignment_mismatch"}

      result["runId"] != assignment["run_id"] and result["run_id"] != assignment["run_id"] ->
        {:error, "run_mismatch"}

      result["runnerId"] != assignment["runner_id"] and
          result["runner_id"] != assignment["runner_id"] ->
        {:error, "runner_mismatch"}

      true ->
        :ok
    end
  end

  defp require_base_match(result, assignment) do
    base_sha = result["baseSha"] || result["base_sha"]

    if base_sha == assignment["base_sha"] do
      :ok
    else
      {:error, "base_sha_mismatch"}
    end
  end

  defp require_format(%{"format" => "git_diff", "encoding" => "utf8"}), do: :ok
  defp require_format(_bundle), do: {:error, "unsupported_patch_bundle"}

  defp require_patch_body(diff) when is_binary(diff) do
    if String.trim(diff) == "", do: {:error, "empty_patch"}, else: :ok
  end

  defp require_patch_body(_diff), do: {:error, "missing_patch"}

  defp require_patch_size(diff) do
    if byte_size(diff) <= @max_patch_bytes, do: :ok, else: {:error, "patch_too_large"}
  end

  defp require_digest(bundle, digest) do
    case bundle["sha256"] do
      nil -> :ok
      ^digest -> :ok
      _other -> {:error, "patch_digest_mismatch"}
    end
  end

  defp require_changed_files_digest(result, paths) do
    expected = result["changedFilesDigest"] || result["changed_files_digest"]
    actual = changed_files_digest(paths)

    case expected do
      nil -> :ok
      ^actual -> :ok
      _other -> {:error, "changed_files_digest_mismatch"}
    end
  end

  defp reject_binary(diff) do
    cond do
      String.contains?(diff, "GIT binary patch") -> {:error, "binary_patch_rejected"}
      String.contains?(diff, "Binary files ") -> {:error, "binary_patch_rejected"}
      String.contains?(diff, "new file mode 120000") -> {:error, "symlink_patch_rejected"}
      String.contains?(diff, "old mode 120000") -> {:error, "symlink_patch_rejected"}
      String.contains?(diff, "deleted file mode 120000") -> {:error, "symlink_patch_rejected"}
      true -> :ok
    end
  end

  defp parse_paths(diff) do
    paths =
      diff
      |> String.split("\n")
      |> Enum.flat_map(&paths_from_line/1)
      |> Enum.reject(&(&1 in [nil, "", "/dev/null"]))
      |> Enum.uniq()
      |> Enum.sort()

    if paths == [], do: {:error, "empty_patch"}, else: {:ok, paths}
  end

  defp paths_from_line("diff --git " <> rest) do
    case String.split(rest, " b/", parts: 2) do
      ["a/" <> left, right] -> [unquote_path(left), unquote_path(right)]
      _ -> []
    end
  end

  defp paths_from_line("rename from " <> path), do: [unquote_path(path)]
  defp paths_from_line("rename to " <> path), do: [unquote_path(path)]
  defp paths_from_line("--- a/" <> path), do: [unquote_path(path)]
  defp paths_from_line("+++ b/" <> path), do: [unquote_path(path)]
  defp paths_from_line(_line), do: []

  defp normalize_changed_files(values) do
    values
    |> List.wrap()
    |> Enum.flat_map(fn
      %{"path" => path} -> [normalize_path(path)]
      %{path: path} -> [normalize_path(path)]
      path when is_binary(path) -> [normalize_path(path)]
      _other -> []
    end)
    |> Enum.reject(&blank?/1)
    |> Enum.uniq()
    |> Enum.sort()
  end

  defp require_changed_file_match([], _parsed_paths), do: :ok

  defp require_changed_file_match(changed_paths, parsed_paths) do
    if MapSet.new(changed_paths) == MapSet.new(parsed_paths) do
      :ok
    else
      {:error, "changed_files_mismatch"}
    end
  end

  defp require_file_count(paths) do
    if length(paths) <= @max_changed_files, do: :ok, else: {:error, "too_many_changed_files"}
  end

  defp validate_paths(paths) do
    Enum.reduce_while(paths, :ok, fn path, :ok ->
      case validate_path(path) do
        :ok -> {:cont, :ok}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
  end

  defp validate_path(path) do
    normalized = normalize_path(path)

    cond do
      blank?(normalized) ->
        {:error, "invalid_patch_path"}

      Path.type(normalized) == :absolute ->
        {:error, "absolute_path_rejected"}

      ".." in Path.split(normalized) ->
        {:error, "path_traversal_rejected"}

      protected_path?(normalized) ->
        {:error, "protected_path_rejected"}

      true ->
        :ok
    end
  end

  defp protected_path?(path) do
    normalized = normalize_path(path)

    MapSet.member?(@protected_files, normalized) or ChangeDetector.excluded?(normalized) or
      Enum.any?(@protected_prefixes, &String.starts_with?(normalized, &1))
  end

  defp normalize_path(path) when is_binary(path) do
    path
    |> unquote_path()
    |> Path.split()
    |> Path.join()
  end

  defp normalize_path(_path), do: nil

  defp unquote_path(path) when is_binary(path) do
    path
    |> String.trim()
    |> String.trim("\"")
  end

  defp blank?(value), do: is_nil(value) or (is_binary(value) and String.trim(value) == "")
end
