import type {
  CreateSmartCollectionInput,
  SmartCollectionSourceType,
  SmartCollectionViewSource,
} from "@cantiara/api/smart-collections";

export interface SmartCollectionMembershipPreviewRecord {
  documentType?: string;
  projectId: string | null;
  sourceType: SmartCollectionSourceType;
  status?: string;
  workspaceId: string | null;
  workType?: string;
}

export interface SmartCollectionMembershipFieldChange {
  field: "Document type" | "Status" | "Work type";
  from: string;
  to: string;
}

type SmartCollectionMembershipPreviewView = Pick<
  SmartCollectionViewSource,
  "conditions" | "scope" | "sourceType" | "workspaceId"
>;

type SmartCollectionMembershipConditions =
  CreateSmartCollectionInput["conditions"];

function isInCollectionScope(
  record: SmartCollectionMembershipPreviewRecord,
  view: SmartCollectionMembershipPreviewView,
) {
  if (record.sourceType !== view.sourceType) {
    return false;
  }

  if (view.sourceType === "Wiki Document") {
    return record.workspaceId === view.workspaceId;
  }

  return (
    record.projectId !== null &&
    view.scope.projectIds.includes(record.projectId)
  );
}

function fieldChange(
  field: SmartCollectionMembershipFieldChange["field"],
  from: string | undefined,
  to: string | undefined,
): SmartCollectionMembershipFieldChange | null | undefined {
  if (to === undefined || from === to) {
    return undefined;
  }
  if (from === undefined) {
    return null;
  }
  return { field, from, to };
}

export function previewSmartCollectionMembership(
  record: SmartCollectionMembershipPreviewRecord,
  view: SmartCollectionMembershipPreviewView,
): SmartCollectionMembershipFieldChange[] | null {
  if (!isInCollectionScope(record, view)) {
    return null;
  }

  const conditions: SmartCollectionMembershipConditions = view.conditions;

  // Tag membership is a set-containment condition, not a direct field equality.
  // The preview must not imply that changing another field would satisfy it.
  if (conditions.tag !== undefined) {
    return null;
  }

  const proposedChanges = [
    fieldChange("Status", record.status, conditions.status),
    fieldChange("Work type", record.workType, conditions.type),
    fieldChange("Document type", record.documentType, conditions.documentType),
  ];
  if (proposedChanges.some((change) => change === null)) {
    return null;
  }

  const changes = proposedChanges.filter(
    (change): change is SmartCollectionMembershipFieldChange =>
      change !== null && change !== undefined,
  );
  return changes.length > 0 ? changes : null;
}
