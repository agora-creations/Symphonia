# T005 Worker Receipt

Status: done

Objective:
- Make the current docs creation/list/read/edit path use the new markdown pages API for `doc` pages while preserving local behavior for non-doc categories and workflow/spec artifacts.

Files changed:
- `app/r/[repoKey]/layout.tsx`
- `lib/docs-store.tsx`
- `components/draft-host.tsx`
- `components/doc-list-view.tsx`
- `components/page-editor.tsx`

What changed:
- `DocsProvider` now receives the active `repoKey`.
- On hydration, `DocsProvider` loads local pages as fallback, then replaces the active repo's generic `doc` pages with `/api/repositories/:repoKey/pages` when the service is available.
- Saving a `doc` draft now posts to `/api/repositories/:repoKey/pages` and routes to the service-backed page id.
- Editing a saved `doc` page now patches `/api/repositories/:repoKey/pages/:pageId` while keeping local state as an offline fallback.
- Existing non-doc categories continue to use the local store.
- Page/list views now show a loading state while docs hydration is pending.

Verification:
- `npm run build` -> passed.
- `git diff --check` -> passed.

Notes:
- This slice intentionally did not add sidebar page-tree controls, delete/trash UI, slash-command menu, or browser proof.
- Backend API semantics from T003 were reused without further backend changes.
