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

interface NamedSource {
  id: string;
  name: string;
  revision: number;
}

/**
 * Risks, Decisions and the Configuration Trash definitions already loaded by the Project overview, newest sources
 * first as given. Other kinds join as their surfaces mount `Move to Trash`.
 */
export function trashCandidates(sources: {
  automationRules?: readonly NamedSource[];
  customFields?: readonly NamedSource[];
  decisions?: readonly SourceRecord[];
  documentTemplates?: readonly NamedSource[];
  risks?: readonly SourceRecord[];
  workTemplates?: readonly NamedSource[];
}): TrashCandidate[] {
  // Configuration Trash: definitions carry a name instead of a title.
  const named = (kind: TrashRecordKind, records: readonly NamedSource[] = []) =>
    records.map(
      (record): TrashCandidate => ({
        id: record.id,
        kind,
        label: record.name,
        revision: record.revision,
      }),
    );
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
    ...named("Custom Field", sources.customFields),
    ...named("Work Template", sources.workTemplates),
    ...named("Automation Rule", sources.automationRules),
    ...named("Document Template", sources.documentTemplates),
  ];
}
