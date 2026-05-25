# Spec Workspace

Symphonia is being reframed as a repository planning workspace. The current app kept the older repository workspace for tasks, reviews, run summaries, and `WORKFLOW.md`; the Spec Workspace extends that file shell with semantic Markdown files for planning and product intent.

## Repo-backed files

The spec workspace lives under `symphonia/` in the opened repository:

```text
symphonia/
  codebase/
    map.md
    conventions.md
    architecture.md
  milestones/
  discussions/
  requirements/
  plans/
  task-proposals/
  decisions/
  tasks/
  reviews/
  run-summaries/
```

Each spec file is Markdown with a metadata block:

```markdown
---
type: milestone
id: milestone-001
title: Untitled milestone
status: draft
created_at: 2026-05-25T00:00:00Z
updated_at: 2026-05-25T00:00:00Z
source: clarise
---
```

Spec statuses are separate from task statuses:

- `draft`
- `in_discussion`
- `requirements_ready`
- `plan_ready`
- `ready_for_approval`
- `approved`
- `created`
- `archived`

## Local and Private Data

The repository stores curated Markdown only. Raw Coding Assistant logs and other local operational files stay outside the repository. Run summaries can be committed when they are intentionally written as human-readable Markdown.

## Semantic Layer

The frontend treats these files as normal workspace Markdown, but the service indexes their metadata so the UI can show product meaning: Codebase, Milestones, Discussions, Requirements, Plans, Task proposals, and Decisions. Clarise-created files are not hidden implementation files; they are the same repo-backed workspace artifacts users can open and edit.

## Specs Versus Tasks

Spec files describe intent, context, decisions, requirements, plans, and task proposals. Task proposals are reviewable planning artifacts; they do not start work by themselves.

Task files under `symphonia/tasks/` keep the existing task lifecycle: To-do, In Progress, In Review, Completed, Paused, and Canceled. Coding Assistant background runs continue to work from tasks, not directly from milestones or plans.

## Later Work

This foundation lets Clarise create and update durable workspace files first. Milestone 9 added the milestone-planning loop and plan approval. Milestone 10 adds reviewed plan-to-task generation so approved plans can become To-do tasks before any Coding Assistant work starts.
