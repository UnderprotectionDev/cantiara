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
    "GitHub Completion": "GitHub completion links do not travel.",
    Automation: "Automation links stay with the source Work.",
    "Planning Membership": "Planning membership stays with the source Project.",
    Publish: "Publish links stay with the source Project.",
    Parentage: "Parentage stays with the source Project.",
    "Merge State": "Merge state stays with the source Work.",
    History: "History stays with the source Work.",
    "Closure Result": "Closure result stays with the source Work.",
    Status: "Current status stays with the source Work.",
    Date: "Dates stay with the source Work.",
    Origin: "Origin stays with the recreated Work.",
  };

export function describeWorkRecreateRelation(kind: WorkRecreateRelationKind) {
  const portable = PORTABLE_RELATION_KINDS.has(kind);
  return {
    label: kind === "GitHub Completion" ? "Required for completion" : kind,
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
