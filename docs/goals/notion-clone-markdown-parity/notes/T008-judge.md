# T008 Judge Receipt

Status: done

Audit result:
- `not_complete`

Completed slice evidence:
- T007 added the screenshot-target slash-command menu in the current Markdown editor.
- Verification passed:
  - `npm run build` -> passed.
  - `git diff --check` -> passed.
- Browser-plugin smoke was attempted but could not run because the in-app browser runtime reported `Browser is not available: iab`.

Remaining frontend gaps:
- The sidebar still does not show generic docs as a Notion-style page tree.
- New page creation still routes through the full-screen draft flow rather than immediately creating an Untitled sidebar page.
- Delete/trash/restore UI is still missing from the docs page lifecycle.
- Browser-level proof for create/list/edit/delete/reload is still missing.

Remaining backend gaps:
- No new backend route gap is required for archive/restore/delete: T003's page API supports archive by DELETE, unarchive by PATCH with `isArchived: false`, and permanent delete with `?permanent=true`.
- The full frontend-to-backend lifecycle still needs browser or HTTP proof after the UI is wired.

Next allowed task:
- Add a Notion-like docs page tree to the existing sidebar, with immediate Untitled creation, archive/delete actions, and a trash popover that can restore or permanently delete archived docs.

Allowed files:
- `lib/docs-store.tsx`
- `components/sidebar/doc-tree.tsx`
- `components/doc-list-view.tsx`
- `components/page-editor.tsx`

Verify:
- `npm run build`
- `git diff --check`

Stop if:
- The implementation needs backend changes beyond the T003 pages API.
- The implementation needs a new rich-text editor dependency.
- The implementation needs to redesign the whole app shell or replace planning artifact semantics.
- Browser runtime remains unavailable for proof; record that separately and continue with local build/diff verification.

Why this next:
- Backend persistence and slash commands now exist. The next largest screenshot/reference gap is the sidebar page lifecycle: visible pages, one-click Untitled creation, delete/archive, and Trash restore.
