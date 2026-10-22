// biome-ignore-all lint/performance/noJsxPropsBind: Form fields close over the current Project and its active Work.
import { createPrioritizationSessionInputSchema } from "@cantiara/api/prioritization-sessions";
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import { Input } from "@cantiara/ui/components/input";
import { useForm } from "@tanstack/react-form";
import { type FormEvent, useState } from "react";
import type { usePrioritizationSessions } from "../../hooks/use-prioritization-sessions";

export type CreateSessionMutation = ReturnType<
  typeof usePrioritizationSessions
>["createSession"];

export default function PrioritizationSessionCreateForm({
  activeWorks,
  busy,
  createSession,
  projectId,
}: {
  activeWorks: WorkProfile[];
  busy: boolean;
  createSession: CreateSessionMutation;
  projectId: string;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm({
    defaultValues: { name: "", workIds: [] as string[] },
    onSubmit: async ({ value }) => {
      const selected = new Set(value.workIds);
      const parsed = createPrioritizationSessionInputSchema.safeParse({
        name: value.name,
        projectId,
        workIds: activeWorks
          .filter((work) => selected.has(work.id))
          .map((work) => work.id),
      });
      if (!parsed.success) {
        setFormError(parsed.error.issues[0]?.message ?? "Check the form.");
        return;
      }
      setFormError(null);
      await createSession.mutateAsync({
        name: parsed.data.name,
        workIds: parsed.data.workIds,
      });
      form.reset();
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }

  return (
    <form
      className="space-y-3 rounded-lg border border-border/70 bg-card/40 p-4"
      onSubmit={handleSubmit}
    >
      <form.Field name="name">
        {(field) => (
          <label className="block space-y-1.5 text-sm" htmlFor="session-name">
            <span>Session name</span>
            <Input
              id="session-name"
              maxLength={200}
              name={field.name}
              onChange={(event) =>
                field.handleChange(event.currentTarget.value)
              }
              placeholder="For example, Q4 launch review"
              required
              value={field.state.value}
            />
          </label>
        )}
      </form.Field>
      <form.Field name="workIds">
        {(field) => (
          <fieldset className="space-y-2">
            <legend className="font-medium text-sm">Work scope</legend>
            {activeWorks.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No active Work is available to select.
              </p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {activeWorks.map((work) => (
                  <li key={work.id}>
                    <label
                      className="flex items-start gap-2 rounded-md border border-border/60 px-3 py-2 text-sm"
                      htmlFor={`session-work-${work.id}`}
                    >
                      <Checkbox
                        checked={field.state.value.includes(work.id)}
                        className="mt-0.5"
                        id={`session-work-${work.id}`}
                        onCheckedChange={(checked) =>
                          field.handleChange(
                            checked
                              ? [...field.state.value, work.id]
                              : field.state.value.filter(
                                  (id) => id !== work.id,
                                ),
                          )
                        }
                      />
                      <span>
                        <span className="text-muted-foreground">
                          {work.key}
                        </span>{" "}
                        {work.title}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>
        )}
      </form.Field>
      {formError ? (
        <p className="text-destructive text-sm" role="alert">
          {formError}
        </p>
      ) : null}
      <form.Subscribe selector={(state) => state.values.name}>
        {(name) => (
          <Button disabled={busy || !name.trim()} type="submit">
            Create Prioritization Session
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
