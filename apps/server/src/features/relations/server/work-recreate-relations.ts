import type { WorkRecreateRelationKind } from "@cantiara/api/work-lifecycle";

const PORTABLE_RELATION_KINDS = new Set<WorkRecreateRelationKind>([
  "Related",
  "Evidence",
  "Contributes to Goal",
  "Contributes to Milestone",
  "Implements",
]);

const NON_PORTABLE_REASONS: Partial<Record<WorkRecreateRelationKind, string>> =
  {
    "Required for completion": "Completion links stay with the source Work.",
    Origin: "Origin stays with the recreated Work.",
  };

export function describeWorkRecreateRelation(kind: WorkRecreateRelationKind) {
  const portable = PORTABLE_RELATION_KINDS.has(kind);
  return {
    label: kind,
    ...(portable
      ? {}
      : {
          nonPortableReason:
            NON_PORTABLE_REASONS[kind] ??
            "This relation stays with the source Work.",
        }),
    portable,
  };
}
