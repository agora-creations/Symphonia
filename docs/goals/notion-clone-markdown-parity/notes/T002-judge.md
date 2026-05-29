# T002 Judge Receipt

Status: done

Decision:
- Choose the backend markdown page contract as the first Worker slice.
- Rationale: the original outcome requires create/list/edit/delete persistence. Current generic DocsProvider pages are localStorage-only, while the repo-backed service only covers typed planning artifacts. A frontend-only Notion restyle would preserve the exact likely misfire.

Worker objective:
- Add a repo-backed generic markdown page API for document pages, with service tests and thin Next API proxies. The API must support create, list, read, update, and delete/archive semantics for pages under repository markdown paths, without changing existing spec workspace artifact semantics.

Allowed files:
- `services/symphonia_service/lib/symphonia_service/markdown_pages.ex`
- `services/symphonia_service/lib/symphonia_service/http_server.ex`
- `services/symphonia_service/test/markdown_pages_test.exs`
- `app/api/repositories/[repoKey]/pages/route.ts`
- `app/api/repositories/[repoKey]/pages/[pageId]/route.ts`
- `lib/repository-model.ts`

Verify:
- `cd services/symphonia_service && mix test test/markdown_pages_test.exs`
- `npm run build`
- `git diff --check`

Stop if:
- The implementation needs to edit existing frontend editor/sidebar behavior.
- It needs to migrate existing user localStorage data.
- It needs to change spec workspace artifact semantics or Clarise private artifact behavior.
- It conflicts with unrelated dirty files already in the worktree.
- Verification fails twice with the same unresolved cause.

Remaining parity gaps after this slice:
- Hydrate `DocsProvider` from the new service API instead of localStorage.
- Make the docs/page workspace first-screen Notion-like, including sidebar pages and immediate Untitled creation.
- Add delete/trash/restore UI and route behavior.
- Add slash-command menu and block-like editor affordances.
- Run browser proof for create/list/edit/delete/reload/slash flow.
