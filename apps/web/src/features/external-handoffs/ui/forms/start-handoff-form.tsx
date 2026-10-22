// biome-ignore-all lint/performance/noJsxPropsBind: Work-owned handoff controls close over their Work and form state.
import {
  type ExternalExecutionHandoffInput,
  externalExecutionHandoffInputSchema,
} from "@cantiara/api/external-handoffs";
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { errorMessage } from "../../lib/error-message";

interface HandoffDraft {
  constraints: string;
  executor: string;
  expectedOutput: string;
  githubContextText: string;
  includeWork: boolean;
  purpose: string;
}

const EMPTY_DRAFT: HandoffDraft = {
  constraints: "",
  executor: "",
  expectedOutput: "",
  githubContextText: "",
  includeWork: true,
  purpose: "",
};

function githubIdentifiers(value: string) {
  return value
    .split("\n")
    .map((identifier) => identifier.trim())
    .filter(Boolean);
}

export function StartHandoffForm({
  formError,
  onClearErrors,
  onFormError,
  onStart,
  onWriteError,
  pending,
  work,
  writeError,
}: {
  formError: string | null;
  onClearErrors: () => void;
  onFormError: (message: string) => void;
  onStart: (
    input: Omit<ExternalExecutionHandoffInput, "workId">,
  ) => Promise<unknown>;
  onWriteError: (message: string) => void;
  pending: boolean;
  work: WorkProfile;
  writeError: string | null;
}) {
  const form = useForm({
    defaultValues: EMPTY_DRAFT,
    onSubmit: async ({ value }) => {
      onClearErrors();
      const parsed = externalExecutionHandoffInputSchema.safeParse({
        constraints: value.constraints,
        executor: value.executor,
        expectedOutput: value.expectedOutput,
        githubContext: githubIdentifiers(value.githubContextText),
        includeWork: value.includeWork,
        purpose: value.purpose,
        workId: work.id,
      });
      if (!parsed.success) {
        onFormError(
          parsed.error.issues[0]?.message ?? "Check the handoff details.",
        );
        return;
      }
      try {
        const { workId: _workId, ...input } = parsed.data;
        await onStart(input);
        form.reset();
      } catch (error) {
        onWriteError(errorMessage(error));
      }
    },
  });

  return (
    <form
      aria-label="Start Handoff"
      className="space-y-4 rounded-md border border-border/70 bg-card/45 p-3"
      hidden={work.archivedAt !== null}
      onSubmit={async (event) => {
        event.preventDefault();
        event.stopPropagation();
        await form.handleSubmit();
      }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h5 className="font-medium text-sm">Start Handoff</h5>
        <p className="font-mono text-[11px] text-muted-foreground">
          {work.key} · current revision {work.revision}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <form.Field name="purpose">
          {(field) => (
            <Field>
              <FieldLabel htmlFor={`handoff-purpose-${work.id}`}>
                Purpose
              </FieldLabel>
              <Textarea
                disabled={pending}
                id={`handoff-purpose-${work.id}`}
                onChange={(event) => field.handleChange(event.target.value)}
                rows={2}
                value={field.state.value}
              />
            </Field>
          )}
        </form.Field>
        <form.Field name="executor">
          {(field) => (
            <Field>
              <FieldLabel htmlFor={`handoff-executor-${work.id}`}>
                Executor
              </FieldLabel>
              <Input
                disabled={pending}
                id={`handoff-executor-${work.id}`}
                onChange={(event) => field.handleChange(event.target.value)}
                value={field.state.value}
              />
            </Field>
          )}
        </form.Field>
        <form.Field name="expectedOutput">
          {(field) => (
            <Field>
              <FieldLabel htmlFor={`handoff-output-${work.id}`}>
                Expected output
              </FieldLabel>
              <Textarea
                disabled={pending}
                id={`handoff-output-${work.id}`}
                onChange={(event) => field.handleChange(event.target.value)}
                rows={2}
                value={field.state.value}
              />
            </Field>
          )}
        </form.Field>
        <form.Field name="constraints">
          {(field) => (
            <Field>
              <FieldLabel htmlFor={`handoff-constraints-${work.id}`}>
                Constraints
              </FieldLabel>
              <Textarea
                disabled={pending}
                id={`handoff-constraints-${work.id}`}
                onChange={(event) => field.handleChange(event.target.value)}
                rows={2}
                value={field.state.value}
              />
            </Field>
          )}
        </form.Field>
      </div>
      <fieldset className="space-y-3 rounded-sm border border-border/70 p-3">
        <legend className="px-1 font-medium text-xs">Selected versions</legend>
        <form.Field name="includeWork">
          {(field) => (
            <label
              className="flex items-center gap-2 text-xs"
              htmlFor={`handoff-include-work-${work.id}`}
            >
              <Checkbox
                checked={field.state.value}
                disabled={pending}
                id={`handoff-include-work-${work.id}`}
                onCheckedChange={(checked) =>
                  field.handleChange(checked === true)
                }
              />
              Include this Work · revision {work.revision}
            </label>
          )}
        </form.Field>
        <form.Field name="githubContextText">
          {(field) => (
            <Field>
              <FieldLabel htmlFor={`handoff-github-${work.id}`}>
                GitHub context
              </FieldLabel>
              <Textarea
                disabled={pending}
                id={`handoff-github-${work.id}`}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder="One permitted GitHub repository, issue, pull request, or commit URL per line"
                rows={2}
                value={field.state.value}
              />
              <FieldDescription>
                Add only GitHub URLs you already have permission to see. No
                repository is copied.
              </FieldDescription>
            </Field>
          )}
        </form.Field>
      </fieldset>
      {formError ? (
        <p className="text-destructive text-xs" role="alert">
          {formError}
        </p>
      ) : null}
      {writeError ? (
        <p className="text-destructive text-xs" role="alert">
          {writeError}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={pending} size="sm" type="submit">
          Start Handoff
        </Button>
        <p className="text-muted-foreground text-xs">
          Cantiara saves the package; it does not start an external tool.
        </p>
      </div>
    </form>
  );
}
