# Milestone 10 Plan-to-Task Compiler

## Summary

Implemented the bridge from approved Clarise milestone plans to reviewed task proposals and repo-backed To-do task files. Task creation is explicit and does not start Coding Assistant work.

## Files and Modules Added

- `SymphoniaService.Clarise.PlanToTaskCompiler`
- `services/symphonia_service/test/clarise_plan_to_task_compiler_test.exs`
- `components/clarise-milestone-loop.tsx` task proposal review state
- `app/api/repositories/[repoKey]/clarise/milestones/[milestoneId]/tasks/propose/route.ts`
- `app/api/repositories/[repoKey]/clarise/milestones/[milestoneId]/tasks/create/route.ts`

## APIs Added

- `POST /api/repositories/:repo/clarise/milestones/:milestone/tasks/propose`
- `POST /api/repositories/:repo/clarise/milestones/:milestone/tasks/create`

## UI Added

- Approved milestones now show “Generate implementation tasks”.
- The workspace shows a review panel for proposed task titles, priorities, dependencies, and review expectations.
- Users can create tasks, regenerate the proposal, cancel the review, or open the task proposal Markdown.
- Created tasks are linked back to the existing task pages.

## Tests Added

- Proposal requires an approved milestone.
- Proposal persists a `task_proposal` Markdown artifact.
- Proposal generation is deterministic.
- Vague plans produce clarification tasks.
- Confirmation writes task Markdown with source metadata.
- Confirmation resolves proposal dependencies into final task keys.
- Repeated confirmation does not duplicate tasks from the same proposal.
- Confirmation requires a persisted proposal.
- Unsafe milestone ids are rejected.

## Validation Commands

- `cd services/symphonia_service && mix test test/clarise_plan_to_task_compiler_test.exs` passed: 7 tests, 0 failures.
- `cd services/symphonia_service && mix test` passed: 68 tests, 0 failures.
- `./node_modules/.bin/tsc --noEmit --pretty false` passed.
- `npm run build` passed.
- `git diff --check` passed.
- Search confirmed the docs and code keep using Markdown metadata language.

## Smoke Checks

- Temporary service health endpoint returned 200 on port 4569.
- Temporary repository `SM10` was registered in an isolated registry.
- Clarise milestone flow created, discussed, generated requirements, generated a plan, and approved `milestone-001`.
- Task proposal API persisted `symphonia/task-proposals/milestone-001-task-proposal.md`.
- Task creation wrote five To-do task files under `symphonia/tasks/`.
- Repeated task creation returned `createdCount: 0` with the same task keys.
- Generated task metadata included source milestone, source plan, generation id, proposal item id, dependency metadata, and review expectations.
- Task endpoint returned the generated tasks as To-do.
- Next.js workspace and task routes returned 200 on a temporary dev server at port 3011.
- Next.js task proposal proxy returned the persisted proposal payload.

## Known Limitations

- Proposal generation is deterministic and template-based.
- Full inline proposal editing is not included.
- Regeneration keeps the first generation id for this milestone version.
- Created tasks can be edited through existing task pages after creation.

## Non-goals

- No automatic Coding Assistant run starts from generated tasks.
- No GitHub or Linear projection was added.
- No automatic merge or external task sync was added.
