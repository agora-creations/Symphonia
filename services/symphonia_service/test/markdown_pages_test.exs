defmodule SymphoniaService.MarkdownPagesTest do
  use ExUnit.Case

  alias SymphoniaService.{HTTPServer, MarkdownPages}

  setup do
    root =
      Path.join(
        System.tmp_dir!(),
        "symphonia-markdown-pages-test-#{System.unique_integer([:positive])}"
      )

    repo_path = Path.join(root, "repo")
    File.mkdir_p!(repo_path)

    on_exit(fn -> File.rm_rf(root) end)

    %{
      root: root,
      repository: %{
        "key" => "SYM",
        "name" => "repo",
        "path" => repo_path,
        "last_task_number" => 0
      }
    }
  end

  test "creates, lists, reads, and updates repo-backed markdown pages", %{repository: repository} do
    page =
      MarkdownPages.create_page(repository, %{
        "title" => "Architecture notes",
        "body" => "# Architecture notes\n\nInitial body.",
        "icon" => "doc",
        "isPublished" => false
      })

    assert page["id"] == "page-001"
    assert page["path"] == "symphonia/docs/page-001.md"
    assert page["title"] == "Architecture notes"
    assert page["body"] =~ "Initial body"
    assert page["isArchived"] == false
    assert page["isPublished"] == false
    assert page["metadata"]["type"] == "page"
    assert File.exists?(Path.join(repository["path"], page["path"]))

    assert [listed] = MarkdownPages.list_pages(repository)
    assert listed["id"] == page["id"]

    read = MarkdownPages.read_page(repository, page["id"])
    assert read["title"] == "Architecture notes"

    updated =
      MarkdownPages.update_page(repository, page["id"], %{
        "title" => "Edited notes",
        "body" => "# Edited notes\n\nUpdated body.",
        "isPublished" => true
      })

    assert updated["title"] == "Edited notes"
    assert updated["body"] =~ "Updated body"
    assert updated["isPublished"] == true
    assert updated["metadata"]["id"] == page["id"]
    assert updated["metadata"]["created_at"] == read["metadata"]["created_at"]
    assert updated["metadata"]["updated_at"]
  end

  test "generates collision-safe ids from file names and frontmatter", %{repository: repository} do
    dir = Path.join(repository["path"], "symphonia/docs")
    File.mkdir_p!(dir)

    File.write!(Path.join(dir, "page-001.md"), "# Existing\n")

    File.write!(Path.join(dir, "custom.md"), """
    ---
    type: page
    id: page-007
    title: Existing seven
    ---

    # Existing
    """)

    page = MarkdownPages.create_page(repository, %{"title" => "Next page"})

    assert page["id"] == "page-008"
    assert page["path"] == "symphonia/docs/page-008.md"

    assert MarkdownPages.read_page(repository, "page-007")["path"] == "symphonia/docs/custom.md"
  end

  test "archives by default and can permanently delete pages", %{repository: repository} do
    page = MarkdownPages.create_page(repository, %{"title" => "Trash me"})

    archived = MarkdownPages.archive_page(repository, page["id"])
    assert archived["isArchived"] == true

    assert MarkdownPages.list_pages(repository) == []
    assert [trash] = MarkdownPages.list_pages(repository, include_archived: true)
    assert trash["id"] == page["id"]

    restored = MarkdownPages.update_page(repository, page["id"], %{"isArchived" => false})
    assert restored["isArchived"] == false

    assert %{"deleted" => true} = MarkdownPages.delete_page(repository, page["id"])
    assert MarkdownPages.list_pages(repository, include_archived: true) == []
    refute File.exists?(Path.join(repository["path"], "symphonia/docs/#{page["id"]}.md"))
  end

  test "reads existing markdown files without frontmatter as pages", %{repository: repository} do
    path = Path.join(repository["path"], "symphonia/docs/architecture.md")
    File.mkdir_p!(Path.dirname(path))
    File.write!(path, "# Architecture\n\nExisting body.")

    assert [page] = MarkdownPages.list_pages(repository)
    assert page["id"] == "architecture"
    assert page["title"] == "Architecture"
    assert page["body"] =~ "Existing body"
    assert page["isArchived"] == false
  end

  test "rejects unsafe ids and metadata identity changes", %{repository: repository} do
    page = MarkdownPages.create_page(repository, %{"title" => "Safe"})

    assert_raise ArgumentError, "Unsafe markdown page id.", fn ->
      MarkdownPages.read_page(repository, "../secret")
    end

    assert_raise ArgumentError, "Markdown page id cannot be changed.", fn ->
      MarkdownPages.update_page(repository, page["id"], %{"metadata" => %{"id" => "page-999"}})
    end

    assert_raise ArgumentError, "Markdown page type cannot be changed.", fn ->
      MarkdownPages.update_page(repository, page["id"], %{"metadata" => %{"type" => "decision"}})
    end
  end

  test "HTTP routes expose page lifecycle", %{repository: repository, root: root} do
    registry_path = Path.join(root, "repositories.json")
    File.write!(registry_path, JSON.encode!(%{"repositories" => [repository]}))

    port = free_port()
    {:ok, server} = HTTPServer.start_link(port: port, registry_path: registry_path)
    on_exit(fn -> Process.exit(server, :kill) end)

    {201, created} =
      request(port, "POST", "/api/repositories/SYM/pages", %{
        "title" => "HTTP page",
        "body" => "# HTTP page\n\nCreated through the API."
      })

    page_id = created["page"]["id"]
    assert created["page"]["path"] == "symphonia/docs/#{page_id}.md"

    {200, listed} = request(port, "GET", "/api/repositories/SYM/pages")
    assert [page] = listed["pages"]
    assert page["id"] == page_id

    {200, updated} =
      request(port, "PATCH", "/api/repositories/SYM/pages/#{page_id}", %{
        "body" => "# HTTP page\n\nUpdated through the API.",
        "isPublished" => true
      })

    assert updated["page"]["title"] == "HTTP page"
    assert updated["page"]["isPublished"] == true
    assert updated["page"]["body"] =~ "Updated through the API"

    {200, archived} = request(port, "DELETE", "/api/repositories/SYM/pages/#{page_id}")
    assert archived["page"]["isArchived"] == true

    {200, empty} = request(port, "GET", "/api/repositories/SYM/pages")
    assert empty["pages"] == []

    {200, trash} = request(port, "GET", "/api/repositories/SYM/pages?includeArchived=true")
    assert [archived_page] = trash["pages"]
    assert archived_page["id"] == page_id

    {200, deleted} =
      request(port, "DELETE", "/api/repositories/SYM/pages/#{page_id}?permanent=true")

    assert deleted["page"]["deleted"] == true
  end

  defp free_port do
    {:ok, socket} = :gen_tcp.listen(0, [:binary, active: false])
    {:ok, port} = :inet.port(socket)
    :gen_tcp.close(socket)
    port
  end

  defp request(port, method, path, payload \\ nil) do
    {:ok, socket} = :gen_tcp.connect(~c"127.0.0.1", port, [:binary, active: false])
    body = if is_nil(payload), do: "", else: JSON.encode!(payload)

    request =
      [
        "#{method} #{path} HTTP/1.1\r\n",
        "host: 127.0.0.1\r\n",
        "content-type: application/json\r\n",
        "content-length: #{byte_size(body)}\r\n",
        "connection: close\r\n",
        "\r\n",
        body
      ]

    :ok = :gen_tcp.send(socket, request)
    response = recv_all(socket, "")
    :gen_tcp.close(socket)

    [head, response_body] = String.split(response, "\r\n\r\n", parts: 2)
    [status_line | _headers] = String.split(head, "\r\n")
    [_version, status, _reason] = String.split(status_line, " ", parts: 3)
    {String.to_integer(status), JSON.decode!(response_body)}
  end

  defp recv_all(socket, acc) do
    case :gen_tcp.recv(socket, 0, 5_000) do
      {:ok, chunk} -> recv_all(socket, acc <> chunk)
      {:error, :closed} -> acc
    end
  end
end
