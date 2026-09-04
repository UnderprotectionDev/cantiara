import type { Presentation } from "./smart-collections-copy";

export interface NamedViewSummary {
	filterText: string;
	groupField: string | null;
	id: string;
	isDefault: boolean;
	name: string;
	presentation: Presentation;
	purpose: string | null;
	sortDirection: "asc" | "desc" | null;
	sortField: string | null;
	visibleFields: readonly string[];
}

export interface PresentationDraft {
	filterText: string;
	groupField: string | null;
	presentation: Presentation;
	purpose: string | null;
	sortDirection: "asc" | "desc" | null;
	sortField: string | null;
	visibleFields: readonly string[];
}

export function draftFromView(view: NamedViewSummary): PresentationDraft {
	return {
		filterText: view.filterText,
		groupField: view.groupField,
		presentation: view.presentation,
		purpose: view.purpose,
		sortDirection: view.sortDirection,
		sortField: view.sortField,
		visibleFields: [...view.visibleFields],
	};
}

export function isDraftDirty(
	saved: NamedViewSummary,
	draft: PresentationDraft
): boolean {
	return (
		saved.filterText !== draft.filterText ||
		saved.groupField !== draft.groupField ||
		saved.presentation !== draft.presentation ||
		saved.purpose !== draft.purpose ||
		saved.sortDirection !== draft.sortDirection ||
		saved.sortField !== draft.sortField ||
		saved.visibleFields.join("\0") !== draft.visibleFields.join("\0")
	);
}

export function liveNewWorkMiss(
	prefill: { projectId?: string; status?: string; type?: string },
	draft: { projectId?: string; status?: string; type?: string }
): boolean {
	if (prefill.status !== undefined && draft.status !== prefill.status) {
		return true;
	}
	if (prefill.type !== undefined && draft.type !== prefill.type) {
		return true;
	}
	if (
		prefill.projectId !== undefined &&
		draft.projectId !== prefill.projectId
	) {
		return true;
	}
	return false;
}
