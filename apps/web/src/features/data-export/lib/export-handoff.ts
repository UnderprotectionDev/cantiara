import type { ExportScope, ExportView } from "@cantiara/api/data-export";

/**
 * What a list screen hands to the Export surface: the on-screen scope, the
 * view name and sort, the active filters, the visible columns in order and the
 * ids of the records shown (or selected), grouped by record type because one
 * Export covers one record type. It lives in memory for one navigation; nothing
 * is saved, so no named view, report or subscription is created.
 */
export interface ExportHandoff {
  filters: Record<string, string>;
  recordIdsByType: Record<string, string[]>;
  scope: ExportScope;
  view: ExportView;
  visibleFields?: string[];
}

const STORAGE_KEY = "cantiara.export-handoff";

export function setExportHandoff(handoff: ExportHandoff) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(handoff));
  } catch {
    // Storage is unavailable or full: Export then opens blank, never wrong.
  }
}

/** Returns the handoff once; a reload or a second visit starts blank. */
export function takeExportHandoff(): ExportHandoff | null {
  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    window.sessionStorage.removeItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as ExportHandoff) : null;
  } catch {
    return null;
  }
}

export function groupRecordIdsByType(
  records: ReadonlyArray<{ id: string; type: string }>,
): Record<string, string[]> {
  const grouped: Record<string, string[]> = {};
  for (const record of records) {
    const ids = grouped[record.type] ?? [];
    ids.push(record.id);
    grouped[record.type] = ids;
  }
  return grouped;
}

/** The scope of a list: one Project, or a selection of Projects. */
export function scopeForProjects(projectIds: readonly string[]): ExportScope {
  const [only] = projectIds;
  return projectIds.length === 1 && only
    ? { kind: "project", projectId: only }
    : { kind: "cross-project", projectIds: [...projectIds] };
}

/** Work columns every Work list shows, in on-screen order. */
export const WORK_LIST_EXPORT_FIELDS = ["key", "title", "type", "status"];
