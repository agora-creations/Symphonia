# T011 Worker Receipt

Status: done

Objective:
- Add saved-doc Publish and ellipsis actions to the current Markdown editor, and make explicit draft saving pass the latest editor values directly into the save path.

Files changed:
- `components/editor/markdown-editor.tsx`
- `components/draft-host.tsx`
- `lib/docs-store.tsx`

What changed:
- Saved docs now show a `Publish` / `Published` button that patches page publish metadata through the existing docs store and pages API.
- Saved docs now show an ellipsis page-action menu with `Delete`, which archives the page and routes back to the docs list.
- The editor now centralizes current title/body/icon/cover/published persistence through a single flush path.
- Explicit draft save now passes the latest editor values directly to `saveDraft`, avoiding stale React state when a user saves immediately after editing.

Verification:
- `npm run build` -> passed.
- `git diff --check` -> passed.

Notes:
- This slice did not add backend routes; publish/delete uses the existing T003 and T009 contracts.
- Browser-level create/list/edit/delete/reload proof is now the main remaining requirement.
