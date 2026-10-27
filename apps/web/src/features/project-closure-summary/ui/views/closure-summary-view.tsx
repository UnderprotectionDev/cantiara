import {
  CLOSURE_SUMMARY_DRAFT_LABEL,
  CLOSURE_SUMMARY_DRAFT_NOTE,
  type ClosureSummaryDraft,
  type ClosureSummarySources,
} from "@cantiara/api/project-closure-summary";
import { useCallback, useState } from "react";
import {
  closureSummaryMarkdownOf,
  closureSummarySourcesOfSelection,
} from "../../lib/closure-summary-draft";
import { ClosureSummaryEditorForm } from "../forms/closure-summary-editor-form";
import {
  type ClosureSummarySourceAction,
  ClosureSummarySourceForm,
} from "../forms/closure-summary-source-form";

type Stage =
  | { kind: "select"; preview: ClosureSummaryDraft | null; selected: string[] }
  | { generation: number; kind: "draft"; markdown: string };

/**
 * Closure Summary Draft of a completed or abandoned Project: select sources,
 * preview which source lands under which heading, generate the editable
 * headings-and-links text, discard it. The draft lives in this component's
 * state only; closing or discarding it leaves no record.
 */
export function ClosureSummaryView({
  onDraft,
  projectId,
  sources,
}: {
  onDraft: (
    sources: ReturnType<typeof closureSummarySourcesOfSelection>,
  ) => Promise<ClosureSummaryDraft>;
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

  const submitSources = useCallback(
    async (selected: string[], action: ClosureSummarySourceAction) => {
      setPending(true);
      setFailed(false);
      try {
        const draft = await onDraft(closureSummarySourcesOfSelection(selected));
        if (action === "generate") {
          setGeneration((value) => value + 1);
          setStage({
            generation: generation + 1,
            kind: "draft",
            markdown: closureSummaryMarkdownOf(projectId, draft.sections),
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
  const discard = useCallback(
    () => setStage({ kind: "select", preview: null, selected: [] }),
    [],
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
        <p role="alert">The draft could not be generated. Try again.</p>
      ) : null}
      {stage.kind === "draft" ? (
        <ClosureSummaryEditorForm
          key={stage.generation}
          markdown={stage.markdown}
          onDiscard={discard}
        />
      ) : (
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
      )}
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
