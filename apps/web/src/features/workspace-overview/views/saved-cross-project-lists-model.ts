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

export const LIFECYCLE_FILTERS = [
	"Active",
	"Pending",
	"Completed",
	"Abandoned",
] as const;

export const AREA_FILTERS = [
	"Work",
	"Documents",
	"Discovery",
	"Decisions",
	"Design",
	"Technical Diagrams",
	"Tests",
	"Releases",
	"Production",
	"GitHub",
] as const;

export interface LastReportedHealthView {
	date: string;
	label: string;
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

export interface SavedCrossProjectListView {
	columns: readonly CrossProjectListColumn[];
	conditions: {
		archived: boolean | null;
		enabledAreas: readonly string[];
		lifecycleStatuses: readonly string[];
		stageNames: readonly string[];
		targetDateOnOrAfter: string | null;
		targetDateOnOrBefore: string | null;
	};
	grouping: CrossProjectListColumn | null;
	groups: Array<{ heading: string; rows: CrossProjectListRow[] }> | null;
	id: string;
	kind: string;
	name: string;
	rows: CrossProjectListRow[];
	sort: { column: CrossProjectListColumn; direction: "asc" | "desc" };
}

export interface SavedListLayoutItem {
	columns: readonly CrossProjectListColumn[];
	conditions: SavedCrossProjectListView["conditions"];
	grouping: CrossProjectListColumn | null;
	id: string;
	name: string;
	sort: { column: CrossProjectListColumn; direction: "asc" | "desc" };
}

export function cellForColumn(
	row: CrossProjectListRow,
	column: CrossProjectListColumn
): string {
	switch (column) {
		case "areas":
			return row.areas.join(", ");
		case "lastReportedHealth":
			return row.lastReportedHealth
				? `${row.lastReportedHealth.label} · ${row.lastReportedHealth.mark} · ${row.lastReportedHealth.date}`
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

export function emptyListDraft(): Omit<SavedListLayoutItem, "id"> {
	return {
		columns: ["name", "lifecycle", "lastReportedHealth"],
		conditions: {
			archived: null,
			enabledAreas: [],
			lifecycleStatuses: [],
			stageNames: [],
			targetDateOnOrAfter: null,
			targetDateOnOrBefore: null,
		},
		grouping: null,
		name: "",
		sort: { column: "name", direction: "asc" },
	};
}
