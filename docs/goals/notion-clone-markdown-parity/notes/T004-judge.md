# T004 Judge Receipt

Status: done

Audit result:
- `not_complete`

Completed slice evidence:
- T003 added a repo-backed generic markdown page service/API and Next proxies.
- Verification passed:
  - `cd services/symphonia_service && mix test test/markdown_pages_test.exs` -> 6 tests, 0 failures.
  - `npm run build` -> passed, including the new pages API routes.
  - `git diff --check` -> passed.

Remaining frontend gaps:
- The active docs UI still reads from `DocsProvider` local state/localStorage instead of the new service API.
- New doc creation still opens a full-screen local draft and saves to local state.
- The sidebar document tree does not show generic docs pages or immediate Untitled page creation.
- The editor still lacks the screenshot slash menu and block-row handles.
- Delete/trash UI for generic docs is not wired.

Remaining backend gaps:
- The backend page lifecycle exists, but the frontend has not used it yet, so browser-level create/list/edit/delete persistence is not proven.

Next allowed task:
- Execute a frontend persistence bridge: make the current docs creation/list/read/edit path use the new markdown pages API for `doc` pages while preserving local behavior for non-doc categories and workflow/spec artifacts.

Allowed files:
- `app/r/[repoKey]/layout.tsx`
- `lib/docs-store.tsx`
- `components/draft-host.tsx`
- `components/doc-list-view.tsx`
- `components/page-editor.tsx`

Verify:
- `npm run build`
- `git diff --check`

Stop if:
- The slice needs sidebar tree redesign, slash-command UI, or delete/trash UI.
- The slice needs backend files beyond the API added in T003.
- The slice needs localStorage migration or destructive deletion of user browser data.
- The implementation conflicts with unrelated dirty files.

Why this next:
- Backend parity is now present but unused by the visible docs flow. Wiring the existing docs path to the API is the smallest next step that makes the requested durable create/list/edit behavior more true without prematurely redesigning the sidebar/editor.
