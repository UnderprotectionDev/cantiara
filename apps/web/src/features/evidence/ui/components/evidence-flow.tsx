import {
  EVIDENCE_FLOW_SOURCE_TYPES,
  type EvidenceFlowRow,
  type EvidenceFlowSourceType,
} from "@cantiara/api/document-evidence";
import type { ChangeEvent } from "react";
import { documentRecordHash } from "@/features/project-shell/lib/project-shell-navigation";

/** Derived list of explicit `Kanıtı` relations; a plain ordered list, never a visual-only timeline. */
export default function EvidenceFlow({
  rows,
  sourceType,
  onSourceTypeChange,
}: {
  /** `undefined` while the flow is still loading. */
  rows: EvidenceFlowRow[] | undefined;
  sourceType: EvidenceFlowSourceType | null;
  onSourceTypeChange: (value: EvidenceFlowSourceType | null) => void;
}) {
  function changeSourceType(event: ChangeEvent<HTMLSelectElement>) {
    onSourceTypeChange(
      EVIDENCE_FLOW_SOURCE_TYPES.find((type) => type === event.target.value) ??
        null,
    );
  }
  return (
    <section aria-label="Evidence Flow" className="space-y-2">
      <h4 className="font-medium">Evidence Flow</h4>
      <label className="flex items-center gap-2">
        <span>Source type</span>
        <select onChange={changeSourceType} value={sourceType ?? ""}>
          <option value="">All</option>
          {EVIDENCE_FLOW_SOURCE_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>
      {rows === undefined ? (
        <p role="status">Loading Evidence Flow…</p>
      ) : (
        <EvidenceFlowRows rows={rows} />
      )}
    </section>
  );
}

function EvidenceFlowRows({ rows }: { rows: EvidenceFlowRow[] }) {
  if (!rows.length) {
    return <p>No explicit evidence for this filter.</p>;
  }
  return (
    <ol className="space-y-2">
      {rows.map((row) => (
        <EvidenceFlowItem key={row.id} row={row} />
      ))}
    </ol>
  );
}

/** Only Document has an exact-record route; Source and Research Session rows show no open control yet. */
function openSourceRecordHref(row: EvidenceFlowRow) {
  if (
    row.sourceType !== "Document" ||
    !(row.source.projectId && row.source.canOpenSourceRecord)
  ) {
    return null;
  }
  return `/projects/${encodeURIComponent(row.source.projectId)}#${documentRecordHash(row.source.recordId)}`;
}

function EvidenceFlowItem({ row }: { row: EvidenceFlowRow }) {
  const openHref = openSourceRecordHref(row);
  return (
    <li>
      <p>
        {row.sourceType}: {row.source.title ?? "Unavailable source"}
      </p>
      <p>
        Evidence <time dateTime={row.relatedAt}>{row.relatedAt}</time>
      </p>
      {row.pin ? (
        <p className="whitespace-pre-wrap break-words">
          Version {row.pin.source.revision} · Range {row.pin.start}–
          {row.pin.end} · {row.pin.excerpt}
        </p>
      ) : null}
      {row.elementMissing ? <p>Source element no longer exists</p> : null}
      {row.newerVersionExists ? <p>Newer version exists</p> : null}
      {row.role ? <p>Evidence Role: {row.role}</p> : null}
      {row.interpretation ? (
        <p className="whitespace-pre-wrap break-words">
          Founder interpretation: {row.interpretation}
        </p>
      ) : null}
      {row.source.brokenReason ? <p>{row.source.brokenReason}</p> : null}
      {openHref ? <a href={openHref}>Open source record</a> : null}
    </li>
  );
}
