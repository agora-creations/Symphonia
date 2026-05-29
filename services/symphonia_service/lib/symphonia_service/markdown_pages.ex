defmodule SymphoniaService.MarkdownPages do
  @moduledoc """
  Repo-backed generic Markdown page store.

  This is the durable page contract for Notion-like document editing. It keeps
  ordinary pages separate from spec workspace artifacts while reusing the same
  Markdown frontmatter parser/serializer.
  """

  alias SymphoniaService.Markdown

  @directory "symphonia/docs"
  @page_type "page"
  @prefix "page"

  def directory, do: @directory

  def list_pages(repository, opts \\ []) do
    include_archived? = Keyword.get(opts, :include_archived, false)
    dir = pages_dir(repository)

    dir
    |> Path.join("*.md")
    |> Path.wildcard()
    |> Enum.filter(&File.exists?/1)
    |> Enum.sort()
    |> Enum.map(&read_path(repository, &1))
    |> Enum.reject(fn page -> page["isArchived"] and not include_archived? end)
  end

  def read_page(repository, id) do
    id = validate_id!(id)
    path = page_path!(repository, id)
    read_path(repository, path)
  end

  def create_page(repository, attrs \\ %{}) when is_map(attrs) do
    id = attrs |> Map.get("id", next_id(repository)) |> validate_id!()
    path = page_path(repository, id)

    if File.exists?(path), do: raise(ArgumentError, "Markdown page already exists.")

    File.mkdir_p!(Path.dirname(path))

    attrs =
      attrs
      |> Map.put_new("title", "Untitled")
      |> Map.put_new("body", "")
      |> Map.put_new("isArchived", false)
      |> Map.put_new("isPublished", false)

    frontmatter = new_frontmatter(id, attrs)
    File.write!(path, Markdown.serialize(frontmatter, Map.get(attrs, "body", "")))
    read_path(repository, path)
  end

  def update_page(repository, id, patch) when is_map(patch) do
    page = read_page(repository, id)
    body = Map.get(patch, "body", page["body"])
    metadata_patch = metadata_patch(patch)

    frontmatter =
      page["metadata"]
      |> merge_metadata!(page["id"], metadata_patch)
      |> Map.put("updated_at", now())

    path = Path.join(repository["path"], page["path"])
    File.write!(path, Markdown.serialize(frontmatter, body))
    read_path(repository, path)
  end

  def archive_page(repository, id) do
    update_page(repository, id, %{"isArchived" => true})
  end

  def delete_page(repository, id) do
    id = validate_id!(id)
    path = page_path!(repository, id)
    File.rm!(path)
    %{"id" => id, "deleted" => true}
  end

  def next_id(repository) do
    used =
      pages_dir(repository)
      |> Path.join("*.md")
      |> Path.wildcard()
      |> Enum.reduce(MapSet.new(), fn path, used ->
        path
        |> ids_for_file()
        |> Enum.reduce(used, fn id, acc ->
          case number_for_id(id) do
            nil -> acc
            number -> MapSet.put(acc, number)
          end
        end)
      end)

    number =
      used
      |> MapSet.to_list()
      |> Enum.max(fn -> 0 end)
      |> Kernel.+(1)

    "#{@prefix}-#{String.pad_leading(Integer.to_string(number), 3, "0")}"
  end

  defp read_path(repository, path) do
    parsed = path |> File.read!() |> Markdown.parse()
    metadata = normalize_metadata(parsed.frontmatter, path, parsed.body)

    %{
      "type" => @page_type,
      "id" => metadata["id"],
      "title" => metadata["title"],
      "body" => parsed.body,
      "path" => Path.relative_to(path, repository["path"]),
      "parentId" => metadata["parent_id"],
      "icon" => metadata["icon"],
      "cover" => metadata["cover"],
      "isArchived" => metadata["archived"] == true,
      "isPublished" => metadata["published"] == true,
      "createdAt" => metadata["created_at"],
      "updatedAt" => metadata["updated_at"],
      "metadata" => metadata
    }
    |> Enum.reject(fn {_key, value} -> is_nil(value) end)
    |> Map.new()
  end

  defp normalize_metadata(frontmatter, path, body) do
    id = frontmatter["id"] || Path.basename(path, ".md")
    title = frontmatter["title"] || title_from_body(body) || "Untitled"

    frontmatter
    |> Map.put_new("type", @page_type)
    |> Map.put_new("id", id)
    |> Map.put_new("title", title)
    |> Map.put_new("archived", false)
    |> Map.put_new("published", false)
  end

  defp new_frontmatter(id, attrs) do
    timestamp = now()

    %{
      "type" => @page_type,
      "id" => id,
      "title" => clean_title(Map.get(attrs, "title")),
      "parent_id" => Map.get(attrs, "parentId") || Map.get(attrs, "parent_id"),
      "icon" => Map.get(attrs, "icon"),
      "cover" => Map.get(attrs, "cover"),
      "archived" => bool_value(Map.get(attrs, "isArchived", Map.get(attrs, "archived", false))),
      "published" =>
        bool_value(Map.get(attrs, "isPublished", Map.get(attrs, "published", false))),
      "created_at" => Map.get(attrs, "createdAt") || Map.get(attrs, "created_at") || timestamp,
      "updated_at" => Map.get(attrs, "updatedAt") || Map.get(attrs, "updated_at") || timestamp
    }
    |> Enum.reject(fn {_key, value} -> is_nil(value) end)
    |> Map.new()
  end

  defp metadata_patch(patch) do
    patch
    |> Map.get("metadata", patch)
    |> Enum.map(fn {key, value} -> {to_string(key), value} end)
    |> Map.new()
    |> Map.take([
      "title",
      "parentId",
      "parent_id",
      "icon",
      "cover",
      "isArchived",
      "isPublished",
      "archived",
      "published",
      "type",
      "id"
    ])
  end

  defp merge_metadata!(frontmatter, id, patch) when is_map(patch) do
    if Map.has_key?(patch, "type") and patch["type"] != @page_type do
      raise ArgumentError, "Markdown page type cannot be changed."
    end

    if Map.has_key?(patch, "id") and patch["id"] != id do
      raise ArgumentError, "Markdown page id cannot be changed."
    end

    normalized =
      %{}
      |> maybe_put(
        "title",
        if(Map.has_key?(patch, "title"), do: clean_title(Map.get(patch, "title")))
      )
      |> maybe_put("parent_id", Map.get(patch, "parentId") || Map.get(patch, "parent_id"))
      |> maybe_put("icon", Map.get(patch, "icon"))
      |> maybe_put("cover", Map.get(patch, "cover"))
      |> maybe_put_bool("archived", Map.get(patch, "isArchived", Map.get(patch, "archived")))
      |> maybe_put_bool("published", Map.get(patch, "isPublished", Map.get(patch, "published")))

    frontmatter
    |> Map.merge(normalized)
    |> Map.put("type", @page_type)
    |> Map.put("id", id)
    |> Map.put_new("title", "Untitled")
    |> Map.put_new("archived", false)
    |> Map.put_new("published", false)
  end

  defp merge_metadata!(_frontmatter, _id, _patch) do
    raise ArgumentError, "Markdown page metadata must be an object."
  end

  defp pages_dir(repository), do: Path.join(repository["path"], @directory)
  defp page_path(repository, id), do: Path.join([repository["path"], @directory, "#{id}.md"])

  defp page_path!(repository, id) do
    direct = page_path(repository, id)

    cond do
      File.exists?(direct) ->
        direct

      path = path_for_frontmatter_id(repository, id) ->
        path

      true ->
        raise ArgumentError, "Markdown page not found."
    end
  end

  defp path_for_frontmatter_id(repository, id) do
    repository
    |> pages_dir()
    |> Path.join("*.md")
    |> Path.wildcard()
    |> Enum.find(fn path ->
      path
      |> File.read!()
      |> Markdown.parse()
      |> Map.get(:frontmatter)
      |> Map.get("id") == id
    end)
  end

  defp validate_id!(id) when is_binary(id) do
    if id == "" or String.contains?(id, ["..", "/", "\\"]) or
         not Regex.match?(~r/^[A-Za-z0-9._-]+$/, id) do
      raise ArgumentError, "Unsafe markdown page id."
    end

    id
  end

  defp validate_id!(_id), do: raise(ArgumentError, "Unsafe markdown page id.")

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

  defp ids_for_file(path) do
    frontmatter_id =
      path
      |> File.read!()
      |> Markdown.parse()
      |> Map.get(:frontmatter)
      |> Map.get("id")

    [Path.basename(path, ".md"), frontmatter_id]
    |> Enum.reject(&is_nil/1)
  end

  defp number_for_id(nil), do: nil

  defp number_for_id(value) when is_binary(value) do
    case Regex.run(~r/^#{Regex.escape(@prefix)}-(\d+)$/, value) do
      [_all, number] -> String.to_integer(number)
      _ -> nil
    end
  end

  defp clean_title(nil), do: "Untitled"

  defp clean_title(title) when is_binary(title),
    do: if(String.trim(title) == "", do: "Untitled", else: title)

  defp clean_title(title), do: title |> to_string() |> clean_title()

  defp maybe_put(map, _key, nil), do: map
  defp maybe_put(map, key, value), do: Map.put(map, key, value)

  defp maybe_put_bool(map, _key, nil), do: map
  defp maybe_put_bool(map, key, value), do: Map.put(map, key, bool_value(value))

  defp bool_value(true), do: true
  defp bool_value(false), do: false
  defp bool_value("true"), do: true
  defp bool_value("false"), do: false
  defp bool_value(value), do: value == true

  defp now, do: DateTime.utc_now() |> DateTime.truncate(:second) |> DateTime.to_iso8601()
end
