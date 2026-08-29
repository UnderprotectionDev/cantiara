import { WORKSPACE_OVERVIEW_COPY } from "./workspace-overview-copy";

export const CROSS_PROJECT_LIST_KIND = "workspaceCrossProjectList" as const;

export const CROSS_PROJECT_LIST_COLUMNS = [
	"name",
	"lifecycle",
	"stage",
	"targetDate",
	"areas",
	"lastReportedHealth",
] as const;

export type CrossProjectListColumn =
	(typeof CROSS_PROJECT_LIST_COLUMNS)[number];

export interface ManualProjectUpdateMark {
	date: string;
	mark: string;
}

export interface CrossProjectListProject {
	archived: boolean;
	enabledAreas: readonly string[];
	id: string;
	lastManualProjectUpdate: ManualProjectUpdateMark | null;
	lifecycleStatus: string;
	name: string;
	stageNames: readonly string[];
	targetDate: string | null;
}

export interface CrossProjectListConditions {
	archived: boolean | null;
	enabledAreas: readonly string[];
	lifecycleStatuses: readonly string[];
	stageNames: readonly string[];
	targetDateOnOrAfter: string | null;
	targetDateOnOrBefore: string | null;
}

export interface CrossProjectListSort {
	column: CrossProjectListColumn;
	direction: "asc" | "desc";
}

export interface SavedCrossProjectListDefinition {
	columns: readonly CrossProjectListColumn[];
	conditions: CrossProjectListConditions;
	grouping: CrossProjectListColumn | null;
	id: string;
	name: string;
	sort: CrossProjectListSort;
}

export interface LastReportedHealthView {
	date: string;
	label: typeof WORKSPACE_OVERVIEW_COPY.lastReportedHealth;
	mark: string;
}

export interface CrossProjectListRow {
	areas: readonly string[];
	id: string;
	lastReportedHealth: LastReportedHealthView | null;
	lifecycle: string;
	name: string;
	stage: string | null;
	targetDate: string | null;
}

export interface CrossProjectListGroup {
	heading: string;
	rows: CrossProjectListRow[];
}

export interface EvaluatedCrossProjectList {
	columns: readonly CrossProjectListColumn[];
	conditions: CrossProjectListConditions;
	grouping: CrossProjectListColumn | null;
	groups: CrossProjectListGroup[] | null;
	id: string;
	kind: typeof CROSS_PROJECT_LIST_KIND;
	name: string;
	rows: CrossProjectListRow[];
	sort: CrossProjectListSort;
}

export interface SaveCrossProjectListInput {
	columns?: readonly CrossProjectListColumn[];
	conditions?: Partial<CrossProjectListConditions>;
	grouping?: CrossProjectListColumn | null;
	id?: string;
	name: string;
	sort?: CrossProjectListSort;
}

const COLUMN_SET = new Set<string>(CROSS_PROJECT_LIST_COLUMNS);
const DEFAULT_COLUMNS: CrossProjectListColumn[] = [
	...CROSS_PROJECT_LIST_COLUMNS,
];
const DEFAULT_SORT: CrossProjectListSort = {
	column: "name",
	direction: "asc",
};
const EMPTY_CONDITIONS: CrossProjectListConditions = {
	archived: null,
	enabledAreas: [],
	lifecycleStatuses: [],
	stageNames: [],
	targetDateOnOrAfter: null,
	targetDateOnOrBefore: null,
};

function isColumn(value: string): value is CrossProjectListColumn {
	return COLUMN_SET.has(value);
}

function normalizeConditions(
	value: Partial<CrossProjectListConditions> | undefined
): CrossProjectListConditions {
	return {
		archived:
			typeof value?.archived === "boolean" || value?.archived === null
				? value.archived
				: null,
		enabledAreas: (value?.enabledAreas ?? []).filter(
			(item): item is string => typeof item === "string" && item.length > 0
		),
		lifecycleStatuses: (value?.lifecycleStatuses ?? []).filter(
			(item): item is string => typeof item === "string" && item.length > 0
		),
		stageNames: (value?.stageNames ?? []).filter(
			(item): item is string => typeof item === "string" && item.length > 0
		),
		targetDateOnOrAfter:
			typeof value?.targetDateOnOrAfter === "string" &&
			value.targetDateOnOrAfter.length > 0
				? value.targetDateOnOrAfter
				: null,
		targetDateOnOrBefore:
			typeof value?.targetDateOnOrBefore === "string" &&
			value.targetDateOnOrBefore.length > 0
				? value.targetDateOnOrBefore
				: null,
	};
}

function normalizeColumns(
	value: readonly string[] | undefined
): CrossProjectListColumn[] {
	const columns = (value ?? []).filter(isColumn);
	return columns.length > 0 ? columns : [...DEFAULT_COLUMNS];
}

function normalizeSort(
	value: CrossProjectListSort | undefined
): CrossProjectListSort {
	if (!(value && isColumn(value.column))) {
		return DEFAULT_SORT;
	}
	return {
		column: value.column,
		direction: value.direction === "desc" ? "desc" : "asc",
	};
}

function normalizeGrouping(
	value: CrossProjectListColumn | null | undefined
): CrossProjectListColumn | null {
	if (value === null || value === undefined) {
		return null;
	}
	return isColumn(value) ? value : null;
}

export function parseSavedCrossProjectLists(
	value: unknown
): SavedCrossProjectListDefinition[] {
	if (!Array.isArray(value)) {
		return [];
	}
	return value.flatMap((item) => {
		if (!item || typeof item !== "object") {
			return [];
		}
		const record = item as Record<string, unknown>;
		if (typeof record.id !== "string" || record.id.length === 0) {
			return [];
		}
		if (typeof record.name !== "string" || record.name.trim().length === 0) {
			return [];
		}
		const conditions = normalizeConditions(
			record.conditions && typeof record.conditions === "object"
				? (record.conditions as Partial<CrossProjectListConditions>)
				: undefined
		);
		const savedSort =
			record.sort && typeof record.sort === "object"
				? (record.sort as CrossProjectListSort)
				: undefined;
		return [
			{
				columns: normalizeColumns(
					Array.isArray(record.columns)
						? record.columns.filter(
								(column): column is string => typeof column === "string"
							)
						: undefined
				),
				conditions,
				grouping: normalizeGrouping(
					typeof record.grouping === "string" || record.grouping === null
						? (record.grouping as CrossProjectListColumn | null)
						: null
				),
				id: record.id,
				name: record.name.trim(),
				sort: normalizeSort(savedSort),
			},
		];
	});
}

export function saveCrossProjectList<
	TLayout extends { savedLists: readonly SavedCrossProjectListDefinition[] },
>(
	layout: TLayout,
	input: SaveCrossProjectListInput
):
	| {
			layout: TLayout & { savedLists: SavedCrossProjectListDefinition[] };
			status: "ok";
	  }
	| { reason: "unnamed"; status: "rejected" } {
	const name = input.name.trim();
	if (name.length === 0) {
		return { reason: "unnamed", status: "rejected" };
	}
	const existing = input.id
		? layout.savedLists.find((list) => list.id === input.id)
		: undefined;
	const definition: SavedCrossProjectListDefinition = {
		columns: input.columns
			? normalizeColumns(input.columns)
			: (existing?.columns ?? DEFAULT_COLUMNS),
		conditions:
			input.conditions === undefined
				? (existing?.conditions ?? EMPTY_CONDITIONS)
				: normalizeConditions(input.conditions),
		grouping:
			input.grouping === undefined
				? (existing?.grouping ?? null)
				: normalizeGrouping(input.grouping),
		id: existing?.id ?? input.id ?? crypto.randomUUID(),
		name,
		sort: input.sort
			? normalizeSort(input.sort)
			: (existing?.sort ?? DEFAULT_SORT),
	};
	const savedLists = existing
		? layout.savedLists.map((list) =>
				list.id === definition.id ? definition : list
			)
		: [...layout.savedLists, definition];
	return {
		layout: { ...layout, savedLists: [...savedLists] },
		status: "ok",
	};
}

function lastReportedHealth(
	update: ManualProjectUpdateMark | null
): LastReportedHealthView | null {
	if (!(update && update.date.length > 0 && update.mark.length > 0)) {
		return null;
	}
	return {
		date: update.date,
		label: WORKSPACE_OVERVIEW_COPY.lastReportedHealth,
		mark: update.mark,
	};
}

function asRow(project: CrossProjectListProject): CrossProjectListRow {
	return {
		areas: [...project.enabledAreas],
		id: project.id,
		lastReportedHealth: lastReportedHealth(project.lastManualProjectUpdate),
		lifecycle: project.lifecycleStatus,
		name: project.name,
		stage: project.stageNames.length > 0 ? project.stageNames.join(", ") : null,
		targetDate: project.targetDate,
	};
}

function matches(
	project: CrossProjectListProject,
	conditions: CrossProjectListConditions
): boolean {
	if (
		conditions.lifecycleStatuses.length > 0 &&
		!conditions.lifecycleStatuses.includes(project.lifecycleStatus)
	) {
		return false;
	}
	if (
		conditions.stageNames.length > 0 &&
		!conditions.stageNames.some((stage) => project.stageNames.includes(stage))
	) {
		return false;
	}
	if (
		conditions.archived !== null &&
		project.archived !== conditions.archived
	) {
		return false;
	}
	if (
		conditions.enabledAreas.length > 0 &&
		!conditions.enabledAreas.every((area) =>
			project.enabledAreas.includes(area)
		)
	) {
		return false;
	}
	if (
		conditions.targetDateOnOrAfter &&
		(!project.targetDate || project.targetDate < conditions.targetDateOnOrAfter)
	) {
		return false;
	}
	if (
		conditions.targetDateOnOrBefore &&
		(!project.targetDate ||
			project.targetDate > conditions.targetDateOnOrBefore)
	) {
		return false;
	}
	return true;
}

function sortValue(
	row: CrossProjectListRow,
	column: CrossProjectListColumn
): string {
	switch (column) {
		case "areas":
			return row.areas.join(", ");
		case "lastReportedHealth":
			return row.lastReportedHealth
				? `${row.lastReportedHealth.date} ${row.lastReportedHealth.mark}`
				: "";
		case "lifecycle":
			return row.lifecycle;
		case "name":
			return row.name;
		case "stage":
			return row.stage ?? "";
		case "targetDate":
			return row.targetDate ?? "";
		default:
			return "";
	}
}

function sortRows(
	rows: CrossProjectListRow[],
	sort: CrossProjectListSort
): CrossProjectListRow[] {
	const direction = sort.direction === "desc" ? -1 : 1;
	return [...rows].sort((left, right) => {
		const compared = sortValue(left, sort.column).localeCompare(
			sortValue(right, sort.column)
		);
		return compared * direction;
	});
}

function groupRows(
	rows: CrossProjectListRow[],
	grouping: CrossProjectListColumn | null
): CrossProjectListGroup[] | null {
	if (!grouping) {
		return null;
	}
	const groups: CrossProjectListGroup[] = [];
	const indexByHeading = new Map<string, number>();
	for (const row of rows) {
		const heading = sortValue(row, grouping) || "—";
		const existing = indexByHeading.get(heading);
		if (existing === undefined) {
			indexByHeading.set(heading, groups.length);
			groups.push({ heading, rows: [row] });
		} else {
			groups[existing]?.rows.push(row);
		}
	}
	return groups;
}

export function evaluateCrossProjectLists(
	projects: readonly CrossProjectListProject[],
	definitions: readonly SavedCrossProjectListDefinition[]
): EvaluatedCrossProjectList[] {
	return definitions.map((definition) => {
		const rows = sortRows(
			projects
				.filter((project) => matches(project, definition.conditions))
				.map(asRow),
			definition.sort
		);
		return {
			columns: definition.columns,
			conditions: definition.conditions,
			grouping: definition.grouping,
			groups: groupRows(rows, definition.grouping),
			id: definition.id,
			kind: CROSS_PROJECT_LIST_KIND,
			name: definition.name,
			rows,
			sort: definition.sort,
		};
	});
}

export function addCrossProjectListMemberByDrag(
	_overview: unknown,
	_listId: string,
	_projectId: string
): {
	copy: typeof WORKSPACE_OVERVIEW_COPY.membershipFromConditions;
	reason: "membership-from-conditions";
	status: "rejected";
} {
	return {
		copy: WORKSPACE_OVERVIEW_COPY.membershipFromConditions,
		reason: "membership-from-conditions",
		status: "rejected",
	};
}
