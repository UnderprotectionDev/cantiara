import { RECORD_DISCOVERY_COPY } from "./record-discovery-copy";

export const IN_CONTEXT_PREVIEW_SURFACES = [
	"Kanban",
	"Calendar",
	"Roadmap",
	"Scope Tree",
	"Smart Collection",
	"Notification Center",
] as const;

export type InContextPreviewSurface =
	(typeof IN_CONTEXT_PREVIEW_SURFACES)[number];

export interface PreviewListPlace {
	focusedId: string;
}

export interface PreviewSession {
	innerRecordIds: readonly string[];
	listPlace: PreviewListPlace;
	recordId: string;
	sourceHref: string;
	surface: InContextPreviewSurface;
}

export interface PreviewMutation {
	createdRecord: false;
	listPlace: PreviewListPlace;
	persistedForRecentContext: false;
	savedCollection: false;
	session: PreviewSession | null;
}

export function sourceRecordFullPageHref(
	projectId: string,
	recordId: string
): string {
	return `/projects/${projectId}?work=${encodeURIComponent(recordId)}#work`;
}

export function previewActionCopy(surface: InContextPreviewSurface) {
	return {
		openFullPage: RECORD_DISCOVERY_COPY.openFullPage,
		openSourceRecord: RECORD_DISCOVERY_COPY.openSourceRecord,
		surface,
	};
}

export function sidePanelIsMandatory(_surface: InContextPreviewSurface): false {
	return false;
}

export function openSourceRecordPreview(
	current: PreviewSession | null,
	input: {
		listPlace: PreviewListPlace;
		recordId: string;
		sourceHref: string;
		surface: InContextPreviewSurface;
	}
): PreviewMutation & { session: PreviewSession } {
	const listPlace = current ? current.listPlace : input.listPlace;
	const innerRecordIds = current
		? [...current.innerRecordIds, current.recordId]
		: [];
	return {
		createdRecord: false,
		listPlace,
		persistedForRecentContext: false,
		savedCollection: false,
		session: {
			innerRecordIds,
			listPlace,
			recordId: input.recordId,
			sourceHref: input.sourceHref,
			surface: input.surface,
		},
	};
}

export function closeSourceRecordPreview(
	current: PreviewSession | null
): PreviewMutation & { session: null } {
	return {
		createdRecord: false,
		listPlace: current ? current.listPlace : { focusedId: "" },
		persistedForRecentContext: false,
		savedCollection: false,
		session: null,
	};
}

export function openFullPage(current: PreviewSession | null): {
	href: string;
	persistPreview: false;
	session: null;
} {
	return {
		href: current ? current.sourceHref : "",
		persistPreview: false,
		session: null,
	};
}

export function persistPreviewForRecentContext(
	_session: PreviewSession | null
): { preview: null } {
	return { preview: null };
}

export function restorePreviewFromRecentContext(
	_stored: unknown
): PreviewSession | null {
	return null;
}

export function smartCollectionFromFilteredSearch(_query: string): {
	created: false;
	membership: readonly [];
} {
	return { created: false, membership: [] };
}
