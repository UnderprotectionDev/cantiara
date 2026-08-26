import { z } from "zod";

export const CAPTURE_INBOX_COPY = {
	attachToExisting: "Attach to existing",
	back: "Back",
	bugCapture: "Bug Capture",
	captureInbox: "Capture Inbox",
	channel: "Channel",
	contact: "Contact",
	convert: "Convert",
	createBug: "Create Bug",
	createBugDoesNotStayInInbox:
		"Create Bug does not stay in the Capture Inbox. A Work record is not stored yet.",
	createBugNeedsProjectAndBugCapture:
		"Create Bug is available when Project is set and type is Bug Capture.",
	delete: "Delete",
	document: "Document",
	evidence: "Evidence",
	expectedBehavior: "Expected Behavior",
	feedback: "Feedback",
	feedbackCapture: "Feedback Capture",
	fileAttachment: "File Attachment",
	leaveEmptyForWorkspaceCaptureInbox:
		"Leave empty to save to the Workspace Capture Inbox.",
	noCapturesInThisInbox: "No captures in this Inbox.",
	noteOrExcerpt: "Note or Excerpt",
	observedBehavior: "Observed Behavior",
	origin: "Origin",
	otherProjects: "Other Projects",
	project: "Project",
	projectCaptureInbox: "Project Capture Inbox",
	reproductionContext: "Reproduction Context",
	researchFragment: "Research Fragment",
	save: "Save",
	sequentialTriage: "Sequential triage",
	sourceContext: "Source Context",
	unsavedChangesMayBeLost: "Unsaved changes may be lost",
	work: "Work",
	workspaceCaptureInbox: "Workspace Capture Inbox",
} as const;

export const MINI_TEMPLATE_IDS = [
	"bug-capture",
	"feedback-capture",
	"research-fragment",
] as const;

export type MiniTemplateId = (typeof MINI_TEMPLATE_IDS)[number];

export const miniTemplateIdSchema = z.enum(MINI_TEMPLATE_IDS);

export const MINI_TEMPLATE_CATALOG = [
	{
		fields: [
			{
				id: "observedBehavior",
				label: CAPTURE_INBOX_COPY.observedBehavior,
				required: false,
			},
			{
				id: "expectedBehavior",
				label: CAPTURE_INBOX_COPY.expectedBehavior,
				required: false,
			},
			{
				id: "reproductionContext",
				label: CAPTURE_INBOX_COPY.reproductionContext,
				required: false,
			},
		],
		id: "bug-capture",
		label: CAPTURE_INBOX_COPY.bugCapture,
	},
	{
		fields: [
			{
				id: "feedback",
				label: CAPTURE_INBOX_COPY.feedback,
				required: false,
			},
			{
				id: "channel",
				label: CAPTURE_INBOX_COPY.channel,
				required: false,
			},
			{
				id: "contact",
				label: CAPTURE_INBOX_COPY.contact,
				required: false,
			},
		],
		id: "feedback-capture",
		label: CAPTURE_INBOX_COPY.feedbackCapture,
	},
	{
		fields: [
			{
				id: "noteOrExcerpt",
				label: CAPTURE_INBOX_COPY.noteOrExcerpt,
				required: false,
			},
			{
				id: "sourceContext",
				label: CAPTURE_INBOX_COPY.sourceContext,
				required: false,
			},
		],
		id: "research-fragment",
		label: CAPTURE_INBOX_COPY.researchFragment,
	},
] as const;

export type MiniTemplateCatalog = typeof MINI_TEMPLATE_CATALOG;

export function miniTemplateCatalog(): MiniTemplateCatalog {
	return MINI_TEMPLATE_CATALOG;
}

export type CaptureInboxScope =
	| { kind: "workspace" }
	| { kind: "project"; projectId: string };

export interface CaptureInboxItemView {
	attachmentRef: string | null;
	body: string;
	capturedAt: Date;
	fields: Record<string, string>;
	id: string;
	kind: "capture-inbox-item";
	link: string;
	origin: string;
	scope: CaptureInboxScope;
	template: MiniTemplateId | null;
}

export interface CaptureSurfaceEligibility {
	backlog: false;
	draft: false;
	export: false;
	mainRecord: false;
	publish: false;
	search: false;
	share: false;
}

export const CAPTURE_SURFACE_EXCLUSION = {
	backlog: false,
	draft: false,
	export: false,
	mainRecord: false,
	publish: false,
	search: false,
	share: false,
} as const satisfies CaptureSurfaceEligibility;

const templateById = new Map(
	MINI_TEMPLATE_CATALOG.map((template) => [template.id, template])
);

export function scopeFrom(
	projectId: string | null | undefined
): CaptureInboxScope {
	if (projectId) {
		return { kind: "project", projectId };
	}
	return { kind: "workspace" };
}

export function templateFields(
	templateId: MiniTemplateId | null,
	raw: Record<string, string> | undefined
): Record<string, string> {
	if (!templateId) {
		return {};
	}
	const template = templateById.get(templateId);
	if (!template) {
		return {};
	}
	const fields: Record<string, string> = {};
	for (const field of template.fields) {
		const value = raw?.[field.id]?.trim() ?? "";
		if (value) {
			fields[field.id] = value;
		}
	}
	return fields;
}

export function formatTemplateBody(
	templateId: MiniTemplateId,
	fields: Record<string, string>
): string {
	const template = templateById.get(templateId);
	if (!template) {
		return "";
	}
	const blocks: string[] = [];
	for (const field of template.fields) {
		const value = fields[field.id];
		if (value) {
			blocks.push(`${field.label}\n${value}`);
		}
	}
	return blocks.join("\n\n");
}

export interface CaptureInboxItemRow {
	attachmentRef: string | null;
	body: string;
	capturedAt: Date;
	fieldsText: string;
	id: string;
	link: string;
	origin: string;
	projectId: string | null;
	template: string | null;
}

export function toItemView(row: CaptureInboxItemRow): CaptureInboxItemView {
	const parsed = miniTemplateIdSchema.safeParse(row.template);
	return {
		attachmentRef: row.attachmentRef,
		body: row.body,
		capturedAt: row.capturedAt,
		fields: z.record(z.string(), z.string()).parse(JSON.parse(row.fieldsText)),
		id: row.id,
		kind: "capture-inbox-item",
		link: row.link,
		origin: row.origin,
		scope: scopeFrom(row.projectId),
		template: parsed.success ? parsed.data : null,
	};
}
