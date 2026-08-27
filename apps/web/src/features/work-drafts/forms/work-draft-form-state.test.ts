import { expect, test } from "vitest";

import {
	customFieldWidgetsFromDefinitions,
	EMPTY_WORK_DRAFT_FORM,
	shouldAutosaveWorkDraft,
	workDraftFormForAutosave,
	workDraftFormFromDraft,
} from "./work-draft-form-state";

test("autosave keeps any filled Draft form field, including type and Project", () => {
	expect(shouldAutosaveWorkDraft(EMPTY_WORK_DRAFT_FORM)).toBe(false);
	expect(
		shouldAutosaveWorkDraft({
			...EMPTY_WORK_DRAFT_FORM,
			title: "Intake",
		})
	).toBe(true);
	expect(
		shouldAutosaveWorkDraft({
			...EMPTY_WORK_DRAFT_FORM,
			type: "Bug",
		})
	).toBe(true);
	expect(
		shouldAutosaveWorkDraft({
			...EMPTY_WORK_DRAFT_FORM,
			projectId: "proj-payments",
		})
	).toBe(true);
});

test("autosave payload keeps Project as form state, not a Work scope", () => {
	expect(
		workDraftFormForAutosave({
			customFieldValues: { severity: "High" },
			projectId: "proj-payments",
			title: "Intake",
			type: "Bug",
		})
	).toEqual({
		customFieldValues: { severity: "High" },
		projectId: "proj-payments",
		title: "Intake",
		type: "Bug",
	});
	expect(
		workDraftFormForAutosave({
			...EMPTY_WORK_DRAFT_FORM,
			projectId: "  ",
		})
	).toEqual({
		customFieldValues: {},
		projectId: null,
		title: "",
		type: "Task",
	});
});

test("resume restores Draft form state without a Work key", () => {
	expect(
		workDraftFormFromDraft({
			form: {
				customFieldValues: {},
				projectId: null,
				title: "Unfinished",
				type: "Research",
			},
		})
	).toEqual({
		customFieldValues: {},
		projectId: "",
		title: "Unfinished",
		type: "Research",
	});
});

test("custom field widgets are the definitions from Work, not a Draft schema", () => {
	expect(
		customFieldWidgetsFromDefinitions([{ id: "severity", label: "Severity" }])
	).toEqual([{ id: "severity", label: "Severity" }]);
});
