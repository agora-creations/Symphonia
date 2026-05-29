# T003 Worker Receipt

Status: done

Objective:
- Add a repo-backed generic markdown page API for document pages, with service tests and thin Next API proxies.

Files changed:
- `services/symphonia_service/lib/symphonia_service/markdown_pages.ex`
- `services/symphonia_service/lib/symphonia_service/http_server.ex`
- `services/symphonia_service/test/markdown_pages_test.exs`
- `app/api/repositories/[repoKey]/pages/route.ts`
- `app/api/repositories/[repoKey]/pages/[pageId]/route.ts`
- `lib/repository-model.ts`

What changed:
- Added `SymphoniaService.MarkdownPages`, a repo-backed generic page store under `symphonia/docs`.
- Added create/list/read/update/archive/permanent-delete operations using the existing Markdown frontmatter serializer.
- Preserved existing markdown files without frontmatter by treating them as readable pages with title derived from the first H1.
- Resolved pages by either filename id or frontmatter id so listed pages remain readable.
- Added service HTTP routes:
  - `GET /api/repositories/:repo/pages`
  - `POST /api/repositories/:repo/pages`
  - `GET /api/repositories/:repo/pages/:page_id`
  - `PATCH /api/repositories/:repo/pages/:page_id`
  - `DELETE /api/repositories/:repo/pages/:page_id`
  - `DELETE /api/repositories/:repo/pages/:page_id?permanent=true`
- Added thin Next proxies for `/api/repositories/[repoKey]/pages` and `/api/repositories/[repoKey]/pages/[pageId]`.
- Added shared TypeScript types for the page payload.

Verification:
- `cd services/symphonia_service && mix test test/markdown_pages_test.exs` -> 6 tests, 0 failures.
- `npm run build` -> passed; Next route table includes `/api/repositories/[repoKey]/pages` and `/api/repositories/[repoKey]/pages/[pageId]`.
- `git diff --check` -> passed.

Notes:
- This slice intentionally did not change the editor/sidebar UI or migrate `DocsProvider` away from localStorage.
- Existing spec workspace routes and artifact semantics were left unchanged.
