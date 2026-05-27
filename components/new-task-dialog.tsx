"use client";

import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogPortal, DialogOverlay } from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Paperclip, Maximize2, Minimize2, X, MoreHorizontal } from "lucide-react";
import { TaskStatusIcon } from "@/components/icons/task-status-icons";
import { useToast } from "@/components/toast";
import { cn } from "@/lib/utils";
import type { ServiceTask } from "@/lib/task-model";
import type { Priority } from "@/data/mock";

type NewTaskInit = { title?: string; body?: string };
type Ctx = { open: (init?: NewTaskInit) => void };
const NewTaskCtx = createContext<Ctx>({ open: () => {} });
export const useNewTask = () => useContext(NewTaskCtx);

export function NewTaskProvider({
  children,
  repoKey,
}: {
  children: ReactNode;
  repoKey: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("no-priority");
  const [assistantEnabled, setAssistantEnabled] = useState(false);
  const [project, setProject] = useState("");
  const [labels, setLabels] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [createMore, setCreateMore] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const toast = useToast();

  const reset = () => {
    setTitle("");
    setDescription("");
    setPriority("no-priority");
    setAssistantEnabled(false);
    setProject("");
    setLabels("");
    setDetailsOpen(false);
    setAttachments([]);
    setError(null);
  };

  const cyclePriority = () => {
    const priorities: Priority[] = ["no-priority", "low", "medium", "high", "urgent"];
    const current = priorities.indexOf(priority);
    setPriority(priorities[(current + 1) % priorities.length]);
  };

  const labelList = labels
    .split(",")
    .map((label) => label.trim())
    .filter(Boolean);

  const bodyWithMetadata = () => {
    const sections = [description.trim()].filter(Boolean);
    if (labelList.length > 0) sections.push(`Labels\n${labelList.map((label) => `- ${label}`).join("\n")}`);
    if (attachments.length > 0) {
      sections.push(`Attachments\n${attachments.map((name) => `- ${name}`).join("\n")}`);
    }
    return sections.join("\n\n");
  };

  const handleCreate = async () => {
    if (!title.trim()) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/repositories/${encodeURIComponent(repoKey)}/tasks`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          body: bodyWithMetadata(),
          priority,
          assistant: assistantEnabled ? "codex_app_server" : undefined,
          project: project.trim() || undefined,
          labels: labelList,
        }),
      });
      const payload = (await res.json()) as { task?: ServiceTask; error?: string };
      if (!res.ok || !payload.task) {
        throw new Error(payload.error ?? "Could not create task");
      }

      window.dispatchEvent(
        new CustomEvent("symphonia:taskCreated", {
          detail: { repoKey, task: payload.task },
        }),
      );
      router.refresh();
      toast.show(`Task ${payload.task.key} created`, "success");

      if (createMore) reset();
      else {
        setIsOpen(false);
        reset();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create task");
    } finally {
      setPending(false);
    }
  };

  return (
    <NewTaskCtx.Provider
      value={{
        open: (init) => {
          setTitle(init?.title ?? "");
          setDescription(init?.body ?? "");
          setError(null);
          setIsOpen(true);
        },
      }}
    >
      {children}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogPortal>
          <DialogOverlay />
          <DialogPrimitive.Content
            className={cn(
              "bg-background fixed top-[50%] left-[50%] z-50 w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%]",
              "overflow-hidden rounded-[10px] border shadow-[var(--elevation-dialog)]",
              "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
              maximized
                ? "flex h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] flex-col"
                : "max-w-2xl",
            )}
          >
            <DialogPrimitive.Title className="sr-only">New task</DialogPrimitive.Title>

            <div className="flex items-center justify-between px-3 py-2 border-b">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="grid h-5 w-5 place-items-center rounded bg-primary/20 text-primary text-[10px] font-bold">
                  {repoKey[0] ?? "S"}
                </span>
                <span className="font-medium">{repoKey}</span>
                <span className="text-muted-foreground">›</span>
                <span className="text-muted-foreground">New task</span>
              </div>
              <div className="flex items-center gap-0.5 text-muted-foreground">
                <button
                  aria-label="Maximize"
                  aria-pressed={maximized}
                  title={maximized ? "Restore" : "Maximize"}
                  onClick={() => setMaximized((value) => !value)}
                  className="grid h-6 w-6 place-items-center rounded hover:bg-accent hover:text-foreground"
                >
                  {maximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                </button>
                <DialogPrimitive.Close className="grid h-6 w-6 place-items-center rounded hover:bg-accent hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </DialogPrimitive.Close>
              </div>
            </div>

            <div className={cn("px-4 pt-3 pb-2", maximized && "min-h-0 flex-1 overflow-auto")}>
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Task title"
                maxLength={140}
                required
                className="w-full bg-transparent text-lg font-medium placeholder:text-muted-foreground/70 outline-none"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the goal, context, and what done looks like…"
                rows={maximized ? 12 : 4}
                maxLength={2000}
                className="mt-2 w-full resize-none bg-transparent text-sm placeholder:text-muted-foreground/70 outline-none"
              />
              {error && (
                <p className="mt-2 rounded-[10px] border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-700 dark:text-amber-300">
                  {error}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 px-4 pb-3">
              <Pill>
                <TaskStatusIcon status="todo" />
                To-do
              </Pill>
              <Pill type="button" onClick={cyclePriority} className={priority !== "no-priority" ? "border-primary/30 bg-primary/10 text-foreground" : undefined}>
                <span className="flex gap-[2px]">
                  <span className="h-[3px] w-[3px] rounded-full bg-current" />
                  <span className="h-[3px] w-[3px] rounded-full bg-current" />
                  <span className="h-[3px] w-[3px] rounded-full bg-current" />
                </span>
                {priority === "no-priority" ? "Priority" : priorityLabel(priority)}
              </Pill>
              <Pill
                type="button"
                onClick={() => setAssistantEnabled((value) => !value)}
                aria-pressed={assistantEnabled}
                className={assistantEnabled ? "border-primary/30 bg-primary/10 text-foreground" : undefined}
              >
                <svg viewBox="0 0 14 14" className="h-3.5 w-3.5">
                  <circle cx="7" cy="5" r="2" fill="none" stroke="currentColor" strokeWidth="1.3" strokeDasharray="2 1.5" />
                  <path d="M3 12c0-2.2 1.8-4 4-4s4 1.8 4 4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeDasharray="2 1.5" />
                </svg>
                Codex
              </Pill>
              <Pill
                type="button"
                onClick={() => setDetailsOpen((value) => !value)}
                aria-expanded={detailsOpen}
                className={project.trim() ? "border-primary/30 bg-primary/10 text-foreground" : undefined}
              >
                <svg viewBox="0 0 14 14" className="h-3.5 w-3.5">
                  <path
                    d="M7 1.5 L12 4 L12 10 L7 12.5 L2 10 L2 4 Z M7 1.5 L7 12.5 M2 4 L7 7 L12 4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinejoin="round"
                  />
                </svg>
                {project.trim() || "Project"}
              </Pill>
              <Pill
                type="button"
                onClick={() => setDetailsOpen((value) => !value)}
                aria-expanded={detailsOpen}
                className={labelList.length > 0 ? "border-primary/30 bg-primary/10 text-foreground" : undefined}
              >
                <svg viewBox="0 0 14 14" className="h-3.5 w-3.5">
                  <path
                    d="M7.5 1.5 H12 V6 L6.5 11.5 L2 7 Z M9.5 4.5 a0.6 0.6 0 1 0 0.001 0"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinejoin="round"
                  />
                </svg>
                {labelList.length > 0 ? `${labelList.length} label${labelList.length === 1 ? "" : "s"}` : "Labels"}
              </Pill>
              <Pill
                type="button"
                aria-label="More"
                aria-expanded={detailsOpen}
                onClick={() => setDetailsOpen((value) => !value)}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Pill>
            </div>

            {detailsOpen && (
              <div className="grid gap-2 border-t bg-[var(--card-alt)] px-4 py-3 sm:grid-cols-2">
                <label className="grid gap-1 text-[11px] font-medium text-muted-foreground">
                  Project
                  <input
                    value={project}
                    onChange={(event) => setProject(event.target.value)}
                    placeholder={`${repoKey} planning`}
                    className="rounded-[8px] border bg-background px-2.5 py-1.5 text-sm font-normal text-foreground outline-none focus:ring-2 focus:ring-ring"
                  />
                </label>
                <label className="grid gap-1 text-[11px] font-medium text-muted-foreground">
                  Labels
                  <input
                    value={labels}
                    onChange={(event) => setLabels(event.target.value)}
                    placeholder="frontend, polish"
                    className="rounded-[8px] border bg-background px-2.5 py-1.5 text-sm font-normal text-foreground outline-none focus:ring-2 focus:ring-ring"
                  />
                </label>
                {attachments.length > 0 && (
                  <div className="sm:col-span-2 text-[11px] text-muted-foreground">
                    Attachments: {attachments.join(", ")}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between border-t px-3 py-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(event) => {
                  setAttachments(Array.from(event.target.files ?? []).map((file) => file.name));
                }}
              />
              <button
                aria-label="Attach"
                title="Attach files"
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "grid h-7 w-7 place-items-center rounded-[8px] text-muted-foreground hover:bg-accent hover:text-foreground",
                  attachments.length > 0 && "text-foreground",
                )}
              >
                <Paperclip className="h-3.5 w-3.5" />
              </button>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                  <span
                    role="switch"
                    aria-checked={createMore}
                    onClick={() => setCreateMore((v) => !v)}
                    className={cn(
                      "relative inline-block h-4 w-7 rounded-full transition-colors",
                      createMore ? "bg-primary" : "bg-muted",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 h-3 w-3 rounded-full bg-background transition-all",
                        createMore ? "left-3.5" : "left-0.5",
                      )}
                    />
                  </span>
                  Create more
                </label>
                <button
                  onClick={handleCreate}
                  disabled={!title.trim() || pending}
                  className="rounded-[8px] bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {pending ? "Creating…" : "Create task"}
                </button>
              </div>
            </div>
          </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>
    </NewTaskCtx.Provider>
  );
}

function priorityLabel(priority: Priority): string {
  if (priority === "no-priority") return "Priority";
  return priority[0].toUpperCase() + priority.slice(1);
}

function Pill({ children, className, ...props }: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
        "disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-background disabled:hover:text-muted-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}
