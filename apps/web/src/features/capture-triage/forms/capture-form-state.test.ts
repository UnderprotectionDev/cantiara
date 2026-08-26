import { expect, test } from "vitest";

import {
	bulkClusterPlacementOptions,
	bulkSenseMakingColumns,
	captureFormAfterSave,
	captureFormHasUnsavedCapture,
	captureInboxGroups,
	captureInboxItemPreview,
	captureInboxListHeading,
	captureInboxListInput,
	createBugIsAvailable,
	nextBulkPosition,
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

test("the Capture Inbox page groups items by Workspace and each Project Inbox", () => {
	const workspaceItem = {
		body: "A thought before I know the Project",
		id: "ws-1",
		scope: { kind: "workspace" as const },
		template: null,
	};
	const feedbackItem = {
		body: "Feedback\nFeedback2",
		id: "p-1",
		scope: { kind: "project" as const, projectId: "Feedback" },
		template: "feedback-capture" as const,
	};
	const researchItem = {
		body: "Note or Excerpt\nClip",
		id: "p-2",
		scope: { kind: "project" as const, projectId: "Research Fragment" },
		template: "research-fragment" as const,
	};
	expect(
		captureInboxGroups([researchItem, workspaceItem, feedbackItem], LIST_COPY)
	).toEqual([
		{
			heading: "Workspace Capture Inbox",
			items: [workspaceItem],
			projectId: null,
		},
		{
			heading: "Project Capture Inbox",
			items: [feedbackItem],
			projectId: "Feedback",
		},
		{
			heading: "Project Capture Inbox",
			items: [researchItem],
			projectId: "Research Fragment",
		},
	]);
});

test("a Project Inbox groups items together without requiring the same capital letters", () => {
	const firstSeen = {
		body: "Feedback\nUpper",
		id: "p-1",
		scope: { kind: "project" as const, projectId: "Feedback" },
		template: "feedback-capture" as const,
	};
	const otherCasing = {
		body: "Feedback\nLower",
		id: "p-2",
		scope: { kind: "project" as const, projectId: "feedback" },
		template: "feedback-capture" as const,
	};
	expect(captureInboxGroups([firstSeen, otherCasing], LIST_COPY)).toEqual([
		{
			heading: "Project Capture Inbox",
			items: [firstSeen, otherCasing],
			projectId: "Feedback",
		},
	]);
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

test("Bulk sense-making places a capture by choosing Ungrouped or a named cluster", () => {
	expect(
		bulkClusterPlacementOptions({
			clusters: [
				{ id: "cluster-login", name: "Login bugs" },
				{ id: "cluster-test", name: "test" },
			],
			ungrouped: "Ungrouped",
		})
	).toEqual([
		{ clusterId: null, name: "Ungrouped" },
		{ clusterId: "cluster-login", name: "Login bugs" },
		{ clusterId: "cluster-test", name: "test" },
	]);
});

test("Bulk sense-making lays captures side by side by cluster name and position", () => {
	const crash = {
		body: "Crash on save",
		id: "cap-crash",
		template: null,
	};
	const login = {
		body: "Login does nothing",
		id: "cap-login",
		template: null,
	};
	const stray = {
		body: "A later thought",
		id: "cap-stray",
		template: null,
	};
	expect(
		bulkSenseMakingColumns({
			clusters: [{ id: "cluster-login", name: "Login bugs" }],
			items: [crash, login, stray],
			placements: [
				{
					clusterId: "cluster-login",
					itemId: crash.id,
					position: { x: 1, y: 0 },
				},
				{
					clusterId: "cluster-login",
					itemId: login.id,
					position: { x: 0, y: 0 },
				},
			],
		})
	).toEqual([
		{
			clusterId: "cluster-login",
			items: [login, crash],
			name: "Login bugs",
		},
		{
			clusterId: null,
			items: [stray],
			name: null,
		},
	]);
});

test("the next Bulk card sits to the right of cards already in that cluster", () => {
	expect(
		nextBulkPosition(
			[
				{
					clusterId: "cluster-login",
					itemId: "cap-login",
					position: { x: 0, y: 0 },
				},
				{
					clusterId: "cluster-login",
					itemId: "cap-crash",
					position: { x: 2, y: 0 },
				},
			],
			"cluster-login"
		)
	).toEqual({ x: 3, y: 0 });
	expect(nextBulkPosition([], null)).toEqual({ x: 0, y: 0 });
});
