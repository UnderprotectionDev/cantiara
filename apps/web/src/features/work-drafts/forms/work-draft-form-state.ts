import { formatDateTime } from "@cantiara/auth/account-preferences-format";
import type { AccountPreferencesInput } from "@cantiara/auth/account-preferences-model";
import type { WorkType } from "@/features/work-lifecycle/forms/work-lifecycle-copy";

import { WORK_DRAFTS_COPY } from "./work-drafts-copy";

export interface WorkDraftFormValues {
	customFieldValues: Record<string, string>;
	projectId: string;
	title: string;
	type: WorkType;
}

export interface WorkCustomFieldWidget {
	id: string;
	label: string;
}

export const EMPTY_WORK_DRAFT_FORM: WorkDraftFormValues = {
	customFieldValues: {},
	projectId: "",
	title: "",
	type: "Task",
};

export function workDraftFormForAutosave(values: WorkDraftFormValues): {
	customFieldValues: Record<string, string>;
	projectId: string | null;
	title: string;
	type: WorkType;
} {
	return {
		customFieldValues: values.customFieldValues,
		projectId: values.projectId.trim() || null,
		title: values.title,
		type: values.type,
	};
}

export function shouldAutosaveWorkDraft(values: WorkDraftFormValues): boolean {
	if (values.title.trim().length > 0) {
		return true;
	}
	if (values.projectId.trim().length > 0) {
		return true;
	}
	if (values.type !== EMPTY_WORK_DRAFT_FORM.type) {
		return true;
	}
	return Object.values(values.customFieldValues).some(
		(value) => value.trim().length > 0
	);
}

export function workDraftLastSavedLine(
	lastSuccessfulSaveAt: Date | string | null | undefined,
	preferences: AccountPreferencesInput | undefined
): string | null {
	if (!(lastSuccessfulSaveAt && preferences)) {
		return null;
	}
	const instant =
		lastSuccessfulSaveAt instanceof Date
			? lastSuccessfulSaveAt
			: new Date(lastSuccessfulSaveAt);
	if (Number.isNaN(instant.getTime())) {
		return null;
	}
	const display = formatDateTime(instant, preferences);
	if (display.trim().length === 0) {
		return null;
	}
	return `${WORK_DRAFTS_COPY.lastSaved}: ${display}`;
}

export function workDraftFormFromDraft(draft: {
	form: {
		customFieldValues: Record<string, string>;
		projectId: string | null;
		title: string;
		type: WorkType;
	};
}): WorkDraftFormValues {
	return {
		customFieldValues: draft.form.customFieldValues,
		projectId: draft.form.projectId ?? "",
		title: draft.form.title,
		type: draft.form.type,
	};
}

export function resumeListedDraft(draft: {
	form: {
		customFieldValues: Record<string, string>;
		projectId: string | null;
		title: string;
		type: WorkType;
	};
	id: string;
}): { draftId: string; form: WorkDraftFormValues } {
	return {
		draftId: draft.id,
		form: workDraftFormFromDraft(draft),
	};
}

export interface ListedWorkDraft {
	form: {
		customFieldValues: Record<string, string>;
		projectId: string | null;
		title: string;
		type: WorkType;
	};
	id: string;
	updatedAt: Date | string;
}

export function latestWorkDraftForProject(
	drafts: readonly ListedWorkDraft[],
	projectId: string
): ListedWorkDraft | null {
	let latest: ListedWorkDraft | null = null;
	let latestTime = Number.NEGATIVE_INFINITY;
	for (const draft of drafts) {
		if (draft.form.projectId !== projectId) {
			continue;
		}
		const time = new Date(draft.updatedAt).getTime();
		if (Number.isNaN(time) || time < latestTime) {
			continue;
		}
		latest = draft;
		latestTime = time;
	}
	return latest;
}

export function createWorkFormSeedFromListedDrafts(
	drafts: readonly ListedWorkDraft[],
	projectId: string
): {
	draftId: string | null;
	form: WorkDraftFormValues | undefined;
	lastSuccessfulSaveAt: Date | string | null;
} {
	const latest = latestWorkDraftForProject(drafts, projectId);
	if (!latest) {
		return {
			draftId: null,
			form: undefined,
			lastSuccessfulSaveAt: null,
		};
	}
	const resumed = resumeListedDraft(latest);
	return {
		draftId: resumed.draftId,
		form: resumed.form,
		lastSuccessfulSaveAt: latest.updatedAt,
	};
}

export function customFieldWidgetsFromDefinitions(
	definitions: readonly WorkCustomFieldWidget[]
): readonly WorkCustomFieldWidget[] {
	return definitions;
}
