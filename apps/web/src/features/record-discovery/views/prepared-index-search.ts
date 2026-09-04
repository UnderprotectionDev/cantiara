import { RECORD_DISCOVERY_COPY } from "./record-discovery-copy";

export const PREPARED_INDEX_LABELS = [
	RECORD_DISCOVERY_COPY.allWork,
	RECORD_DISCOVERY_COPY.allDocuments,
	RECORD_DISCOVERY_COPY.allDecisions,
	RECORD_DISCOVERY_COPY.allRisks,
	RECORD_DISCOVERY_COPY.allResearchSessions,
	RECORD_DISCOVERY_COPY.allTests,
	RECORD_DISCOVERY_COPY.allDesigns,
	RECORD_DISCOVERY_COPY.allTechnicalDiagrams,
	RECORD_DISCOVERY_COPY.allProjectReleases,
	RECORD_DISCOVERY_COPY.allSources,
	RECORD_DISCOVERY_COPY.allFiles,
] as const;

export type PreparedIndexLabel = (typeof PREPARED_INDEX_LABELS)[number];

export interface PreparedIndexSearch {
	folder?: string;
	includeArchived?: true;
	index: PreparedIndexLabel;
	metadata?: string;
	recordType?: string;
	scope?: "Project" | "Personal Wiki";
	status?: string;
}

export function isPreparedIndexLabel(
	value: unknown
): value is PreparedIndexLabel {
	return PREPARED_INDEX_LABELS.some((label) => label === value);
}

export function preparedIndexHref(
	index: string,
	filters: Omit<PreparedIndexSearch, "index"> = {}
): string {
	const params = new URLSearchParams();
	params.set("index", index);
	if (filters.includeArchived) {
		params.set("includeArchived", "true");
	}
	if (filters.scope) {
		params.set("scope", filters.scope);
	}
	if (filters.folder) {
		params.set("folder", filters.folder);
	}
	if (filters.recordType) {
		params.set("recordType", filters.recordType);
	}
	if (filters.status) {
		params.set("status", filters.status);
	}
	if (filters.metadata) {
		params.set("metadata", filters.metadata);
	}
	return `/indexes?${params.toString()}`;
}

export function preparedIndexSearch(
	search: Record<string, unknown>
): PreparedIndexSearch {
	const index = isPreparedIndexLabel(search.index)
		? search.index
		: RECORD_DISCOVERY_COPY.allWork;
	const includeArchived =
		search.includeArchived === true ||
		search.includeArchived === "true" ||
		search.includeArchived === 1 ||
		search.includeArchived === "1"
			? true
			: undefined;
	const scope =
		search.scope === RECORD_DISCOVERY_COPY.project ||
		search.scope === RECORD_DISCOVERY_COPY.personalWiki
			? search.scope
			: undefined;
	const folder =
		typeof search.folder === "string" && search.folder.length > 0
			? search.folder
			: undefined;
	const recordType =
		typeof search.recordType === "string" && search.recordType.length > 0
			? search.recordType
			: undefined;
	const status =
		typeof search.status === "string" && search.status.length > 0
			? search.status
			: undefined;
	const metadata =
		typeof search.metadata === "string" && search.metadata.length > 0
			? search.metadata
			: undefined;
	return {
		index,
		...(includeArchived ? { includeArchived: true as const } : {}),
		...(scope ? { scope } : {}),
		...(folder ? { folder } : {}),
		...(recordType ? { recordType } : {}),
		...(status ? { status } : {}),
		...(metadata ? { metadata } : {}),
	};
}

export function preparedIndexTypeFilters(index: string): readonly string[] {
	if (index === RECORD_DISCOVERY_COPY.allDocuments) {
		return [RECORD_DISCOVERY_COPY.document, RECORD_DISCOVERY_COPY.persona];
	}
	if (index === RECORD_DISCOVERY_COPY.allTests) {
		return [
			RECORD_DISCOVERY_COPY.plannedTestCase,
			RECORD_DISCOVERY_COPY.testHandoff,
			RECORD_DISCOVERY_COPY.testSession,
			RECORD_DISCOVERY_COPY.sessionTest,
			RECORD_DISCOVERY_COPY.testGap,
			RECORD_DISCOVERY_COPY.testAssessment,
		];
	}
	if (index === RECORD_DISCOVERY_COPY.allDesigns) {
		return [
			RECORD_DISCOVERY_COPY.screen,
			RECORD_DISCOVERY_COPY.userFlow,
			RECORD_DISCOVERY_COPY.moodboard,
			RECORD_DISCOVERY_COPY.projectWall,
		];
	}
	if (index === RECORD_DISCOVERY_COPY.allTechnicalDiagrams) {
		return [
			RECORD_DISCOVERY_COPY.technicalArchitecture,
			RECORD_DISCOVERY_COPY.dataModel,
			RECORD_DISCOVERY_COPY.technicalSequence,
		];
	}
	return [];
}

export function preparedIndexUsesStatusFilters(index: string): boolean {
	return index === RECORD_DISCOVERY_COPY.allDecisions;
}

export function preparedIndexUsesFolderFilters(index: string): boolean {
	return (
		index === RECORD_DISCOVERY_COPY.allDocuments ||
		index === RECORD_DISCOVERY_COPY.allFiles
	);
}
