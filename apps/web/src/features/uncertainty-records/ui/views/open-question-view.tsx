// biome-ignore-all lint/performance/noJsxPropsBind: Fields and actions bind to the current question form.
import type { DocumentEvidenceSelection } from "@cantiara/api/documents";
import { Button } from "@cantiara/ui/components/button";
import { useState } from "react";

import type { OpenQuestionRecord } from "../forms/open-question-editor-form";

export function OpenQuestionDetail({
  record,
  evidence,
  readOnly = false,
  onAnswer,
  onClose,
}: {
  record: OpenQuestionRecord;
  evidence: DocumentEvidenceSelection[];
  readOnly?: boolean;
  onAnswer: () => void;
  onClose: () => Promise<unknown>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  async function close() {
    setPending(true);
    setError(undefined);
    try {
      await onClose();
    } catch {
      setError(
        "Open Question could not be saved. Reload to check for changes, or retry.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <article
      aria-label="Open Question"
      className="space-y-4 rounded-lg border border-border/70 p-5"
    >
      <h3 className="font-semibold text-xl">{record.title}</h3>
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
            <dd className="whitespace-pre-wrap break-words text-muted-foreground">
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
              <blockquote className="whitespace-pre-wrap break-words">
                {item.selectedText}
              </blockquote>
            </div>
          ))
        ) : (
          <p className="text-muted-foreground">No evidence linked.</p>
        )}
      </section>
      {error ? <p role="alert">{error}</p> : null}
      {readOnly ? null : (
        <div className="flex flex-wrap gap-2">
          {record.life === "Open" ? (
            <Button disabled={pending} onClick={onAnswer}>
              Answered
            </Button>
          ) : null}
          {record.life === "No longer applicable" ? null : (
            <Button disabled={pending} onClick={close} variant="outline">
              {pending ? "Saving…" : "No longer applicable"}
            </Button>
          )}
        </div>
      )}
    </article>
  );
}
