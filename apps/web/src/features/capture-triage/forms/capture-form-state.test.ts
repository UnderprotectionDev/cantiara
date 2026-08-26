import { expect, test } from "vitest";

import {
	captureFormAfterSave,
	captureFormHasUnsavedCapture,
	captureInboxListInput,
} from "./capture-form-state";

test("after Save the Capture Inbox stays on the same Project Inbox", () => {
	expect(
		captureFormAfterSave({
			fields: { observedBehavior: "Login button does nothing" },
			projectId: "proj-cantiara",
			template: "bug-capture",
			text: "scratch",
		})
	).toEqual({
		fields: {},
		projectId: "proj-cantiara",
		template: "",
		text: "",
	});
});

test("the Inbox list query follows the Project field, or Workspace when it is empty", () => {
	expect(captureInboxListInput("proj-cantiara")).toEqual({
		projectId: "proj-cantiara",
	});
	expect(captureInboxListInput("  ")).toEqual({});
});

test("Project is Inbox scope and is not unsaved capture text", () => {
	expect(
		captureFormHasUnsavedCapture({
			fields: {},
			projectId: "proj-cantiara",
			template: "",
			text: "",
		})
	).toBe(false);
	expect(
		captureFormHasUnsavedCapture({
			fields: {},
			projectId: "",
			template: "",
			text: "A thought",
		})
	).toBe(true);
});
