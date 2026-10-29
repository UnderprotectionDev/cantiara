import type { TrashRecordKind } from "@cantiara/api/trash";

/** A live record the founder can send to Trash from the Trash surface. */
export interface TrashCandidate {
  id: string;
  kind: TrashRecordKind;
  label: string;
  /** The revision the founder is looking at; the server rejects a stale one. */
  revision: number;
}

interface SourceRecord {
  id: string;
  revision: number;
  title: string;
}

/**
 * Risks and Decisions already loaded by the Project overview, newest sources
 * first as given. Other kinds join as their surfaces mount `Move to Trash`.
 */
export function trashCandidates(sources: {
  decisions?: readonly SourceRecord[];
  risks?: readonly SourceRecord[];
}): TrashCandidate[] {
  const candidates = (
    kind: TrashRecordKind,
    records: readonly SourceRecord[] = [],
  ) =>
    records.map(
      (record): TrashCandidate => ({
        id: record.id,
        kind,
        label: record.title,
        revision: record.revision,
      }),
    );
  return [
    ...candidates("Risk", sources.risks),
    ...candidates("Decision", sources.decisions),
  ];
}
