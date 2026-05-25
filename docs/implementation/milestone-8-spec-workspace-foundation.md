# Milestone 8 Spec Workspace Foundation

## Summary

Implemented a repo-backed Spec Workspace semantic layer inside the existing workspace model. The older task/docs/review folders, `WORKFLOW.md` templates, task statuses, and background Coding Assistant run flow remain in place.

## Added modules

- `SymphoniaService.SpecWorkspace`
- `SymphoniaService.SpecWorkspace.Artifact`
- `SymphoniaService.SpecWorkspace.Store`
- `SymphoniaService.SpecWorkspace.Templates`
- `SymphoniaService.SpecWorkspace.Index`
- `SymphoniaService.SpecWorkspace.CodebaseMap`
- `SymphoniaService.SpecWorkspace.Milestones`
- `SymphoniaService.SpecWorkspace.Decisions`

## Routes

- `GET /api/repositories/:repo/spec-workspace`
- `POST /api/repositories/:repo/spec-workspace/initialize`
- `GET /api/repositories/:repo/spec-workspace/artifacts`
- `GET /api/repositories/:repo/spec-workspace/artifacts/:type`
- `GET /api/repositories/:repo/spec-workspace/artifacts/:type/:id`
- `PATCH /api/repositories/:repo/spec-workspace/artifacts/:type/:id`
- `POST /api/repositories/:repo/spec-workspace/milestones`
- `POST /api/repositories/:repo/spec-workspace/decisions`

Next.js proxy routes mirror the service routes under `app/api/repositories/[repoKey]/spec-workspace`.

## UI

- Reused the existing repository sidebar and workspace editor shell.
- Missing state in the sidebar shows: “Create a spec workspace for this repository.”
- Initialized state adds semantic workspace sections for Codebase, Milestones, Discussions, Requirements, Plans, and Decisions.
- Artifacts open at `/r/[repoKey]/workspace/[artifactType]/[artifactId]` in the existing repository layout.
- The editor can open a spec file, edit Markdown, update title/status metadata, and save.
- Added contextual create actions for milestone and decision in the existing sidebar sections.
- Clarise can deterministically initialize/open the codebase map and create starter milestone or decision artifacts.

## Tests

- Added service tests for initialization, default codebase files, no overwrite behavior, collision-safe milestone and decision IDs, list/read/update, metadata preservation, spec status validation, and unsafe path rejection.
- Existing task and Coding Assistant tests were kept in the suite to verify the background-run system still passes.

## Validations

- `cd services/symphonia_service && mix test` passed: 53 tests, 0 failures.
- `./node_modules/.bin/tsc --noEmit --pretty false` passed.
- `npm run build` passed.
- `git diff --check` passed.

## Smoke Checks

- Service health checked with `GET /api/repositories`.
- Temporary Git repository registered as `SMK`.
- Existing repository workspace initialized with `POST /api/repositories/SMK/workspace/initialize`.
- Spec workspace initialized with `POST /api/repositories/SMK/spec-workspace/initialize`.
- Created `milestone-001`.
- Created `decision-001`.
- Edited and saved `milestone-001` body and spec status.
- Existing task board endpoint loaded with `GET /api/repositories/SMK/tasks`.
- Frontend route `/r/smk/tasks` returned 200.
- Frontend route `/r/smk/workspace/milestone/milestone-001` returned 200.

## Limitations

- Clarise only provides deterministic starter text in this milestone.
- Milestones and decisions can be created from the UI; discussions, requirements, and plans are listed and editable once present, but creation buttons are intentionally deferred.
- Approved plans do not become Coding Assistant tasks yet.

## Non-goals

- No milestone-planning loop.
- No plan-to-task compiler.
- No GitHub or Linear expansion.
- No workflow graph editor.
- No quality gates.
- No new Coding Assistant orchestration.
