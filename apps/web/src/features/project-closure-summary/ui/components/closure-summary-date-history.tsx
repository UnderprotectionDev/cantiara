import {
  CLOSURE_SUMMARY_DATE_HISTORY_LABEL,
  type ClosureSummaryDateComparison,
} from "@cantiara/api/project-closure-summary";

/**
 * Neutral date comparison: planned date history against the existing
 * completion event. Text only; it carries no score, health or colour verdict.
 */
export function ClosureSummaryDateHistory({
  comparison,
}: {
  comparison: ClosureSummaryDateComparison;
}) {
  return (
    <section
      aria-label={CLOSURE_SUMMARY_DATE_HISTORY_LABEL}
      className="space-y-2"
    >
      <p className="text-muted-foreground text-sm">{comparison.note}</p>
      {comparison.rows.length === 0 ? (
        <p role="status">No selected record has a planned date.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {comparison.rows.map((row) => (
            <li key={`${row.recordType}:${row.recordId}`}>
              <span className="font-medium">{row.label}</span>
              {": "}
              {row.plannedDates.join(" → ")}
              {row.moved ? ". Moved" : ""}
              {". "}
              {row.reading}
              {row.closedOn ? ` (${row.closedOn})` : ""}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
