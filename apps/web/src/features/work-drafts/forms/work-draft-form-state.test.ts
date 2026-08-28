import { expect, test } from "vitest";

import {
	customFieldWidgetsFromDefinitions,
	EMPTY_WORK_DRAFT_FORM,
	resumeListedDraft,
	shouldAutosaveWorkDraft,
	workDraftFormForAutosave,
	workDraftFormFromDraft,
	workDraftLastSavedLine,
} from "./work-draft-form-state";

const SAVE_INSTANT = new Date("2026-03-29T12:00:00.000Z");
const ISTANBUL = {
	appearance: "Dark" as const,
	dateFormat: "locale" as const,
	firstDayOfWeek: "Monday" as const,
	locale: "en-GB",
	timeZone: "Europe/Istanbul",
};

test("Last saved line is omitted until this Draft has a successful save time", () => {
	expect(workDraftLastSavedLine(null, ISTANBUL)).toBeNull();
	expect(workDraftLastSavedLine(SAVE_INSTANT, undefined)).toBeNull();
	expect(workDraftLastSavedLine("not-a-time", ISTANBUL)).toBeNull();
});

test("Last saved line uses Client Shell phrasing with Hesap locale time", () => {
	expect(workDraftLastSavedLine(SAVE_INSTANT, ISTANBUL)).toBe(
		"Last saved: 29/03/2026, 15:00"
	);
});

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

test("Resume fills the form from the listed Draft, not a second fetch", () => {
	expect(
		resumeListedDraft({
			form: {
				customFieldValues: { severity: "High" },
				projectId: "proj-payments",
				title: "HelloIAm",
				type: "Task",
			},
			id: "draft-hello",
		})
	).toEqual({
		draftId: "draft-hello",
		form: {
			customFieldValues: { severity: "High" },
			projectId: "proj-payments",
			title: "HelloIAm",
			type: "Task",
		},
	});
});

test("custom field widgets are the definitions from Work, not a Draft schema", () => {
	expect(
		customFieldWidgetsFromDefinitions([{ id: "severity", label: "Severity" }])
	).toEqual([{ id: "severity", label: "Severity" }]);
});
