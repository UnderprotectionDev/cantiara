import type {
  CaptureBulkCluster,
  CaptureBulkPlacement,
  CaptureBulkSenseMaking,
  CaptureInboxItem,
  CaptureTemplate,
  CaptureUndoMergePreview,
} from "@cantiara/api/capture-triage";
import type { ProjectProfile } from "@cantiara/api/project-shell";

export interface CaptureFormValues {
  content: string;
  fields: Record<string, string>;
  projectId: string;
  template: "" | CaptureTemplate;
}

export const CREATE_BUG_UNAVAILABLE_MESSAGE =
  "Create Bug is available when Project is set and type is Bug Capture or unspecified.";

type CaptureProject = Pick<ProjectProfile, "id" | "name" | "shortCode">;

export function captureProjectLabel(project: CaptureProject) {
  return `${project.name} (${project.shortCode})`;
}

export function captureDestination(
  projectId: string,
  projects: readonly CaptureProject[] = [],
) {
  const normalizedProjectId = projectId.trim();
  if (normalizedProjectId) {
    const project = projects.find(({ id }) => id === normalizedProjectId);
    return {
      detail: `This capture will appear under ${
        project ? captureProjectLabel(project) : "the selected Project"
      }.`,
      label: "Project Capture Inbox",
    };
  }

  return {
    detail: "This capture will appear here until you choose what happens next.",
    label: "Workspace Capture Inbox",
  };
}

export function captureInput(
  values: CaptureFormValues,
  clientIdempotencyKey: string,
) {
  return {
    clientIdempotencyKey,
    content: values.content,
    fields: Object.fromEntries(
      Object.entries(values.fields).filter(([, value]) => value.length > 0),
    ),
    projectId: values.projectId.trim() || null,
    template: values.template || null,
  };
}

export function captureFormValuesEqual(
  left: CaptureFormValues,
  right: CaptureFormValues,
) {
  const leftFields = Object.entries(left.fields);
  const rightFields = Object.entries(right.fields);
  return (
    left.content === right.content &&
    left.projectId === right.projectId &&
    left.template === right.template &&
    leftFields.length === rightFields.length &&
    leftFields.every(([label, value]) => right.fields[label] === value)
  );
}

export interface BulkSenseMakingColumn {
  clusterId: string | null;
  items: CaptureInboxItem[];
  label: string;
  position: number;
}

export interface BulkSenseMakingDraft {
  clusters: CaptureBulkCluster[];
  placements: CaptureBulkPlacement[];
}

export interface UndoPreviewState {
  mergeId: string;
  preview: CaptureUndoMergePreview;
}

export function captureCountLabel(count: number) {
  return `${count} ${count === 1 ? "capture" : "captures"}`;
}

export function triageErrorMessage() {
  return "This action could not be completed.";
}

export function itemOriginLabel(item: CaptureInboxItem) {
  if (!item.origin) {
    return null;
  }
  return typeof item.origin === "string" ? item.origin : item.origin.kind;
}

export function bulkSenseMakingColumns(
  items: readonly CaptureInboxItem[],
  layout: CaptureBulkSenseMaking,
): BulkSenseMakingColumn[] {
  const placements = new Map(
    layout.placements.map((placement) => [placement.itemId, placement]),
  );
  const sortedClusters = [...layout.clusters].sort(
    (left, right) =>
      left.position - right.position || left.id.localeCompare(right.id),
  );
  const columns = new Map<string | null, BulkSenseMakingColumn>();
  columns.set(null, {
    clusterId: null,
    items: [],
    label: "Ungrouped",
    position: -1,
  });
  for (const cluster of sortedClusters) {
    columns.set(cluster.id, {
      clusterId: cluster.id,
      items: [],
      label: cluster.name,
      position: cluster.position,
    });
  }

  for (const item of items) {
    const placement = placements.get(item.id);
    const column =
      columns.get(placement?.clusterId ?? null) ?? columns.get(null);
    column?.items.push(item);
  }

  for (const column of columns.values()) {
    column.items.sort((left, right) => {
      const leftPosition =
        placements.get(left.id)?.position ?? Number.MAX_SAFE_INTEGER;
      const rightPosition =
        placements.get(right.id)?.position ?? Number.MAX_SAFE_INTEGER;
      return (
        leftPosition - rightPosition ||
        left.createdAt.localeCompare(right.createdAt)
      );
    });
  }

  return [...columns.values()];
}
