defmodule SymphoniaService.Harness.TaskWorkspace do
  @moduledoc """
  Stable local workspace paths for daemon-driven task execution.
  """

  def path(repository, task_or_key, opts \\ []) do
    task_key =
      case task_or_key do
        %{"key" => key} -> key
        key -> key
      end

    Path.join([
      root(opts),
      slug(repository["key"] || repository["name"] || "repo"),
      slug(task_key)
    ])
  end

  def root(opts \\ []) do
    Keyword.get(opts, :root) ||
      System.get_env("SYMPHONIA_WORKSPACES_ROOT") ||
      Path.join([System.user_home!(), ".symphonia", "task-workspaces"])
  end

  defp slug(value) do
    value
    |> to_string()
    |> String.downcase()
    |> String.replace(~r/[^a-z0-9._-]/, "-")
    |> String.trim("-")
    |> case do
      "" -> "item"
      slug -> slug
    end
  end
end
