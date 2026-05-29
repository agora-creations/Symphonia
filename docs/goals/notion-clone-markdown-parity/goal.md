# Notion Clone Markdown Parity

## Objective

Bring Symphonia's current markdown creation and editing flow to parity with the provided Notion clone reference for the current tranche: a Notion-like page creation/editor experience backed by durable page/block or markdown persistence, verified through focused frontend, backend, and browser-level proof.

## Original Request

"make current markdown creation rlanrid/notion-clone.git-parity, both in frontend and backend terms. Look at the screenshots to get what the final result should be"

## Intake Summary

- Input shape: `specific`
- Audience: users creating and editing markdown/planning documents in Symphonia
- Authority: `requested`
- Proof type: `test`, `demo`, `artifact`, `review`
- Completion proof: the local app can create, list, edit, delete, and persist markdown pages through a Notion-like UI matching the supplied screenshots, with backend API/storage coverage and a final browser verification of the target flow.
- Likely misfire: implementing a prettier textarea or static mock while leaving the actual creation flow, slash menu, page lifecycle, or backend persistence short of the Notion clone behavior.
- Blind spots considered: reference repo behavior may differ from screenshots; current Symphonia artifact semantics must not be broken; Clarise/private artifact boundaries still matter; slash commands need both UI behavior and persisted document semantics; backend parity must be verified, not inferred from UI.
- Existing plan facts:
  - Reference repo: `https://github.com/rlanrid/notion-clone.git`
  - User-provided visual targets:
    - `/Users/diegomarono/Desktop/Screenshot 2026-05-29 at 10.07.13.png`
    - `/Users/diegomarono/Desktop/Screenshot 2026-05-29 at 10.10.43.png`
    - `/Users/diegomarono/Desktop/Screenshot 2026-05-29 at 10.11.16.png`
    - `/Users/diegomarono/Desktop/Screen Recording 2026-05-29 at 10.12.41.mov`
  - Target UI signals include a light Notion-style workspace sidebar, page list, add/delete page actions, centered title/editor canvas, Publish/ellipsis top actions, and slash-command menu for headings, lists, paragraph, and image.

## Goal Kind

`specific`

## Current Tranche

Discover the current markdown creation path, compare it against the screenshots and linked Notion clone behavior, choose safe implementation slices, then complete successive verified frontend and backend slices until the page creation/editor flow is genuinely Notion-clone-parity for the requested scope.

The first safe slice is read-only discovery. Implementation must wait until Scout and Judge have identified the current code paths, backend contracts, allowed files, and verification commands.

## Non-Negotiable Constraints

- Do not start implementation before the active board task allows it.
- Preserve Symphonia's existing repository/workspace artifact model unless Judge explicitly approves a compatibility migration.
- Keep Clarise as a planning/document-creation copilot; do not let this goal expand into coding-run, PR, or external-publish features.
- No external writes, pushes, PRs, or GitHub mutations unless the user explicitly confirms them later.
- Treat screenshots and the screen recording as authoritative UX targets for this tranche.
- Treat `rlanrid/notion-clone.git` as a read-only parity reference. If it cannot be accessed, continue from screenshots and record the limitation.
- Verify both frontend behavior and backend persistence/contracts before final completion.
- Avoid broad unrelated refactors or cosmetic churn outside the selected implementation slices.

## Stop Rule

Stop only when a final audit proves the full original outcome is complete.

Do not stop after planning, discovery, or Judge selection if a safe Worker task can be activated.

Do not stop after a single verified Worker slice when the broader frontend/backend parity outcome still has safe local follow-up slices. After each slice audit, advance the board to the next highest-leverage safe Worker task and continue.

Do not stop because a slice needs owner input, credentials, production access, destructive operations, or policy decisions. Mark that exact slice blocked with a receipt, create the smallest safe follow-up or workaround task, and continue all local, non-destructive work that can still move the goal toward the full outcome.

## Canonical Board

Machine truth lives at:

`docs/goals/notion-clone-markdown-parity/state.yaml`

If this charter and `state.yaml` disagree, `state.yaml` wins for task status, active task, receipts, verification freshness, and completion truth.

## Run Command

```text
/goal Follow docs/goals/notion-clone-markdown-parity/goal.md.
```

## PM Loop

On every `/goal` continuation:

1. Read this charter.
2. Read `state.yaml`.
3. Run the bundled GoalBuddy update checker when available and mention a newer version without blocking.
4. Re-check the intake: original request, input shape, authority, proof, blind spots, existing plan facts, and likely misfire.
5. Work only on the active board task.
6. Assign Scout, Judge, Worker, or PM according to the task.
7. Write a compact task receipt.
8. Update the board.
9. If Judge selected a safe Worker task with `allowed_files`, `verify`, and `stop_if`, activate it and continue unless blocked.
10. If a problem, suggestion, or follow-up should become a repo artifact, create an approved issue/PR or ask the operator whether to create one.
11. Treat a slice audit as a checkpoint, not completion, unless it explicitly proves the full original outcome is complete.
12. Finish only with a Judge/PM audit receipt that maps receipts and verification back to the original user outcome and records `full_outcome_complete: true`.

Issue and PR handoffs are supporting artifacts. `state.yaml` remains authoritative, and every external artifact decision must be recorded in a task receipt.
