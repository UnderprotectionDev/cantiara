import {
  CLOSURE_SUMMARY_DRAFT_LABEL,
  CLOSURE_SUMMARY_DRAFT_NOTE,
  CLOSURE_SUMMARY_WIKI_COPY_LABEL,
  type ClosureSummaryDateComparison,
  type ClosureSummaryDraft,
  type ClosureSummarySources,
  PROJECT_CLOSURE_SUMMARY_LABEL,
} from "@cantiara/api/project-closure-summary";
import { skipToken, useMutation, useQuery } from "@tanstack/react-query";
import { useCreateStore, useSelector } from "@tanstack/react-store";
import { useCallback } from "react";
import { projectRecordHref } from "@/features/project-history/lib/project-record-links";
import { commandVariables } from "@/lib/command-variables";
import { type client, orpc } from "@/utils/orpc";
import { useSaveClosureSummary } from "../../hooks/use-save-closure-summary";
import {
  closureSummaryMarkdownOf,
  closureSummarySourcesOfSelection,
} from "../../lib/closure-summary-draft";
import { ClosureSummaryDateHistory } from "../components/closure-summary-date-history";
import { ClosureSummaryEditorForm } from "../forms/closure-summary-editor-form";
import {
  type ClosureSummarySourceAction,
  ClosureSummarySourceForm,
} from "../forms/closure-summary-source-form";

type Stage =
  | { kind: "select"; selected: string[] }
  | {
      generation: number;
      kind: "draft";
      markdown: string;
      saveKey: string;
      sources: ReturnType<typeof closureSummarySourcesOfSelection>;
    };

/**
 * Closure Summary Draft of a completed or abandoned Project: select sources,
 * preview which source lands under which heading, generate the editable
 * headings-and-links text, discard it. The draft lives in this component's
 * state only; closing or discarding it leaves no record. `Save as Document`
 * is the one explicit write; the optional `Planned date history` is a reading.
 */
export function ClosureSummaryView({
  formatDate,
  onDateHistory,
  onDraft,
  onSave,
  projectId,
  sources,
}: {
  formatDate: (value: string) => string;
  onDateHistory: (
    sources: ReturnType<typeof closureSummarySourcesOfSelection>,
  ) => Promise<ClosureSummaryDateComparison>;
  onDraft: (
    sources: ReturnType<typeof closureSummarySourcesOfSelection>,
  ) => Promise<ClosureSummaryDraft>;
  onSave: (
    input: Parameters<typeof client.saveProjectClosureSummary>[0],
  ) => Promise<{ id: string; title: string }>;
  projectId: string;
  sources: ClosureSummarySources;
}) {
  const initial: { stage: Stage; generation: number } = {
    stage: { kind: "select", selected: [] },
    generation: 0,
  };
  const composer = useCreateStore(initial, ({ setState }) => ({
    setStage: (next: Stage) => setState((state) => ({ ...state, stage: next })),
  }));
  const { stage, generation } = useSelector(composer);
  const { setStage } = composer.actions;
  const draftStage = stage.kind === "draft" ? stage : null;
  const inspect = useMutation({
    meta: { presentsSupportFailure: true },
    mutationFn: ({
      refs,
    }: {
      refs: ReturnType<typeof closureSummarySourcesOfSelection>;
      selected: string[];
      action: ClosureSummarySourceAction;
    }) => onDraft(refs),
    onSuccess: (draft, { action, refs, selected }) => {
      if (action === "generate") {
        composer.setState((state) => ({
          generation: state.generation + 1,
          stage: {
            generation: state.generation + 1,
            kind: "draft",
            markdown: closureSummaryMarkdownOf(projectId, draft.sections),
            saveKey: crypto.randomUUID(),
            sources: refs,
          },
        }));
      } else {
        setStage({ kind: "select", selected });
      }
    },
  });
  const save = useSaveClosureSummary(onSave);
  const comparison = useQuery({
    ...orpc.projectClosureSummaryDateComparison.queryOptions({
      input: draftStage
        ? { projectId, sources: draftStage.sources }
        : skipToken,
    }),
    queryKey: [
      ...orpc.projectClosureSummaryDateComparison.queryKey({
        input: draftStage
          ? { projectId, sources: draftStage.sources }
          : skipToken,
      }),
      draftStage?.saveKey,
    ],
    queryFn: draftStage ? () => onDateHistory(draftStage.sources) : skipToken,
    enabled: false,
    gcTime: 0,
  });
  const saved = save.data;
  const failed = inspect.isError || save.isError || comparison.isError;
  const pending = inspect.isPending || save.isPending;
  const { mutateAsync: inspectAsync, reset: resetInspect } = inspect;
  const { mutateAsync: saveAsync, reset: resetSave } = save;
  const { refetch: fetchComparison } = comparison;
  const failedSave = save.isError ? save.variables : undefined;

  const submitSources = useCallback(
    async (selected: string[], action: ClosureSummarySourceAction) => {
      await inspectAsync({
        refs: closureSummarySourcesOfSelection(selected),
        selected,
        action,
      }).catch(() => undefined);
    },
    [inspectAsync],
  );
  const discard = useCallback(() => {
    resetInspect();
    resetSave();
    setStage({ kind: "select", selected: [] });
  }, [resetInspect, resetSave, setStage]);
  const onDateHistoryClick = useCallback(() => {
    if (draftStage) {
      fetchComparison().catch(() => undefined);
    }
  }, [draftStage, fetchComparison]);
  const onSaveDraft = useCallback(
    async (value: { markdown: string; title: string }) => {
      if (draftStage) {
        await saveAsync(
          commandVariables<
            Omit<
              Parameters<typeof client.saveProjectClosureSummary>[0],
              "clientIdempotencyKey"
            >
          >(
            {
              body: value.markdown,
              baseRevision: 0,
              projectId,
              title: value.title,
            },
            failedSave,
          ),
        );
      }
    },
    [draftStage, failedSave, projectId, saveAsync],
  );

  if (!sources.eligible) {
    return null;
  }

  return (
    <section aria-labelledby="closure-summary-heading" className="space-y-4">
      <h3 className="text-lg font-semibold" id="closure-summary-heading">
        {CLOSURE_SUMMARY_DRAFT_LABEL}
      </h3>
      <p className="text-sm text-muted-foreground">
        {CLOSURE_SUMMARY_DRAFT_NOTE}
      </p>
      {failed ? (
        <p role="alert">The request could not be completed. Try again.</p>
      ) : null}
      {saved ? (
        <p role="status">
          {PROJECT_CLOSURE_SUMMARY_LABEL} saved as a Document.{" "}
          <a
            href={projectRecordHref(projectId, {
              recordId: saved.id,
              recordType: "Document",
            })}
          >
            {saved.title}
          </a>{" "}
          Use {CLOSURE_SUMMARY_WIKI_COPY_LABEL} on the Document to copy it to
          the Personal Wiki.
        </p>
      ) : null}
      {stage.kind === "draft" && !saved ? (
        <>
          <ClosureSummaryEditorForm
            hasDateSources={stage.sources.some(
              (source) => source.recordType === "Work",
            )}
            key={stage.generation}
            markdown={stage.markdown}
            onDateHistory={onDateHistoryClick}
            onDiscard={discard}
            onSave={onSaveDraft}
            pending={pending}
          />
          {comparison.data ? (
            <ClosureSummaryDateHistory
              comparison={comparison.data}
              formatDate={formatDate}
            />
          ) : null}
        </>
      ) : null}
      {stage.kind === "select" ? (
        <>
          <ClosureSummarySourceForm
            groups={sources.groups}
            key={`select-${generation}`}
            onSubmitSources={submitSources}
            pending={pending}
            selected={stage.selected}
          />
          {inspect.data ? <PreviewList preview={inspect.data} /> : null}
        </>
      ) : null}
    </section>
  );
}

function PreviewList({ preview }: { preview: ClosureSummaryDraft }) {
  if (preview.sections.length === 0) {
    return <p role="status">No sources selected.</p>;
  }
  return (
    <ul aria-label="Heading preview" className="space-y-2">
      {preview.sections.map((section) => (
        <li key={section.recordType}>
          <p className="text-sm font-medium">{section.heading}</p>
          <ul className="list-disc pl-5 text-sm">
            {section.sources.map((source) => (
              <li key={source.recordId}>{source.label}</li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
