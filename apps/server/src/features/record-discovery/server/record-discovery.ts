import {
	FILE_LIFECYCLE,
	FILE_SCOPE_KIND,
} from "../../file-attachments/server/file-attachments-model";
import {
	type DocumentDiscoveryNest,
	documentHitFromDiscoveryRecord,
	filterDocumentNest,
	presentMixedDocumentHits,
} from "../../personal-wiki/server/personal-wiki";
import { PERSONAL_WIKI_COPY } from "../../personal-wiki/server/personal-wiki-copy";
import {
	CLOSURE_RESULT,
	WORK_STATUS,
} from "../../work-lifecycle/server/work-lifecycle-model";

import { RECORD_DISCOVERY_COPY } from "./record-discovery-copy";

export const SEARCH_RECORD_KINDS = [
	RECORD_DISCOVERY_COPY.work,
	RECORD_DISCOVERY_COPY.document,
	RECORD_DISCOVERY_COPY.fileAttachment,
	RECORD_DISCOVERY_COPY.technicalDiagram,
] as const;

export type SearchRecordKind = string;

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

const INDEX_MEMBER_TYPES: Record<PreparedIndexLabel, readonly string[]> = {
	[RECORD_DISCOVERY_COPY.allWork]: [RECORD_DISCOVERY_COPY.work],
	[RECORD_DISCOVERY_COPY.allDocuments]: [RECORD_DISCOVERY_COPY.document],
	[RECORD_DISCOVERY_COPY.allDecisions]: [RECORD_DISCOVERY_COPY.decision],
	[RECORD_DISCOVERY_COPY.allRisks]: [RECORD_DISCOVERY_COPY.risk],
	[RECORD_DISCOVERY_COPY.allResearchSessions]: [
		RECORD_DISCOVERY_COPY.researchSession,
	],
	[RECORD_DISCOVERY_COPY.allTests]: [
		RECORD_DISCOVERY_COPY.plannedTestCase,
		RECORD_DISCOVERY_COPY.testHandoff,
		RECORD_DISCOVERY_COPY.testSession,
		RECORD_DISCOVERY_COPY.sessionTest,
		RECORD_DISCOVERY_COPY.testGap,
		RECORD_DISCOVERY_COPY.testAssessment,
	],
	[RECORD_DISCOVERY_COPY.allDesigns]: [
		RECORD_DISCOVERY_COPY.screen,
		RECORD_DISCOVERY_COPY.userFlow,
		RECORD_DISCOVERY_COPY.moodboard,
		RECORD_DISCOVERY_COPY.projectWall,
	],
	[RECORD_DISCOVERY_COPY.allTechnicalDiagrams]: [
		RECORD_DISCOVERY_COPY.technicalDiagram,
		RECORD_DISCOVERY_COPY.technicalArchitecture,
		RECORD_DISCOVERY_COPY.dataModel,
		RECORD_DISCOVERY_COPY.technicalSequence,
	],
	[RECORD_DISCOVERY_COPY.allProjectReleases]: [
		RECORD_DISCOVERY_COPY.projectRelease,
	],
	[RECORD_DISCOVERY_COPY.allSources]: [RECORD_DISCOVERY_COPY.source],
	[RECORD_DISCOVERY_COPY.allFiles]: [RECORD_DISCOVERY_COPY.fileAttachment],
};

export const SEARCH_EXCLUDED_KINDS = [
	RECORD_DISCOVERY_COPY.captureInboxItem,
	RECORD_DISCOVERY_COPY.draft,
	RECORD_DISCOVERY_COPY.externalSurface,
	RECORD_DISCOVERY_COPY.githubExternalRecord,
] as const;

export type SearchExcludedKind = (typeof SEARCH_EXCLUDED_KINDS)[number];

export const SEARCH_SECRET_FIELDS = [
	RECORD_DISCOVERY_COPY.secret,
	RECORD_DISCOVERY_COPY.shareToken,
	RECORD_DISCOVERY_COPY.linkPassword,
] as const;

export type SearchSecretField = (typeof SEARCH_SECRET_FIELDS)[number];

export const SEARCH_SCOPES = [
	RECORD_DISCOVERY_COPY.project,
	RECORD_DISCOVERY_COPY.personalWiki,
] as const;

export type SearchScope = (typeof SEARCH_SCOPES)[number];

export const SEARCH_LIFECYCLES = ["active", "closed", "archived"] as const;

export type SearchLifecycle = (typeof SEARCH_LIFECYCLES)[number];

export type SearchMatchPlace = "title" | "key" | "body" | "metadata";

export interface SearchIndexRecord {
	archived: boolean;
	authorized: boolean;
	body: string;
	closureResult: string | null;
	diagramAuthorityMode: string | null;
	folder: string | null;
	id: string;
	key: string | null;
	kind: SearchRecordKind | SearchExcludedKind;
	lifecycle: SearchLifecycle;
	metadata: string;
	projectId: string | null;
	recordType: string;
	scope: SearchScope;
	status: string;
	title: string;
	trashed: boolean;
	updatedAt: number;
}

export interface SearchQuery {
	includeArchived: boolean;
	openProjectId: string | null;
	text: string;
}

export interface SearchSnippetPart {
	highlight: boolean;
	start: number;
	text: string;
}

export interface SearchHit {
	closureResult: string | null;
	id: string;
	kind: SearchRecordKind;
	matchCount: number;
	matchPlace: SearchMatchPlace;
	recordKey: string | null;
	scope: SearchScope;
	snippetParts: readonly SearchSnippetPart[];
	sourceHref: string;
	status: string;
	title: string;
}

export interface SearchResult {
	hits: readonly SearchHit[];
	includeArchived: boolean;
	query: string;
	surface: typeof RECORD_DISCOVERY_COPY.search;
	total: number;
}

export interface PreparedIndexQuery {
	folder?: string | null;
	includeArchived?: boolean;
	index: PreparedIndexLabel;
	metadata?: string | null;
	recordType?: string | null;
	scope?: SearchScope | null;
}

export interface PreparedIndexRow {
	closureResult: string | null;
	diagramAuthorityMode: string | null;
	folder: string | null;
	id: string;
	metadata: string;
	openSourceRecord: typeof RECORD_DISCOVERY_COPY.openSourceRecord;
	projectId: string | null;
	recordType: string;
	scope: SearchScope;
	sourceHref: string;
	status: string;
	title: string;
}

export interface PreparedIndexResult {
	folders: readonly string[];
	index: PreparedIndexLabel;
	openSourceRecord: typeof RECORD_DISCOVERY_COPY.openSourceRecord;
	rows: readonly PreparedIndexRow[];
	setupRequired: false;
	storedQuery: false;
	surface: PreparedIndexLabel;
	total: number;
}

const SNIPPET_RADIUS = 48;

export function searchRecords(
	index: readonly SearchIndexRecord[],
	query: SearchQuery
): SearchResult {
	const text = query.text.trim();
	if (text.length === 0) {
		return {
			hits: [],
			includeArchived: query.includeArchived,
			query: text,
			surface: RECORD_DISCOVERY_COPY.search,
			total: 0,
		};
	}
	const ranked = index
		.filter((record) => isVisibleHit(record, query.includeArchived, text))
		.map((record) => {
			const matchPlace = matchPlaceOf(record, text);
			if (!matchPlace) {
				throw new Error("visible hit must match");
			}
			return { matchPlace, record };
		})
		.sort((left, right) => compareHits(left, right, query.openProjectId));
	return {
		hits: ranked.flatMap(({ matchPlace, record }) => {
			if (!isSearchIndexedKind(record.kind)) {
				throw new Error("visible hit must be an indexed kind");
			}
			return presentSearchHit(
				toHit({ ...record, kind: record.kind }, text, matchPlace),
				record
			);
		}),
		includeArchived: query.includeArchived,
		query: text,
		surface: RECORD_DISCOVERY_COPY.search,
		total: ranked.length,
	};
}

export function browsePreparedIndex(
	index: readonly SearchIndexRecord[],
	query: PreparedIndexQuery
): PreparedIndexResult {
	const includeArchived = query.includeArchived ?? false;
	const members = index.filter((record) =>
		isIndexMember(record, query.index, includeArchived)
	);
	const folders = [
		...new Set(
			members
				.map((record) => record.folder)
				.filter((folder): folder is string => Boolean(folder))
		),
	].sort((left, right) => left.localeCompare(right));
	const filtered = members.filter((record) => {
		if (
			query.scope &&
			query.index !== RECORD_DISCOVERY_COPY.allDocuments &&
			record.scope !== query.scope
		) {
			return false;
		}
		if (query.folder && record.folder !== query.folder) {
			return false;
		}
		if (query.recordType && record.recordType !== query.recordType) {
			return false;
		}
		if (query.metadata && !containsQuery(record.metadata, query.metadata)) {
			return false;
		}
		return true;
	});
	const unique =
		query.index === RECORD_DISCOVERY_COPY.allFiles
			? uniqueById(filtered)
			: filtered;
	const rows =
		query.index === RECORD_DISCOVERY_COPY.allDocuments
			? presentDocumentIndexRows(unique, query.scope)
			: [...unique].sort(compareIndexRows).map((record) => toIndexRow(record));
	return {
		folders,
		index: query.index,
		openSourceRecord: RECORD_DISCOVERY_COPY.openSourceRecord,
		rows,
		setupRequired: false,
		storedQuery: false,
		surface: query.index,
		total: rows.length,
	};
}

export function isSearchIndexedKind(
	kind: SearchRecordKind | SearchExcludedKind
): kind is SearchRecordKind {
	return (SEARCH_RECORD_KINDS as readonly string[]).includes(kind);
}

export function loadSearchIndexFromRows(input: {
	fileAttachments: readonly {
		folder?: string | null;
		id: string;
		lifecycle: string;
		projectId: string | null;
		scopeKind: string;
		title: string;
		updatedAt: Date;
		versions: readonly { filename: string }[];
	}[];
	technicalDiagrams?: readonly {
		archived: boolean;
		authorized?: boolean;
		generatedSql: string;
		id: string;
		projectId: string;
		title: string;
		trashedAt: Date | null;
		updatedAt: Date;
		userFacingNames: readonly string[];
	}[];
	works: readonly {
		archived: boolean;
		closureResult: string | null;
		description: string | null;
		id: string;
		key: string;
		projectId: string;
		status: string;
		title: string;
		trashedAt: Date | null;
		updatedAt: Date;
	}[];
}): SearchIndexRecord[] {
	const works = input.works.map((work) => {
		const { archived } = work;
		const closed = work.status === WORK_STATUS.closed;
		return {
			archived,
			authorized: true,
			body: work.description ?? "",
			closureResult: closed ? work.closureResult : null,
			diagramAuthorityMode: null,
			folder: null,
			id: work.id,
			key: work.key,
			kind: RECORD_DISCOVERY_COPY.work,
			lifecycle: workLifecycle(archived, closed),
			metadata: "",
			projectId: work.projectId,
			recordType: RECORD_DISCOVERY_COPY.work,
			scope: RECORD_DISCOVERY_COPY.project,
			status: archived ? RECORD_DISCOVERY_COPY.archived : work.status,
			title: work.title,
			trashed: work.trashedAt !== null,
			updatedAt: work.updatedAt.getTime(),
		} satisfies SearchIndexRecord;
	});
	const files = input.fileAttachments.map((file) => {
		const archived = file.lifecycle === FILE_LIFECYCLE.archived;
		const wiki = file.scopeKind === FILE_SCOPE_KIND.personalWiki;
		const current = file.versions.at(-1);
		return {
			archived,
			authorized: true,
			body: "",
			closureResult: null,
			diagramAuthorityMode: null,
			folder: file.folder ?? null,
			id: file.id,
			key: null,
			kind: RECORD_DISCOVERY_COPY.fileAttachment,
			lifecycle: archived ? "archived" : "active",
			metadata: current?.filename ?? "",
			projectId: wiki ? null : file.projectId,
			recordType: RECORD_DISCOVERY_COPY.fileAttachment,
			scope: wiki
				? RECORD_DISCOVERY_COPY.personalWiki
				: RECORD_DISCOVERY_COPY.project,
			status: archived ? RECORD_DISCOVERY_COPY.archived : "Active",
			title: file.title,
			trashed: file.lifecycle === FILE_LIFECYCLE.trash,
			updatedAt: file.updatedAt.getTime(),
		} satisfies SearchIndexRecord;
	});
	const diagrams = (input.technicalDiagrams ?? []).map((diagram) => {
		const { archived } = diagram;
		return {
			archived,
			authorized: diagram.authorized ?? true,
			body: "",
			closureResult: null,
			diagramAuthorityMode: null,
			folder: null,
			id: diagram.id,
			key: null,
			kind: RECORD_DISCOVERY_COPY.technicalDiagram,
			lifecycle: archived ? ("archived" as const) : ("active" as const),
			metadata: diagram.userFacingNames.join("\n"),
			projectId: diagram.projectId,
			recordType: RECORD_DISCOVERY_COPY.technicalDiagram,
			scope: RECORD_DISCOVERY_COPY.project,
			status: archived ? RECORD_DISCOVERY_COPY.archived : "Active",
			title: diagram.title,
			trashed: diagram.trashedAt !== null,
			updatedAt: diagram.updatedAt.getTime(),
		} satisfies SearchIndexRecord;
	});
	return [...works, ...files, ...diagrams].filter((record) =>
		isSearchIndexedKind(record.kind)
	);
}

function isIndexMember(
	record: SearchIndexRecord,
	index: PreparedIndexLabel,
	includeArchived: boolean
): boolean {
	if (!record.authorized || record.trashed) {
		return false;
	}
	if (record.lifecycle === "archived" && !includeArchived) {
		return false;
	}
	const types = INDEX_MEMBER_TYPES[index];
	return types.includes(record.kind) || types.includes(record.recordType);
}

function uniqueById(
	records: readonly SearchIndexRecord[]
): SearchIndexRecord[] {
	const seen = new Set<string>();
	const unique: SearchIndexRecord[] = [];
	for (const record of records) {
		if (seen.has(record.id)) {
			continue;
		}
		seen.add(record.id);
		unique.push(record);
	}
	return unique;
}

function compareIndexRows(
	left: SearchIndexRecord,
	right: SearchIndexRecord
): number {
	const title = left.title.localeCompare(right.title);
	if (title !== 0) {
		return title;
	}
	if (left.id < right.id) {
		return -1;
	}
	if (left.id > right.id) {
		return 1;
	}
	return 0;
}

function nestFromSearchScope(
	scope: SearchScope | null | undefined
): DocumentDiscoveryNest | null {
	if (scope === RECORD_DISCOVERY_COPY.personalWiki) {
		return "personal-wiki";
	}
	if (scope === RECORD_DISCOVERY_COPY.project) {
		return "project";
	}
	return null;
}

function presentDocumentIndexRows(
	records: readonly SearchIndexRecord[],
	scope: SearchScope | null | undefined
): PreparedIndexRow[] {
	const sorted = [...records].sort(compareIndexRows);
	const presented = presentMixedDocumentHits(
		sorted.map((record) =>
			documentHitFromDiscoveryRecord({
				id: record.id,
				projectId: record.projectId,
				scope: record.scope,
				surface: PERSONAL_WIKI_COPY.allDocuments,
				title: record.title,
			})
		)
	);
	if (presented.status !== "presented") {
		return [];
	}
	const nest = nestFromSearchScope(scope);
	const rows = nest ? filterDocumentNest(presented.rows, nest) : presented.rows;
	const byId = new Map(sorted.map((record) => [record.id, record]));
	return rows.flatMap((row) => {
		const record = byId.get(row.id);
		if (!record) {
			return [];
		}
		return [{ ...toIndexRow(record), scope: row.scopeBadge }];
	});
}

function presentSearchHit(
	hit: SearchHit,
	record: SearchIndexRecord
): SearchHit[] {
	if (hit.kind !== RECORD_DISCOVERY_COPY.document) {
		return [hit];
	}
	const presented = presentMixedDocumentHits([
		documentHitFromDiscoveryRecord({
			id: record.id,
			projectId: record.projectId,
			scope: record.scope,
			surface: PERSONAL_WIKI_COPY.search,
			title: record.title,
		}),
	]);
	if (presented.status !== "presented") {
		return [];
	}
	const [row] = presented.rows;
	if (!row) {
		return [];
	}
	return [{ ...hit, scope: row.scopeBadge }];
}

function toIndexRow(record: SearchIndexRecord): PreparedIndexRow {
	return {
		closureResult: record.closureResult,
		diagramAuthorityMode: record.diagramAuthorityMode,
		folder: record.folder,
		id: record.id,
		metadata: record.metadata,
		openSourceRecord: RECORD_DISCOVERY_COPY.openSourceRecord,
		projectId: record.projectId,
		recordType: record.recordType,
		scope: record.scope,
		sourceHref: sourceHref(record),
		status: record.status,
		title: record.title,
	};
}

function isVisibleHit(
	record: SearchIndexRecord,
	includeArchived: boolean,
	text: string
): boolean {
	if (!isSearchIndexedKind(record.kind)) {
		return false;
	}
	if (!record.authorized || record.trashed) {
		return false;
	}
	if (record.lifecycle === "archived" && !includeArchived) {
		return false;
	}
	return matchPlaceOf(record, text) !== null;
}

function matchPlaceOf(
	record: SearchIndexRecord,
	text: string
): SearchMatchPlace | null {
	if (containsQuery(record.title, text)) {
		return "title";
	}
	if (record.key && containsQuery(record.key, text)) {
		return "key";
	}
	if (containsQuery(record.body, text)) {
		return "body";
	}
	if (containsQuery(record.metadata, text)) {
		return "metadata";
	}
	return null;
}

function compareHits(
	left: { matchPlace: SearchMatchPlace; record: SearchIndexRecord },
	right: { matchPlace: SearchMatchPlace; record: SearchIndexRecord },
	openProjectId: string | null
): number {
	const place = matchRank(left.matchPlace) - matchRank(right.matchPlace);
	if (place !== 0) {
		return place;
	}
	const project =
		projectRank(left.record, openProjectId) -
		projectRank(right.record, openProjectId);
	if (project !== 0) {
		return project;
	}
	const life =
		lifecycleRank(left.record.lifecycle) -
		lifecycleRank(right.record.lifecycle);
	if (life !== 0) {
		return life;
	}
	const closure =
		closureRank(left.record.closureResult) -
		closureRank(right.record.closureResult);
	if (closure !== 0) {
		return closure;
	}
	if (right.record.updatedAt !== left.record.updatedAt) {
		return right.record.updatedAt - left.record.updatedAt;
	}
	if (left.record.id < right.record.id) {
		return -1;
	}
	if (left.record.id > right.record.id) {
		return 1;
	}
	return 0;
}

function matchRank(place: SearchMatchPlace): number {
	if (place === "title" || place === "key") {
		return 0;
	}
	return 1;
}

function projectRank(
	record: SearchIndexRecord,
	openProjectId: string | null
): number {
	if (openProjectId && record.projectId === openProjectId) {
		return 0;
	}
	return 1;
}

function lifecycleRank(lifecycle: SearchLifecycle): number {
	if (lifecycle === "active") {
		return 0;
	}
	if (lifecycle === "closed") {
		return 1;
	}
	return 2;
}

function closureRank(result: string | null): number {
	if (result === CLOSURE_RESULT.completed) {
		return 0;
	}
	if (result === CLOSURE_RESULT.abandoned) {
		return 2;
	}
	return 1;
}

function workLifecycle(archived: boolean, closed: boolean): SearchLifecycle {
	if (archived) {
		return "archived";
	}
	if (closed) {
		return "closed";
	}
	return "active";
}

function sourceFieldFor(
	record: SearchIndexRecord,
	matchPlace: SearchMatchPlace
): string {
	if (matchPlace === "title") {
		return record.title;
	}
	if (matchPlace === "key") {
		return record.key ?? "";
	}
	if (matchPlace === "body") {
		return record.body;
	}
	return record.metadata;
}

function toHit(
	record: SearchIndexRecord & { kind: SearchRecordKind },
	text: string,
	matchPlace: SearchMatchPlace
): SearchHit {
	const sourceField = sourceFieldFor(record, matchPlace);
	return {
		closureResult: record.closureResult,
		id: record.id,
		kind: record.kind,
		matchCount:
			countMatches(record.title, text) +
			countMatches(record.key ?? "", text) +
			countMatches(record.body, text) +
			countMatches(record.metadata, text),
		matchPlace,
		recordKey: record.key,
		scope: record.scope,
		snippetParts: snippetParts(sourceField, text),
		sourceHref: sourceHref(record),
		status: record.status,
		title: record.title,
	};
}

function sourceHref(record: SearchIndexRecord): string {
	if (record.kind === RECORD_DISCOVERY_COPY.work && record.projectId) {
		return `/projects/${record.projectId}?work=${encodeURIComponent(record.id)}#work`;
	}
	if (record.scope === RECORD_DISCOVERY_COPY.personalWiki) {
		return "/wiki";
	}
	if (record.projectId) {
		return `/projects/${record.projectId}`;
	}
	return "/wiki";
}

function containsQuery(haystack: string, query: string): boolean {
	return haystack.toLowerCase().includes(query.toLowerCase());
}

function countMatches(haystack: string, query: string): number {
	if (query.length === 0 || haystack.length === 0) {
		return 0;
	}
	const lower = haystack.toLowerCase();
	const needle = query.toLowerCase();
	let count = 0;
	let from = 0;
	while (from <= lower.length - needle.length) {
		const at = lower.indexOf(needle, from);
		if (at === -1) {
			break;
		}
		count += 1;
		from = at + needle.length;
	}
	return count;
}

function snippetParts(source: string, query: string): SearchSnippetPart[] {
	const lower = source.toLowerCase();
	const needle = query.toLowerCase();
	const at = lower.indexOf(needle);
	if (at === -1) {
		return [
			{
				highlight: false,
				start: 0,
				text: source.slice(0, SNIPPET_RADIUS * 2),
			},
		];
	}
	const start = Math.max(0, at - SNIPPET_RADIUS);
	const end = Math.min(source.length, at + needle.length + SNIPPET_RADIUS);
	const parts: SearchSnippetPart[] = [];
	if (start > 0) {
		parts.push({ highlight: false, start: -1, text: "…" });
	}
	if (start < at) {
		parts.push({
			highlight: false,
			start,
			text: source.slice(start, at),
		});
	}
	parts.push({
		highlight: true,
		start: at,
		text: source.slice(at, at + query.length),
	});
	if (at + query.length < end) {
		parts.push({
			highlight: false,
			start: at + query.length,
			text: source.slice(at + query.length, end),
		});
	}
	if (end < source.length) {
		parts.push({ highlight: false, start: source.length, text: "…" });
	}
	return parts;
}
