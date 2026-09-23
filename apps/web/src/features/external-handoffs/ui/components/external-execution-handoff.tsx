// biome-ignore-all lint/performance/noJsxPropsBind: Work-owned handoff controls close over their Work, form, and package state.

import type { ExternalExecutionHandoffHistoryEvent } from "@cantiara/api/external-handoffs";
import { externalExecutionHandoffInputSchema } from "@cantiara/api/external-handoffs";
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
import { useState } from "react";
import { useExternalExecutionHandoffs } from "@/features/external-handoffs/hooks/use-external-handoffs";
import { useClientShellConnection } from "@/features/web-macos-client/hooks/use-client-shell";
import { writeTextToClipboard } from "@/lib/clipboard";

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

function HandoffHistory({
  events,
}: {
  events: readonly ExternalExecutionHandoffHistoryEvent[];
}) {
  if (events.length === 0) {
    return null;
  }

  return (
    <section aria-label="Handoff history" className="space-y-2">
      <h5 className="font-medium text-xs">Handoff history</h5>
      <ul className="space-y-1 text-muted-foreground text-xs">
        {events.map((event) => (
          <li key={event.eventId}>
            {event.eventType === "external-execution-handoff-started"
              ? "Handoff started"
              : "Going package copied"}
            {" · "}
            <time dateTime={event.occurredAt}>{event.occurredAt}</time>
          </li>
        ))}
      </ul>
    </section>
  );
}

function githubIdentifiers(value: string) {
  return value
    .split("\n")
    .map((identifier) => identifier.trim())
    .filter(Boolean);
}

function errorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : "This handoff could not be written.";
}

export default function ExternalExecutionHandoff({
  defaultExpanded = false,
  work,
}: {
  defaultExpanded?: boolean;
  work: WorkProfile;
}) {
  const connection = useClientShellConnection();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [formError, setFormError] = useState<string | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [copiedHandoffId, setCopiedHandoffId] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const { history, query, recordPackageExport, start } =
    useExternalExecutionHandoffs(work, expanded);
  const form = useForm({
    defaultValues: EMPTY_DRAFT,
    onSubmit: async ({ value }) => {
      setFormError(null);
      setWriteError(null);
      setCopyError(null);
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
        setFormError(
          parsed.error.issues[0]?.message ?? "Check the handoff details.",
        );
        return;
      }
      try {
        const { workId: _workId, ...input } = parsed.data;
        await start.mutateAsync(input);
        form.reset();
      } catch (error) {
        setWriteError(errorMessage(error));
      }
    },
  });
  const pending =
    start.isPending ||
    recordPackageExport.isPending ||
    connection === "offline";

  async function copyPackage(handoffId: string, markdown: string) {
    setCopyError(null);
    setCopiedHandoffId(null);
    try {
      await writeTextToClipboard(markdown);
    } catch {
      setCopyError("Going package could not be copied.");
      return;
    }
    setCopiedHandoffId(handoffId);
    try {
      await recordPackageExport.mutateAsync({
        clientEventId: crypto.randomUUID(),
        handoffId,
      });
    } catch {
      setCopyError(
        "Going package was copied, but its Work history could not be recorded.",
      );
    }
  }

  return (
    <section
      aria-labelledby={`external-execution-handoff-${work.id}-heading`}
      className="rounded-md border border-border/70 bg-background/45 p-3"
      data-external-execution-handoff="true"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4
            className="font-medium text-sm"
            id={`external-execution-handoff-${work.id}-heading`}
          >
            External Execution Handoff
          </h4>
          <p className="text-muted-foreground text-xs">
            A dated package stays attached to {work.key}.
          </p>
        </div>
        <Button
          disabled={connection === "offline"}
          onClick={() => {
            setExpanded(true);
            setWriteError(null);
            setFormError(null);
          }}
          size="xs"
          type="button"
          variant="outline"
        >
          {work.archivedAt === null ? "Start Handoff" : "View Handoffs"}
        </Button>
      </header>

      {expanded ? (
        <div className="mt-4 space-y-4 border-border/70 border-t pt-4">
          {query.isPending ? (
            <p className="text-muted-foreground text-xs" role="status">
              Loading External Execution Handoffs…
            </p>
          ) : null}
          {query.isError ? (
            <p className="text-destructive text-xs" role="alert">
              External Execution Handoffs could not be loaded. Try again.
            </p>
          ) : null}
          <HandoffHistory events={history.data ?? []} />
          {history.isError ? (
            <p className="text-destructive text-xs" role="alert">
              Handoff history could not be loaded. Try again.
            </p>
          ) : null}
          {query.data?.map((handoff) => (
            <article
              className="space-y-3 border-border/70 border-l-2 pl-3"
              key={handoff.handoffId}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="min-w-0 font-medium text-xs">
                  {handoff.purpose}{" "}
                  <span className="text-muted-foreground">
                    · {handoff.status}
                  </span>
                </p>
                <div className="text-right">
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {handoff.handoffId}
                  </p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {handoff.packageProducedAt}
                  </p>
                </div>
              </div>
              {handoff.selectedWorkRevision === null ? null : (
                <p className="font-mono text-[11px] text-muted-foreground">
                  {work.key} · revision {handoff.selectedWorkRevision}
                </p>
              )}
              <details
                className="group rounded-sm border border-border/70 bg-card/55"
                open
              >
                <summary className="cursor-pointer px-3 py-2 font-medium text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  Going package
                </summary>
                <div className="space-y-2 border-border/70 border-t p-3">
                  <p className="text-muted-foreground text-xs" role="note">
                    Free text is copied as entered and is not scanned for
                    secrets. Review the package before sharing.
                  </p>
                  <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed">
                    {handoff.packageMarkdown}
                  </pre>
                  <Button
                    disabled={pending}
                    onClick={() =>
                      copyPackage(handoff.handoffId, handoff.packageMarkdown)
                    }
                    size="xs"
                    type="button"
                    variant="outline"
                  >
                    Copy going package
                  </Button>
                  {copiedHandoffId === handoff.handoffId ? (
                    <p className="text-muted-foreground text-xs" role="status">
                      Going package copied.
                    </p>
                  ) : null}
                </div>
              </details>
            </article>
          ))}
          {copyError ? (
            <p className="text-destructive text-xs" role="alert">
              {copyError}
            </p>
          ) : null}

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
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
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
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
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
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
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
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      rows={2}
                      value={field.state.value}
                    />
                  </Field>
                )}
              </form.Field>
            </div>
            <fieldset className="space-y-3 rounded-sm border border-border/70 p-3">
              <legend className="px-1 font-medium text-xs">
                Selected versions
              </legend>
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
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      placeholder="One permitted GitHub repository, issue, pull request, or commit URL per line"
                      rows={2}
                      value={field.state.value}
                    />
                    <FieldDescription>
                      Add only GitHub URLs you already have permission to see.
                      No repository is copied.
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
        </div>
      ) : null}
    </section>
  );
}
