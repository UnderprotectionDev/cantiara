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
