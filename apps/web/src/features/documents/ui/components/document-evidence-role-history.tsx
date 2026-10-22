import type { DocumentEvidenceHistoryEntry } from "@cantiara/api/document-evidence";

export function EvidenceRoleHistory({
  entries,
}: {
  entries: DocumentEvidenceHistoryEntry[];
}) {
  if (!entries.length) {
    return null;
  }
  return (
    <section aria-label="Evidence Role history">
      <h5 className="font-medium">Evidence Role history</h5>
      <ul>
        {entries.map((entry) => (
          <li key={entry.revision}>
            {entry.previousRole} → {entry.role} · {entry.actorId} ·{" "}
            {entry.changedAt}
            {entry.previousInterpretation === entry.interpretation
              ? null
              : ` · Previous interpretation: ${entry.previousInterpretation ?? "none"}`}
          </li>
        ))}
      </ul>
    </section>
  );
}
