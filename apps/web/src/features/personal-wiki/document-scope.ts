import type { Document } from "@cantiara/api/documents";

export type DocumentScopeFilter =
  | { kind: "all" }
  | { kind: "wiki" }
  | { kind: "project"; projectId: string };

export function documentsInScope(
  documents: readonly Document[],
  scope: DocumentScopeFilter,
): Document[] {
  if (scope.kind === "all") {
    return [...documents];
  }
  const projectId = scope.kind === "wiki" ? null : scope.projectId;
  return documents.filter((record) => record.projectId === projectId);
}

export function documentScopeLabel(projectId: string | null): string {
  return projectId === null ? "Personal Wiki" : `Project: ${projectId}`;
}
