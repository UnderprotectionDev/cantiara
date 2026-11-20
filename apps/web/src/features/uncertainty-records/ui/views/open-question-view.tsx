// biome-ignore-all lint/performance/noJsxPropsBind: Fields and actions bind to the current question form.
import type { DocumentEvidenceSelection } from "@cantiara/api/documents";
import { Button } from "@cantiara/ui/components/button";

import type { OpenQuestionRecord } from "../forms/open-question-editor-form";

export function OpenQuestionDetail({
  closeFailed = false,
  closePending = false,
  record,
  evidence,
  readOnly = false,
  onAnswer,
  onClose,
}: {
  closeFailed?: boolean;
  closePending?: boolean;
  record: OpenQuestionRecord;
  evidence: DocumentEvidenceSelection[];
  readOnly?: boolean;
  onAnswer: () => void;
  onClose: () => Promise<unknown>;
}) {
  function close() {
    onClose().catch(() => undefined);
  }
  return (
    <article
      aria-label="Open Question"
      className="space-y-4 rounded-lg border border-border/70 p-5"
    >
      <h3 className="text-xl font-semibold">{record.title}</h3>
      <p>{record.life}</p>
      <dl className="space-y-3">
        {[
          ["Question", record.question],
          ["Context", record.context],
          ["Answer", record.answer],
          ["Rationale", record.rationale],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="font-medium">{label}</dt>
            <dd className="break-words whitespace-pre-wrap text-muted-foreground">
              {value || "—"}
            </dd>
          </div>
        ))}
      </dl>
      <section aria-label="Evidence" className="space-y-2">
        <h4 className="font-medium">Evidence</h4>
        {evidence.length ? (
          evidence.map((item) => (
            <div
              className="rounded border p-3"
              key={`${item.documentId}:${item.documentRevision}:${item.selectionStart}:${item.selectionEnd}`}
            >
              <p>Version {item.documentRevision}</p>
              <blockquote className="break-words whitespace-pre-wrap">
                {item.selectedText}
              </blockquote>
            </div>
          ))
        ) : (
          <p className="text-muted-foreground">No evidence linked.</p>
        )}
      </section>
      {closeFailed ? (
        <p role="alert">Open Question could not be closed. Try again.</p>
      ) : null}
      {readOnly ? null : (
        <div className="flex flex-wrap gap-2">
          {record.life === "Open" ? (
            <Button disabled={closePending} onClick={onAnswer}>
              Answered
            </Button>
          ) : null}
          {record.life === "No longer applicable" ? null : (
            <Button disabled={closePending} onClick={close} variant="outline">
              {closePending ? "Saving…" : "No longer applicable"}
            </Button>
          )}
        </div>
      )}
    </article>
  );
}
