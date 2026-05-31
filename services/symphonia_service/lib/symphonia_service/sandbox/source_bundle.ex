defmodule SymphoniaService.Sandbox.SourceBundle do
  @moduledoc """
  Builds source-bundle archives for sandbox preparation.

  The bundle is based on a git tree so untracked local state is not included,
  then a conservative denylist removes private Symphonia/runtime material.
  """

  @exclude_pathspecs [
    ":(exclude).git",
    ":(exclude).symphonia",
    ":(exclude)symphonia/tasks",
    ":(exclude)symphonia/run-summaries",
    ":(exclude)symphonia/runs",
    ":(exclude)symphonia/audit",
    ":(exclude)symphonia/provider-output",
    ":(exclude)symphonia/terminal-logs",
    ":(exclude)symphonia/validation-logs",
    ":(exclude)audit",
    ":(exclude)provider-output",
    ":(exclude)terminal-logs",
    ":(exclude)validation-logs",
    ":(exclude).env",
    ":(exclude).env.*",
    ":(exclude)node_modules",
    ":(exclude).next",
    ":(exclude)dist",
    ":(exclude)build",
    ":(exclude)coverage",
    ":(exclude)tmp",
    ":(exclude)cache",
    ":(exclude).cache"
  ]

  def exclude_pathspecs, do: @exclude_pathspecs

  def archive(repository, assignment) when is_map(repository) and is_map(assignment) do
    repo_path = repository["path"]
    base_sha = assignment["base_sha"]

    archive_path =
      Path.join(System.tmp_dir!(), "symphonia-source-#{System.unique_integer([:positive])}.tar")

    args =
      [
        "-C",
        repo_path,
        "archive",
        "--format=tar",
        "--output",
        archive_path,
        base_sha,
        "--",
        "."
      ] ++ @exclude_pathspecs

    with true <- is_binary(repo_path) and repo_path != "",
         true <- is_binary(base_sha) and base_sha != "",
         {_, 0} <- System.cmd("git", args, stderr_to_stdout: true),
         {:ok, body} <- File.read(archive_path) do
      File.rm(archive_path)
      {:ok, body}
    else
      _other ->
        File.rm(archive_path)
        {:error, "source_bundle_failed"}
    end
  rescue
    _error -> {:error, "source_bundle_failed"}
  end
end
