defmodule SymphoniaService.SpecWorkspace.Artifact do
  @moduledoc """
  Public shape for repo-backed spec artifacts.
  """

  def from_file(repository, type, path, parsed) do
    id = parsed.frontmatter["id"] || path |> Path.basename(".md")
    title = parsed.frontmatter["title"] || title_from_body(parsed.body) || id
    status = parsed.frontmatter["status"] || "draft"

    metadata =
      parsed.frontmatter
      |> Map.put_new("type", type)
      |> Map.put_new("id", id)
      |> Map.put_new("title", title)
      |> Map.put_new("status", status)

    %{
      "type" => type,
      "id" => id,
      "title" => title,
      "status" => status,
      "source" => metadata["source"],
      "createdAt" => metadata["created_at"],
      "updatedAt" => metadata["updated_at"],
      "path" => Path.relative_to(path, repository["path"]),
      "metadata" => metadata,
      "body" => parsed.body
    }
    |> Enum.reject(fn {_key, value} -> is_nil(value) end)
    |> Map.new()
  end

  def summary(artifact) do
    Map.drop(artifact, ["body"])
  end

  defp title_from_body(body) do
    body
    |> String.split("\n")
    |> Enum.find_value(fn line ->
      case Regex.run(~r/^#\s+(.+)$/, String.trim(line)) do
        [_all, title] -> title
        _ -> nil
      end
    end)
  end
end
