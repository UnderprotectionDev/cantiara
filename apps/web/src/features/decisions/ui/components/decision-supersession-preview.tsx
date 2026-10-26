// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind their current Decision selection.
import type {
  DecisionSupersessionGraph,
  DecisionSupersessionPreview,
} from "@cantiara/api/decision-supersession";
import { Button } from "@cantiara/ui/components/button";

export function DecisionSupersessionPreviewView({
  preview,
  pending,
  conflict = false,
  onConfirm,
  onCancel,
}: {
  preview: DecisionSupersessionPreview;
  pending: boolean;
  conflict?: boolean;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}) {
  const confirmLabel =
    preview.command.operation === "supersede"
      ? "Confirm supersession"
      : "Confirm removal";
  const ids = [preview.command.successorId, ...preview.command.predecessorIds];
  return (
    <section
      aria-label="Supersession preview"
      className="space-y-4 rounded-lg border p-5"
    >
      <h3 className="font-medium">Preview</h3>
      {ids.map((id) => {
        const record = preview.graph.records.find((item) => item.id === id);
        if (!record) {
          return null;
        }
        const change = preview.changes.find((item) => item.id === id);
        return (
          <article className="space-y-2 border-b pb-3" key={id}>
            <h4 className="font-medium">{record.title}</h4>
            <p>{change ? `${change.before} → ${change.after}` : record.life}</p>
            <p className="whitespace-pre-wrap break-words">{record.decision}</p>
            <p className="whitespace-pre-wrap break-words">
              Rationale: {record.rationale || "—"}
            </p>
            <ul aria-label="Evidence">
              {preview.graph.evidence
                .filter((item) => item.decisionId === id)
                .map((item) => (
                  <li className="break-words" key={item.id}>
                    {item.title}
                    {item.excerpt ? ` — ${item.excerpt}` : ""}
                  </li>
                ))}
            </ul>
          </article>
        );
      })}
      {preview.command.operation === "remove" ? (
        <ul aria-label="Supersedes" className="space-y-2">
          {preview.graph.relations.map((edge) => (
            <li className="break-words" key={edge.predecessorId}>
              <SupersessionRelationSummary
                records={preview.graph.records}
                relation={edge}
              />
            </li>
          ))}
        </ul>
      ) : null}
      <p className="whitespace-pre-wrap break-words">
        Transition rationale: {preview.command.rationale || "—"}
      </p>
      <p>
        Only full replacement uses Supersedes. Related records and their status,
        priority and planning stay unchanged.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button disabled={pending || conflict} onClick={() => onConfirm()}>
          {pending ? "Saving…" : null}
          {pending ? null : <span>{confirmLabel}</span>}
        </Button>
        <Button disabled={pending} onClick={onCancel} variant="outline">
          Cancel
        </Button>
      </div>
    </section>
  );
}

export function SupersessionRelationSummary({
  records,
  relation,
}: {
  records: DecisionSupersessionGraph["records"];
  relation: DecisionSupersessionGraph["relations"][number];
}) {
  return (
    <span>
      {records.find((record) => record.id === relation.predecessorId)?.title} →{" "}
      {records.find((record) => record.id === relation.successorId)?.title}
    </span>
  );
}
