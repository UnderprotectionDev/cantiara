import {
  CLOSURE_SUMMARY_DRAFT_LABEL,
  CLOSURE_SUMMARY_DRAFT_NOTE,
  CLOSURE_SUMMARY_WIKI_COPY_LABEL,
  type ClosureSummaryDateComparison,
  type ClosureSummaryDraft,
  type ClosureSummarySources,
  PROJECT_CLOSURE_SUMMARY_LABEL,
} from "@cantiara/api/project-closure-summary";
import { useCallback, useState } from "react";
import { projectRecordHref } from "@/features/project-history/lib/project-record-links";
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
  | { kind: "select"; preview: ClosureSummaryDraft | null; selected: string[] }
  | {
      generation: number;
      kind: "draft";
      markdown: string;
      saveKey: string;
      sources: ReturnType<typeof closureSummarySourcesOfSelection>;
    }
  | { documentId: string; kind: "saved"; title: string };

/**
 * Closure Summary Draft of a completed or abandoned Project: select sources,
 * preview which source lands under which heading, generate the editable
 * headings-and-links text, discard it. The draft lives in this component's
 * state only; closing or discarding it leaves no record. `Save as Document`
 * is the one explicit write; the optional `Planned date history` is a reading.
 */
export function ClosureSummaryView({
  onDateHistory,
  onDraft,
  onSave,
  projectId,
  sources,
}: {
  onDateHistory: (
    sources: ReturnType<typeof closureSummarySourcesOfSelection>,
  ) => Promise<ClosureSummaryDateComparison>;
  onDraft: (
    sources: ReturnType<typeof closureSummarySourcesOfSelection>,
  ) => Promise<ClosureSummaryDraft>;
  onSave: (input: {
    body: string;
    clientIdempotencyKey: string;
    title: string;
  }) => Promise<{ id: string; title: string }>;
  projectId: string;
  sources: ClosureSummarySources;
}) {
  const [stage, setStage] = useState<Stage>({
    kind: "select",
    preview: null,
    selected: [],
  });
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [comparison, setComparison] =
    useState<ClosureSummaryDateComparison | null>(null);

  const submitSources = useCallback(
    async (selected: string[], action: ClosureSummarySourceAction) => {
      setPending(true);
      setFailed(false);
      try {
        const refs = closureSummarySourcesOfSelection(selected);
        const draft = await onDraft(refs);
        if (action === "generate") {
          setGeneration((value) => value + 1);
          setComparison(null);
          setStage({
            generation: generation + 1,
            kind: "draft",
            markdown: closureSummaryMarkdownOf(projectId, draft.sections),
            saveKey: crypto.randomUUID(),
            sources: refs,
          });
        } else {
          setStage({ kind: "select", preview: draft, selected });
        }
      } catch {
        setFailed(true);
      } finally {
        setPending(false);
      }
    },
    [generation, onDraft, projectId],
  );
  const discard = useCallback(() => {
    setComparison(null);
    setStage({ kind: "select", preview: null, selected: [] });
  }, []);
  const save = useCallback(
    async (
      draft: Extract<Stage, { kind: "draft" }>,
      value: { markdown: string; title: string },
    ) => {
      setPending(true);
      setFailed(false);
      try {
        // The idempotency key stays stable per draft, so a retry after a lost
        // response returns the same Document instead of a second one.
        const document = await onSave({
          body: value.markdown,
          clientIdempotencyKey: draft.saveKey,
          title: value.title,
        });
        setStage({
          documentId: document.id,
          kind: "saved",
          title: document.title,
        });
      } catch {
        setFailed(true);
      } finally {
        setPending(false);
      }
    },
    [onSave],
  );
  const readDateHistory = useCallback(
    async (draft: Extract<Stage, { kind: "draft" }>) => {
      setFailed(false);
      try {
        setComparison(await onDateHistory(draft.sources));
      } catch {
        setFailed(true);
      }
    },
    [onDateHistory],
  );

  const draftStage = stage.kind === "draft" ? stage : null;
  const onDateHistoryClick = useCallback(() => {
    if (draftStage) {
      readDateHistory(draftStage);
    }
  }, [draftStage, readDateHistory]);
  const onSaveDraft = useCallback(
    (value: { markdown: string; title: string }) => {
      if (draftStage) {
        save(draftStage, value);
      }
    },
    [draftStage, save],
  );

  if (!sources.eligible) {
    return null;
  }

  return (
    <section aria-labelledby="closure-summary-heading" className="space-y-4">
      <h3 className="font-semibold text-lg" id="closure-summary-heading">
        {CLOSURE_SUMMARY_DRAFT_LABEL}
      </h3>
      <p className="text-muted-foreground text-sm">
        {CLOSURE_SUMMARY_DRAFT_NOTE}
      </p>
      {failed ? (
        <p role="alert">The request could not be completed. Try again.</p>
      ) : null}
      {stage.kind === "saved" ? (
        <p role="status">
          {PROJECT_CLOSURE_SUMMARY_LABEL} saved as a Document.{" "}
          <a
            href={projectRecordHref(projectId, {
              recordId: stage.documentId,
              recordType: "Document",
            })}
          >
            {stage.title}
          </a>{" "}
          Use {CLOSURE_SUMMARY_WIKI_COPY_LABEL} on the Document to copy it to
          the Personal Wiki.
        </p>
      ) : null}
      {stage.kind === "draft" ? (
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
          {comparison ? (
            <ClosureSummaryDateHistory comparison={comparison} />
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
          {stage.preview ? <PreviewList preview={stage.preview} /> : null}
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
          <p className="font-medium text-sm">{section.heading}</p>
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
