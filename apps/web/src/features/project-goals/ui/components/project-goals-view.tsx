// biome-ignore-all lint/performance/noJsxPropsBind: Goal controls bind to the selected record and form field.
import {
  type ProjectGoalRecord,
  projectGoalFieldsSchema,
} from "@cantiara/api/project-goals";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { type FormEvent, useState } from "react";

export interface ProjectGoalDraft {
  description: string;
  intendedOutcome: string;
  observedOutcomeLearning: string;
  title: string;
}
const EMPTY_DRAFT: ProjectGoalDraft = {
  title: "",
  description: "",
  intendedOutcome: "",
  observedOutcomeLearning: "",
};
const FIELDS = [
  { name: "title", label: "Title", required: true, maxLength: 255 },
  {
    name: "description",
    label: "Description",
    required: true,
    maxLength: 10_000,
  },
  {
    name: "intendedOutcome",
    label: "Intended outcome",
    required: false,
    maxLength: 10_000,
  },
  {
    name: "observedOutcomeLearning",
    label: "Observed outcome / learning",
    required: false,
    maxLength: 10_000,
  },
] as const;
export function projectGoalsHref(projectId: string, goalId?: string) {
  return `/projects/${encodeURIComponent(projectId)}#${goalId ? `project-goal-${encodeURIComponent(goalId)}` : "goals"}`;
}
export function ProjectGoalEditor({
  goal,
  onSave,
  onCancel,
}: {
  goal?: ProjectGoalRecord;
  onSave: (draft: ProjectGoalDraft) => Promise<unknown>;
  onCancel: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const form = useForm({
    defaultValues: goal
      ? {
          title: goal.title,
          description: goal.description,
          intendedOutcome: goal.intendedOutcome ?? "",
          observedOutcomeLearning: goal.observedOutcomeLearning ?? "",
        }
      : EMPTY_DRAFT,
    onSubmit: async ({ value }) => {
      setError(null);
      if (!projectGoalFieldsSchema.safeParse(value).success) {
        setError("Enter a Title and Description before saving.");
        return;
      }
      try {
        await onSave(value);
      } catch {
        setError(
          "Project Goal could not be saved. Retry, or reload to check for changes. Your text is kept here.",
        );
      }
    },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }
  return (
    <form
      className="space-y-4 rounded-lg border border-border/70 p-5"
      onSubmit={submit}
    >
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <>
            {FIELDS.map(({ name, label, required, maxLength }) => (
              <form.Field key={name} name={name}>
                {(field) => (
                  <label
                    className="grid gap-2 text-sm"
                    htmlFor={`project-goal-${name}`}
                  >
                    {label}
                    {required ? "" : " (optional)"}
                    {name === "title" ? (
                      <Input
                        disabled={isSubmitting}
                        id={`project-goal-${name}`}
                        maxLength={maxLength}
                        name={name}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        required={required}
                        value={field.state.value}
                      />
                    ) : (
                      <Textarea
                        disabled={isSubmitting}
                        id={`project-goal-${name}`}
                        maxLength={maxLength}
                        name={name}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        required={required}
                        value={field.state.value}
                      />
                    )}
                  </label>
                )}
              </form.Field>
            ))}
            <div className="flex flex-wrap gap-3">
              <Button disabled={isSubmitting} type="submit">
                {isSubmitting ? "Saving…" : "Save"}
              </Button>
              <Button
                disabled={isSubmitting}
                onClick={onCancel}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
            </div>
          </>
        )}
      </form.Subscribe>
    </form>
  );
}
export function ProjectGoalsView({
  goals,
  projectId,
  readOnly,
  selectedId,
  onSave,
  savedMessage,
}: {
  goals: readonly ProjectGoalRecord[];
  projectId: string;
  readOnly: boolean;
  selectedId?: string;
  onSave: (
    draft: ProjectGoalDraft,
    goal?: ProjectGoalRecord,
  ) => Promise<unknown>;
  savedMessage?: string;
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
        <a
          className="inline-flex min-h-11 items-center text-sm underline underline-offset-4"
          href={
            selectedId
              ? projectGoalsHref(projectId)
              : `/projects/${encodeURIComponent(projectId)}#overview`
          }
        >
          {selectedId ? "Goals" : "Overview"}
        </a>
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
      {selectedId ? null : (
        <ProjectGoalList goals={goals} projectId={projectId} />
      )}
      {canEdit && editing ? (
        <ProjectGoalEditor
          goal={selected}
          key={selected?.id ?? "new"}
          onCancel={() => setEditing(false)}
          onSave={async (draft) => {
            await onSave(draft, selected);
            setEditing(false);
          }}
        />
      ) : null}
      {canEdit && !editing ? (
        <Button onClick={() => setEditing(true)} type="button">
          {selected ? "Edit Project Goal" : "New Project Goal"}
        </Button>
      ) : null}
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
          <a
            className="block p-4 underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            href={projectGoalsHref(projectId, goal.id)}
          >
            {goal.title}
          </a>
        </li>
      ))}
    </ul>
  );
}
