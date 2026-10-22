// biome-ignore-all lint/performance/noJsxPropsBind: Goal controls bind to the selected record and form field.

import type { ProjectGoalRecord } from "@cantiara/api/project-goals";
import { Button } from "@cantiara/ui/components/button";
import { type ReactNode, useState } from "react";
import { AppLink } from "@/components/app-link";
import {
  FIELDS,
  type ProjectGoalDraft,
  ProjectGoalEditor,
} from "../forms/project-goal-form";

export function projectGoalsHref(projectId: string, goalId?: string) {
  return `/projects/${encodeURIComponent(projectId)}#${goalId ? `project-goal-${encodeURIComponent(goalId)}` : "goals"}`;
}
export function ProjectGoalsView({
  goals,
  projectId,
  readOnly,
  selectedId,
  onSave,
  onStartEditing,
  savedMessage,
  membership,
}: {
  goals: readonly ProjectGoalRecord[];
  projectId: string;
  readOnly: boolean;
  selectedId?: string;
  onSave: (
    draft: ProjectGoalDraft,
    goal?: ProjectGoalRecord,
  ) => Promise<unknown>;
  membership?: ReactNode;
  savedMessage?: string;
  onStartEditing?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const selected = selectedId
    ? goals.find((goal) => goal.id === selectedId)
    : undefined;
  const canEdit = !readOnly && (!selectedId || !!selected);
  const heading = selectedId ? "Project Goal" : "Goals";
  return (
    <section aria-label={heading} className="space-y-6">
      <header className="surface-header space-y-3">
        <AppLink
          className="inline-flex min-h-11 items-center text-sm underline underline-offset-4"
          href={
            selectedId
              ? projectGoalsHref(projectId)
              : `/projects/${encodeURIComponent(projectId)}#overview`
          }
        >
          {selectedId ? "Goals" : "Overview"}
        </AppLink>
        <h2 className="font-semibold text-2xl tracking-tight">{heading}</h2>
      </header>
      {savedMessage ? (
        <p className="text-sm" role="status">
          {savedMessage}
        </p>
      ) : null}
      {selectedId && !selected ? (
        <p role="alert">Project Goal is unavailable.</p>
      ) : null}
      {selected ? (
        <>
          <h3 className="break-words font-medium text-xl">{selected.title}</h3>
          <dl className="space-y-5 rounded-lg border border-border/70 p-5">
            {FIELDS.filter((field) => field.name !== "title").map(
              ({ name, label }) => (
                <div key={name}>
                  <dt className="font-medium text-sm">{label}</dt>
                  <dd className="mt-1 whitespace-pre-wrap break-words text-muted-foreground text-sm">
                    {selected[name] || "—"}
                  </dd>
                </div>
              ),
            )}
          </dl>
        </>
      ) : null}
      {selected ? membership : null}
      {selectedId ? null : (
        <ProjectGoalList goals={goals} projectId={projectId} />
      )}
      <ProjectGoalEditControls
        canEdit={canEdit}
        editing={editing}
        onSave={onSave}
        onStartEditing={onStartEditing}
        selected={selected}
        setEditing={setEditing}
      />{" "}
    </section>
  );
}

function ProjectGoalList({
  goals,
  projectId,
}: {
  goals: readonly ProjectGoalRecord[];
  projectId: string;
}) {
  if (!goals.length) {
    return (
      <p className="text-muted-foreground">No Project Goals recorded yet.</p>
    );
  }
  return (
    <ul className="divide-y rounded-lg border border-border/70">
      {goals.map((goal) => (
        <li key={goal.id}>
          <AppLink
            className="block p-4 underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            href={projectGoalsHref(projectId, goal.id)}
          >
            {goal.title}
          </AppLink>
        </li>
      ))}
    </ul>
  );
}

function ProjectGoalEditControls({
  canEdit,
  editing,
  selected,
  setEditing,
  onSave,
  onStartEditing,
}: {
  canEdit: boolean;
  editing: boolean;
  selected: ProjectGoalRecord | undefined;
  setEditing: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  onSave: (
    draft: ProjectGoalDraft,
    goal?: ProjectGoalRecord,
  ) => Promise<unknown>;
  onStartEditing: (() => void) | undefined;
}) {
  return (
    <>
      {" "}
      {canEdit && editing ? (
        <ProjectGoalEditor
          goal={selected}
          key={selected?.id ?? "new"}
          onCancel={() => setEditing(false)}
          onSave={async (draft, baseGoal) => {
            await onSave(draft, baseGoal);
            setEditing(false);
          }}
        />
      ) : null}
      {canEdit && !editing ? (
        <Button
          onClick={() => {
            onStartEditing?.();
            setEditing(true);
          }}
          type="button"
        >
          {selected ? "Edit Project Goal" : "New Project Goal"}
        </Button>
      ) : null}
    </>
  );
}
