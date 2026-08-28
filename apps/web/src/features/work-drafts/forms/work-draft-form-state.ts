import type { WorkType } from "@/features/work-lifecycle/forms/work-lifecycle-copy";

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

export function customFieldWidgetsFromDefinitions(
	definitions: readonly WorkCustomFieldWidget[]
): readonly WorkCustomFieldWidget[] {
	return definitions;
}
