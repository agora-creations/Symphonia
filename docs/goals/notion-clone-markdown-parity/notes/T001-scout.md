# T001 Scout Receipt

Status: done

GoalBuddy update check:
- Ran `node /Users/diegomarono/.codex/skills/goalbuddy/scripts/check-update.mjs --json`.
- Result: no newer version reported; checker status was `unavailable` because `npm` timed out.

Current frontend markdown/page entry points:
- `app/r/[repoKey]/layout.tsx` mounts `DocsProvider`, `DraftHost`, `RepoLayoutClient`, `AppSidebar`, and `Clarise`.
- `components/sidebar/sidebar-body.tsx` owns the repository shell sidebar and toggles `DocTree`.
- `components/sidebar/doc-tree.tsx` fetches repo-backed spec workspace artifacts from `/api/repositories/:repoKey/spec-workspace`, but does not list `lib/docs-store.tsx` docs pages.
- `components/doc-list-view.tsx` renders Docs/Decisions/Reviews/Run Summaries list pages and starts drafts through `DraftHost`.
- `components/draft-host.tsx` opens full-screen drafts and saves them into `DocsProvider`.
- `components/page-editor.tsx` loads saved `DocPage` objects from `DocsProvider`.
- `components/editor/markdown-editor.tsx` is the generic page editor: title/body/icon/cover, debounced autosave, Cmd/Ctrl+S flush, and a small formatting toolbar over a raw Markdown `<textarea>`.
- `components/spec-artifact-editor.tsx` edits repo-backed planning artifacts through the service API, with title/status/body and explicit `Save changes`.

Current backend/API/storage contracts:
- `lib/docs-store.tsx` is client-only. It persists `DocPage[]` to `localStorage` under `symphonia.docs.v1`, seeded from hard-coded pages. It has create/update/save draft functions, but no HTTP API, no repo filesystem write, and no delete/archive contract.
- `app/api/repositories/[repoKey]/spec-workspace/*` proxies to the Elixir service for planning artifacts.
- `services/symphonia_service/lib/symphonia_service/http_server.ex` exposes spec workspace list/read/create/update endpoints, but only for typed spec artifacts. It has no generic docs/page collection API and no delete/archive endpoint for artifacts.
- `services/symphonia_service/lib/symphonia_service/spec_workspace/store.ex` persists typed Markdown artifacts to repository files with frontmatter and supports initialize/list/read/create/update for collections such as milestones, requirements, plans, task briefs, and decisions.
- `services/symphonia_service/lib/symphonia_service/markdown.ex` parses and serializes the frontmatter/body Markdown contract.

Reference behavior summary:
- The linked repo `https://github.com/rlanrid/notion-clone.git` was cloned read-only to `/private/tmp/rlanrid-notion-clone`; HEAD was `8a590dcb658b91867250a632b1695bf251955c62`.
- Reference uses Next 13 + Convex + BlockNote. `convex/schema.ts` defines `documents` with title, userId, isArchived, parentDocument, content, coverImage, icon, and isPublished.
- `convex/documents.ts` implements create, getSidebar, getById, update, archive, restore, remove, getTrash, and getSearch.
- `app/(main)/_components/navigation.tsx`, `document-list.tsx`, and `item.tsx` implement the light sidebar, nested page list, New page/Add a page, item menu Delete, and Trash popover.
- `app/(main)/(routes)/documents/[documentId]/page.tsx`, `components/toolbar.tsx`, and `components/editor.tsx` implement the centered title/editor canvas with BlockNote slash menu and content persistence on editor changes.
- Screenshots/video show a light Notion-like sidebar, two Untitled pages, delete popover with last editor, Add a page and Trash, top Publish/ellipsis actions, centered title, placeholder `Enter text or type '/' for commands`, slash menu with Heading/H2/H3/Bullet List/Numbered List/Paragraph/Image, and block hover controls.
- The supplied dark screenshot shows Symphonia's current planning artifact editor: dark shell, breadcrumb `Planning / Plan / plan-002`, title/status selector, saved indicator, and raw Markdown textarea. That is the likely misfire target to avoid.

Frontend gaps:
- Symphonia's generic docs UI is still a section/list-first workspace, not the reference's first-screen page workspace with a sidebar page tree.
- `DocTree` lists spec artifacts only, not generic DocsProvider pages; `DocListView` pages live outside the sidebar tree.
- New page creation is a modal/full-screen draft flow with category choices, not an immediate Untitled page in the sidebar/editor.
- There is no Notion-style top bar on generic pages with Publish and ellipsis actions.
- The editor is a raw Markdown textarea with toolbar buttons. It does not provide block rows, hover block handles, inline slash-command menu, or image block affordance.
- Delete/archive/trash/restore UI exists in the reference but not for `DocsProvider` pages.

Backend gaps:
- Generic markdown pages are not durable repo-backed service objects; they are localStorage-only.
- There is no service route to create/list/read/update/delete generic markdown pages under `symphonia/docs/`.
- Existing spec workspace endpoints can create/list/read/update typed planning artifacts but do not cover generic docs, nested pages, page archive/trash, publish state, or delete.
- Backend persistence for the reference flow is therefore unverified and currently incomplete for generic docs.

Verification command and smoke candidates:
- Frontend/static: `npm run test:harness-ui`, `npm run build`, `git diff --check`.
- Backend: `cd services/symphonia_service && mix test`.
- Focused future backend smoke: start Elixir service, then verify `POST/GET/PATCH/DELETE` for a page API creates a Markdown file, lists it, edits it, and removes/archives it.
- Browser smoke candidate: start `npm run dev` on `http://localhost:3010`, open `/r/sym/docs` or the eventual page workspace route, create a new Untitled page, type title/body, use slash menu commands, reload, confirm persisted content/page list, delete page, confirm trash/list state.

Candidate Worker slices:
- Slice A: add a repo-backed service/page API for generic markdown pages using the existing Markdown serializer and repository registry. Likely files: new `services/symphonia_service/lib/symphonia_service/markdown_pages.ex`, `services/symphonia_service/lib/symphonia_service/http_server.ex`, Next API proxies under `app/api/repositories/[repoKey]/pages/...`, `lib/repository-model.ts`, focused Elixir tests.
- Slice B: replace/extend `DocsProvider` to hydrate generic docs from the service API and save through HTTP while retaining local draft ergonomics. Likely files: `lib/docs-store.tsx`, `components/draft-host.tsx`, `components/doc-list-view.tsx`, `components/page-editor.tsx`, focused frontend tests if added.
- Slice C: add Notion-like page sidebar create/list/delete/trash controls and route the first-screen docs workspace through it. Likely files: `components/sidebar/doc-tree.tsx`, `components/sidebar/sidebar-body.tsx`, `components/doc-list-view.tsx` or a new page workspace component.
- Slice D: add a slash-command menu to `MarkdownEditor` that inserts Markdown semantics for H1/H2/H3/bullets/numbered/paragraph/image and visually matches the screenshots. Likely files: `components/editor/markdown-editor.tsx`, maybe `app/globals.css`.

Recommended next task:
- T002 Judge should choose Slice A first because it directly addresses the likely misfire and backend parity requirement. Frontend polish without a durable page API would preserve the current localStorage-only end state.
