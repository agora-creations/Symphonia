defmodule SymphoniaService.Sandbox.Result do
  @moduledoc """
  Builds Remote Runner V1-compatible sandbox results.
  """

  alias SymphoniaService.Runners.PatchBundle

  def completed(assignment, diff, changed_files, opts \\ [])
      when is_map(assignment) and is_binary(diff) and is_list(changed_files) do
    paths = Enum.map(changed_files, &path_for/1)

    %{
      "assignmentId" => assignment["id"],
      "runId" => assignment["run_id"],
      "runnerId" => assignment["runner_id"],
      "status" => "completed",
      "baseSha" => assignment["base_sha"],
      "headSha" => Keyword.get(opts, :head_sha, "sandbox-head"),
      "patchBundle" => %{
        "format" => "git_diff",
        "encoding" => "utf8",
        "sha256" => PatchBundle.sha256(diff),
        "diff" => diff
      },
      "changedFiles" => changed_files,
      "changedFilesDigest" => PatchBundle.changed_files_digest(paths),
      "publicTimeline" =>
        Keyword.get(opts, :public_timeline, [
          %{
            "step" => "running_in_sandbox",
            "message" => "Sandbox completed the Coding Assistant turn."
          }
        ]),
      "publicSummary" =>
        Keyword.get(opts, :public_summary, "Sandbox produced a reviewable patch.")
    }
  end

  defp path_for(%{"path" => path}) when is_binary(path), do: path
  defp path_for(%{path: path}) when is_binary(path), do: path
  defp path_for(path) when is_binary(path), do: path
  defp path_for(_value), do: ""
end
