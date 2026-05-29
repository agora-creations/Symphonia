# T010 Judge Receipt

Status: done

Audit result:
- `not_complete`

Completed slice evidence:
- T009 added a sidebar `Pages` section, immediate Untitled creation, page nesting display, archive/delete, and Trash restore/permanent delete controls.
- Verification passed:
  - `npm run build` -> passed.
  - `git diff --check` -> passed.

Remaining frontend gaps:
- Saved doc pages still lack the visible `Publish` and ellipsis page actions from the reference screenshots.
- The explicit draft save path can still read stale local editor state because the editor flushes through React state and immediately calls `saveDraft`.
- Browser-level proof for create/list/edit/delete/reload remains missing.

Remaining backend gaps:
- No new backend route gap is required for publish metadata: T003 stores and patches `published` / `isPublished`.
- No new backend route gap is required for delete/archive/trash after T003 and T009.

Next allowed task:
- Add saved-doc `Publish` and ellipsis actions to the current Markdown editor, and make explicit draft saving pass the latest editor values directly into the save path.

Allowed files:
- `components/editor/markdown-editor.tsx`
- `components/draft-host.tsx`
- `lib/docs-store.tsx`

Verify:
- `npm run build`
- `git diff --check`

Stop if:
- The implementation needs a rich-text editor dependency.
- The implementation needs backend route changes.
- The implementation needs files outside the allowed set.
- Verification fails twice with the same unresolved cause.

Why this next:
- The backend, sidebar lifecycle, and slash menu are now present. The reference top page actions and the stale draft-save risk are the remaining concrete implementation gaps before runtime proof can be meaningful.
