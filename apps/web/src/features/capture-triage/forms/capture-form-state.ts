export type CaptureTemplateId =
	| ""
	| "bug-capture"
	| "feedback-capture"
	| "research-fragment";

export interface CaptureFormValues {
	fields: Record<string, string>;
	projectId: string;
	template: CaptureTemplateId;
	text: string;
}

export const EMPTY_CAPTURE_FORM: CaptureFormValues = {
	fields: {},
	projectId: "",
	template: "",
	text: "",
};

export function captureInboxListInput(projectId: string): {
	projectId?: string;
} {
	const trimmed = projectId.trim();
	return trimmed ? { projectId: trimmed } : {};
}

export function captureFormAfterSave(
	values: CaptureFormValues
): CaptureFormValues {
	return {
		...EMPTY_CAPTURE_FORM,
		projectId: values.projectId,
	};
}

export function captureFormHasUnsavedCapture(
	values: CaptureFormValues
): boolean {
	return (
		values.text.trim() !== "" ||
		values.template !== "" ||
		Object.values(values.fields).some((value) => value.trim() !== "")
	);
}

export function captureInboxListHeading(
	projectId: string,
	copy: {
		projectCaptureInbox: string;
		workspaceCaptureInbox: string;
	}
): string {
	return projectId.trim()
		? copy.projectCaptureInbox
		: copy.workspaceCaptureInbox;
}

export function captureInboxItemPreview(
	item: { body: string; template: string | null },
	templateLabel: string | null
): string {
	const body = item.body.trim();
	if (body) {
		return item.body;
	}
	return templateLabel ?? item.template ?? "";
}

export function createBugIsAvailable(values: CaptureFormValues): boolean {
	return (
		values.projectId.trim() !== "" &&
		(values.template === "" || values.template === "bug-capture")
	);
}

export interface CaptureInboxGroupItem {
	body: string;
	id: string;
	scope: { kind: "workspace" } | { kind: "project"; projectId: string };
	template: string | null;
}

export interface CaptureInboxGroup {
	heading: string;
	items: CaptureInboxGroupItem[];
	projectId: string | null;
}

export function captureInboxGroups(
	items: CaptureInboxGroupItem[],
	copy: {
		projectCaptureInbox: string;
		workspaceCaptureInbox: string;
	}
): CaptureInboxGroup[] {
	const workspaceItems = items.filter(
		(item) => item.scope.kind === "workspace"
	);
	const byProject = new Map<
		string,
		{ items: CaptureInboxGroupItem[]; projectId: string }
	>();
	for (const item of items) {
		if (item.scope.kind !== "project") {
			continue;
		}
		const key = item.scope.projectId.trim().toLocaleLowerCase("en-US");
		const existing = byProject.get(key);
		if (existing) {
			existing.items.push(item);
			continue;
		}
		byProject.set(key, {
			items: [item],
			projectId: item.scope.projectId,
		});
	}
	const groups: CaptureInboxGroup[] = [];
	if (workspaceItems.length > 0) {
		groups.push({
			heading: copy.workspaceCaptureInbox,
			items: workspaceItems,
			projectId: null,
		});
	}
	const projectKeys = [...byProject.keys()].sort((left, right) =>
		left.localeCompare(right, "en-US")
	);
	for (const key of projectKeys) {
		const group = byProject.get(key);
		if (!group) {
			continue;
		}
		groups.push({
			heading: copy.projectCaptureInbox,
			items: group.items,
			projectId: group.projectId,
		});
	}
	return groups;
}

export interface BulkSenseMakingItem {
	body: string;
	id: string;
	template: string | null;
}

export interface BulkSenseMakingPlacement {
	clusterId: string | null;
	itemId: string;
	position: { x: number; y: number };
}

export interface BulkSenseMakingColumn {
	clusterId: string | null;
	items: BulkSenseMakingItem[];
	name: string | null;
}

export function bulkSenseMakingColumns(input: {
	clusters: Array<{ id: string; name: string }>;
	items: BulkSenseMakingItem[];
	placements: BulkSenseMakingPlacement[];
}): BulkSenseMakingColumn[] {
	const itemById = new Map(input.items.map((item) => [item.id, item]));
	const columns: BulkSenseMakingColumn[] = input.clusters.map((cluster) => ({
		clusterId: cluster.id,
		items: [],
		name: cluster.name,
	}));
	const ungrouped: BulkSenseMakingItem[] = [];
	const placed = new Set<string>();
	for (const placement of [...input.placements].sort((left, right) => {
		if (left.position.y !== right.position.y) {
			return left.position.y - right.position.y;
		}
		return left.position.x - right.position.x;
	})) {
		const item = itemById.get(placement.itemId);
		if (!item) {
			continue;
		}
		placed.add(item.id);
		const column = columns.find(
			(candidate) => candidate.clusterId === placement.clusterId
		);
		if (column) {
			column.items.push(item);
			continue;
		}
		ungrouped.push(item);
	}
	for (const item of input.items) {
		if (!placed.has(item.id)) {
			ungrouped.push(item);
		}
	}
	if (ungrouped.length > 0) {
		columns.push({
			clusterId: null,
			items: ungrouped,
			name: null,
		});
	}
	return columns.filter(
		(column) => column.items.length > 0 || column.clusterId !== null
	);
}

export function nextBulkPosition(
	placements: BulkSenseMakingPlacement[],
	clusterId: string | null
): { x: number; y: number } {
	let maxX = -1;
	for (const placement of placements) {
		if (placement.clusterId === clusterId && placement.position.x > maxX) {
			maxX = placement.position.x;
		}
	}
	return { x: maxX + 1, y: 0 };
}

export function bulkClusterPlacementOptions(input: {
	clusters: Array<{ id: string; name: string }>;
	ungrouped: string;
}): Array<{ clusterId: string | null; name: string }> {
	return [
		{ clusterId: null, name: input.ungrouped },
		...input.clusters.map((cluster) => ({
			clusterId: cluster.id,
			name: cluster.name,
		})),
	];
}
