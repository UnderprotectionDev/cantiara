import type { ToolEscapeCloseRecord } from "@cantiara/api/product-gaps";

/** The stored close as readable text. A note or screenshot is never shown as proof. */
export function ToolEscapeCloseEvidence({
  close,
  formatDateTime,
}: {
  close: ToolEscapeCloseRecord;
  formatDateTime: (value: string) => string;
}) {
  const highImpact = close.impact !== "Never held parallel truth";
  return (
    <section
      aria-label="Close evidence"
      className="space-y-1 rounded-md border border-border/70 p-3"
    >
      <h4 className="font-medium">
        Closed{" "}
        <time dateTime={close.closedAt}>{formatDateTime(close.closedAt)}</time>
      </h4>
      <p>{`Impact judged: ${close.impact}`}</p>
      {highImpact ? (
        <>
          <p>{`Workflow succeeded on candidate build ${close.candidateBuild} (run ${close.workflowRef}).`}</p>
          <p>{`Truth restored by ${close.restoreMethod} in:`}</p>
          <ul aria-label="Restored product records" className="list-disc pl-5">
            {close.records.map((record) => (
              <li key={`${record.targetType}:${record.targetId}`}>
                {record.state === "resolved"
                  ? `${record.targetType}: ${record.label ?? ""}`
                  : `${record.targetType}: unavailable (${record.brokenReason ?? "No access"})`}
              </li>
            ))}
          </ul>
          <p className="whitespace-pre-wrap">{`External copy closed: ${close.externalCopyHow}`}</p>
        </>
      ) : null}
    </section>
  );
}
