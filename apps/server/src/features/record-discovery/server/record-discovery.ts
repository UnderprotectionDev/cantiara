import {
	FILE_LIFECYCLE,
	FILE_SCOPE_KIND,
} from "../../file-attachments/server/file-attachments-model";
import {
	CLOSURE_RESULT,
	WORK_STATUS,
} from "../../work-lifecycle/server/work-lifecycle-model";

import { RECORD_DISCOVERY_COPY } from "./record-discovery-copy";

export const SEARCH_RECORD_KINDS = [
	RECORD_DISCOVERY_COPY.work,
	RECORD_DISCOVERY_COPY.document,
	RECORD_DISCOVERY_COPY.fileAttachment,
] as const;

export type SearchRecordKind = (typeof SEARCH_RECORD_KINDS)[number];

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
	id: string;
	key: string | null;
	kind: SearchRecordKind;
	lifecycle: SearchLifecycle;
	metadata: string;
	projectId: string | null;
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
		hits: ranked.map(({ matchPlace, record }) =>
			toHit(record, text, matchPlace)
		),
		includeArchived: query.includeArchived,
		query: text,
		surface: RECORD_DISCOVERY_COPY.search,
		total: ranked.length,
	};
}

export function loadSearchIndexFromRows(input: {
	fileAttachments: readonly {
		id: string;
		lifecycle: string;
		projectId: string | null;
		scopeKind: string;
		title: string;
		updatedAt: Date;
		versions: readonly { filename: string }[];
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
			id: work.id,
			key: work.key,
			kind: RECORD_DISCOVERY_COPY.work,
			lifecycle: workLifecycle(archived, closed),
			metadata: "",
			projectId: work.projectId,
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
			id: file.id,
			key: null,
			kind: RECORD_DISCOVERY_COPY.fileAttachment,
			lifecycle: archived ? "archived" : "active",
			metadata: current?.filename ?? "",
			projectId: wiki ? null : file.projectId,
			scope: wiki
				? RECORD_DISCOVERY_COPY.personalWiki
				: RECORD_DISCOVERY_COPY.project,
			status: archived ? RECORD_DISCOVERY_COPY.archived : "Active",
			title: file.title,
			trashed: file.lifecycle === FILE_LIFECYCLE.trash,
			updatedAt: file.updatedAt.getTime(),
		} satisfies SearchIndexRecord;
	});
	return [...works, ...files];
}

function isVisibleHit(
	record: SearchIndexRecord,
	includeArchived: boolean,
	text: string
): boolean {
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
	record: SearchIndexRecord,
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
