# T006 Judge Receipt

Status: done

Audit result:
- `not_complete`

Completed slice evidence:
- T005 connected the current docs flow to the repo-backed page API for `doc` pages.
- Verification passed:
  - `npm run build` -> passed.
  - `git diff --check` -> passed.

Remaining frontend gaps:
- The editor still lacks the visible slash-command menu from the supplied screenshot.
- The sidebar still does not present generic docs as a Notion page tree with immediate Untitled creation.
- Delete/trash/restore UI is not wired to the new archive/delete API.
- Browser-level proof for create/list/edit/delete/reload is still missing.

Remaining backend gaps:
- No new backend gap identified for page create/list/read/update/archive/delete after T003, but browser-level proof has not exercised the full frontend-to-backend path.

Next allowed task:
- Add the screenshot-target slash-command menu to the existing Markdown editor, inserting Markdown semantics for H1/H2/H3/bullet/numbered/paragraph/image without changing persistence or sidebar behavior.

Allowed files:
- `components/editor/markdown-editor.tsx`

Verify:
- `npm run build`
- `git diff --check`

Stop if:
- The implementation needs a rich-text editor dependency.
- The implementation needs backend, docs-store, or sidebar files.
- The slash menu requires browser-specific measurement that cannot be safely handled in the current textarea editor.

Why this next:
- The persistence path now exists. The slash menu is a high-signal visual/interaction gap from the screenshots and can be implemented as a bounded frontend slice without touching the service or broader shell.
