# T012 Judge Receipt

Status: done

Audit result:
- `not_complete`

Implementation readiness:
- `implementation_ready_for_proof: true`

Completed implementation evidence:
- Backend pages API covers create/list/read/update/archive/permanent delete and publish metadata.
- Frontend docs store hydrates from the pages API and writes doc create/edit/archive/restore/delete through it.
- Sidebar now exposes a Notion-like page tree, immediate Untitled creation, per-page actions, and Trash restore/permanent delete.
- Editor now exposes slash commands, Publish, ellipsis/Delete, and direct latest-value draft saving.
- Latest checks passed:
  - `npm run build` -> passed.
  - `git diff --check` -> passed.
- Local runtime availability was checked:
  - frontend listener on `http://localhost:3010`
  - service listener on `http://localhost:4057`
  - `GET /healthz` -> `{"ok":true}`
  - `GET /api/repositories` through the frontend returned repositories.
- In-app browser connection is currently available again.

Remaining gaps:
- Browser/runtime proof has not yet exercised create/list/edit/slash/publish/delete/reload end to end.
- Final completion audit must map that proof to the original request before the goal can be marked complete.

Next allowed task:
- Run browser/runtime proof for the Notion-like markdown page flow, including create, sidebar list, edit, slash command, publish, reload persistence, archive/delete, Trash visibility, restore or permanent delete cleanup, and API/file persistence evidence.

Allowed files:
- `docs/goals/notion-clone-markdown-parity/notes/T013-worker.md`
- `docs/goals/notion-clone-markdown-parity/state.yaml`

Verify:
- Browser navigation to `http://localhost:3010/r/sym/docs`.
- Create a new Untitled page from the sidebar.
- Edit title/body and use at least one slash command.
- Publish the page.
- Reload and confirm title/body/page list persist.
- Delete/archive the page and confirm it leaves the active tree and appears in Trash.
- Restore or permanently delete the proof page and confirm cleanup through the API.
- Record screenshots or DOM/API evidence in the receipt.

Stop if:
- Browser runtime becomes unavailable again.
- The frontend or service runtime becomes unreachable.
- The flow writes remote GitHub state or requires external credentials.
