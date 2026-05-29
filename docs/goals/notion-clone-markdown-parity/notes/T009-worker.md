# T009 Worker Receipt

Status: done

Objective:
- Add a Notion-like docs page tree to the existing sidebar, with immediate Untitled creation, archive/delete actions, and a trash popover that can restore or permanently delete archived docs using the existing markdown pages API.

Files changed:
- `lib/docs-store.tsx`
- `components/sidebar/doc-tree.tsx`
- `components/page-editor.tsx`

What changed:
- `DocsProvider` now keeps active and archived docs separate while still using the repo-backed pages API for `doc` pages.
- Sidebar `DocTree` now renders generic docs under a `Pages` section with nested parent/child display.
- Added one-click Untitled page creation from the sidebar root and from an existing page.
- Added per-page delete/archive action that moves docs out of the active tree.
- Added a sidebar Trash popover with restore and permanent delete actions.
- Archived docs are excluded from page lists and direct page rendering.

Verification:
- `npm run build` -> passed.
- `git diff --check` -> passed.

Notes:
- This slice did not change backend routes; it used the T003 pages API.
- Browser-level create/edit/delete/reload proof is still outstanding and must not be treated as complete.
