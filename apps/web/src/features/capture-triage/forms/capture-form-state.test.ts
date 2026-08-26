import { expect, test } from "vitest";

import {
	captureFormAfterSave,
	captureFormHasUnsavedCapture,
	captureInboxItemPreview,
	captureInboxListHeading,
	captureInboxListInput,
	createBugIsAvailable,
} from "./capture-form-state";

const LIST_COPY = {
	projectCaptureInbox: "Project Capture Inbox",
	workspaceCaptureInbox: "Workspace Capture Inbox",
} as const;

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

test("the Inbox list heading names Workspace or Project Capture Inbox", () => {
	expect(captureInboxListHeading("", LIST_COPY)).toBe(
		"Workspace Capture Inbox"
	);
	expect(captureInboxListHeading("  feedback  ", LIST_COPY)).toBe(
		"Project Capture Inbox"
	);
});

test("an Inbox item shows its body, or the template label when the body is empty", () => {
	expect(
		captureInboxItemPreview(
			{ body: "Feedback\nFeedback2", template: "feedback-capture" },
			"Feedback Capture"
		)
	).toBe("Feedback\nFeedback2");
	expect(
		captureInboxItemPreview(
			{ body: "   ", template: "feedback-capture" },
			"Feedback Capture"
		)
	).toBe("Feedback Capture");
});

test("Create Bug is available only when Project is set and type is Bug Capture or unspecified", () => {
	expect(
		createBugIsAvailable({
			fields: {},
			projectId: "feedback",
			template: "feedback-capture",
			text: "",
		})
	).toBe(false);
	expect(
		createBugIsAvailable({
			fields: {},
			projectId: "feedback",
			template: "bug-capture",
			text: "",
		})
	).toBe(true);
	expect(
		createBugIsAvailable({
			fields: {},
			projectId: "",
			template: "bug-capture",
			text: "",
		})
	).toBe(false);
	expect(
		createBugIsAvailable({
			fields: {},
			projectId: "feedback",
			template: "",
			text: "A thought",
		})
	).toBe(true);
});
