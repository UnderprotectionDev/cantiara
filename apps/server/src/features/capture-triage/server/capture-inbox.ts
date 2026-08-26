import type { PrismaClient } from "@cantiara/db";
import { z } from "zod";

export const CAPTURE_INBOX_COPY = {
	bugCapture: "Bug Capture",
	captureInbox: "Capture Inbox",
	channel: "Channel",
	contact: "Contact",
	createBug: "Create Bug",
	expectedBehavior: "Expected Behavior",
	feedback: "Feedback",
	feedbackCapture: "Feedback Capture",
	noteOrExcerpt: "Note or Excerpt",
	observedBehavior: "Observed Behavior",
	project: "Project",
	reproductionContext: "Reproduction Context",
	researchFragment: "Research Fragment",
	save: "Save",
	sourceContext: "Source Context",
	unsavedChangesMayBeLost: "Unsaved changes may be lost",
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
	body: string;
	capturedAt: Date;
	fields: Record<string, string>;
	id: string;
	kind: "capture-inbox-item";
	scope: CaptureInboxScope;
	template: MiniTemplateId | null;
}

export interface CaptureSurfaceEligibility {
	backlog: false;
	bookmark: false;
	draft: false;
	export: false;
	mainRecord: false;
	publish: false;
	search: false;
	share: false;
}

export const CAPTURE_SURFACE_EXCLUSION = {
	backlog: false,
	bookmark: false,
	draft: false,
	export: false,
	mainRecord: false,
	publish: false,
	search: false,
	share: false,
} as const satisfies CaptureSurfaceEligibility;

export interface WorkCreateCommand {
	actorId: string;
	fields: Record<string, string>;
	idempotencyKey: string;
	projectId: string;
	text: string;
	workType: "bug";
}

export interface WorkCreateResult {
	handedOff: true;
	workKey: null;
}

export type WorkCreateAdapter = (
	command: WorkCreateCommand
) => Promise<WorkCreateResult>;

export interface SaveCaptureInput {
	actorId: string;
	fields?: Record<string, string>;
	idempotencyKey: string;
	projectId?: string;
	template?: MiniTemplateId;
	text?: string;
	workspaceId: string;
}

export type SaveCaptureOutcome =
	| {
			item: CaptureInboxItemView;
			lastSuccessfulSaveAt: Date;
			mainRecord: null;
			status: "saved";
	  }
	| { queued: false; reason: "offline"; status: "refused" };

export interface CreateBugInput {
	actorId: string;
	fields?: Record<string, string>;
	idempotencyKey: string;
	projectId: string;
	text?: string;
	workspaceId: string;
}

export type CreateBugOutcome =
	| {
			inboxItem: null;
			lastSuccessfulSaveAt: Date;
			status: "handed-off";
			workCreate: WorkCreateResult;
	  }
	| { queued: false; reason: "offline"; status: "refused" };

export interface CaptureInbox {
	advanceTime: (instant: Date) => void;
	createBug: (
		input: Omit<CreateBugInput, "actorId" | "workspaceId">
	) => Promise<CreateBugOutcome>;
	lastSuccessfulSaveAt: () => Date | null;
	list: (scope: CaptureInboxScope) => Promise<CaptureInboxItemView[]>;
	save: (
		input: Omit<SaveCaptureInput, "actorId" | "workspaceId">
	) => Promise<SaveCaptureOutcome>;
	searchHits: () => readonly [];
	surfaces: (itemId: string) => Promise<CaptureSurfaceEligibility | null>;
	unsavedRisk: (
		hasUnsavedChanges: boolean
	) => typeof CAPTURE_INBOX_COPY.unsavedChangesMayBeLost | null;
	writeQueue: () => readonly never[];
}

const templateById = new Map(
	MINI_TEMPLATE_CATALOG.map((template) => [template.id, template])
);

function scopeFrom(projectId: string | null | undefined): CaptureInboxScope {
	if (projectId) {
		return { kind: "project", projectId };
	}
	return { kind: "workspace" };
}

function templateFields(
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

function formatTemplateBody(
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

function toItemView(row: {
	body: string;
	capturedAt: Date;
	fieldsText: string;
	id: string;
	projectId: string | null;
	template: string | null;
}): CaptureInboxItemView {
	const parsed = miniTemplateIdSchema.safeParse(row.template);
	return {
		body: row.body,
		capturedAt: row.capturedAt,
		fields: z.record(z.string(), z.string()).parse(JSON.parse(row.fieldsText)),
		id: row.id,
		kind: "capture-inbox-item",
		scope: scopeFrom(row.projectId),
		template: parsed.success ? parsed.data : null,
	};
}

export function handOffWorkCreate(): Promise<WorkCreateResult> {
	return Promise.resolve({ handedOff: true, workKey: null });
}

function reviveDate(value: Date | string): Date {
	return value instanceof Date ? value : new Date(value);
}

function reviveSaveOutcome(outcome: SaveCaptureOutcome): SaveCaptureOutcome {
	if (outcome.status !== "saved") {
		return outcome;
	}
	return {
		...outcome,
		item: {
			...outcome.item,
			capturedAt: reviveDate(outcome.item.capturedAt),
		},
		lastSuccessfulSaveAt: reviveDate(outcome.lastSuccessfulSaveAt),
	};
}

function reviveCreateBugOutcome(outcome: CreateBugOutcome): CreateBugOutcome {
	if (outcome.status !== "handed-off") {
		return outcome;
	}
	return {
		...outcome,
		lastSuccessfulSaveAt: reviveDate(outcome.lastSuccessfulSaveAt),
	};
}

export function createCaptureInbox(input: {
	actorId: string;
	clock?: { now: () => Date };
	connected?: boolean;
	prisma: PrismaClient;
	workCreate?: WorkCreateAdapter;
	workspaceId: string;
}): CaptureInbox {
	let now = input.clock ? input.clock.now() : new Date();
	const clock = { now: () => now };
	const workCreate = input.workCreate ?? handOffWorkCreate;
	let lastSuccessfulSaveAt: Date | null = null;
	const connected = () => input.connected !== false;

	return {
		advanceTime(instant) {
			now = instant;
		},
		async createBug(command) {
			if (!connected()) {
				return { queued: false, reason: "offline", status: "refused" };
			}
			const existing = await input.prisma.captureWriteReceipt.findUnique({
				where: { commandKey: command.idempotencyKey },
			});
			if (existing) {
				return reviveCreateBugOutcome(
					JSON.parse(existing.resultJson) as CreateBugOutcome
				);
			}
			const fields = templateFields("bug-capture", command.fields);
			const workCreateResult = await workCreate({
				actorId: input.actorId,
				fields,
				idempotencyKey: command.idempotencyKey,
				projectId: command.projectId,
				text: command.text?.trim() ?? "",
				workType: "bug",
			});
			const savedAt = clock.now();
			const outcome: CreateBugOutcome = {
				inboxItem: null,
				lastSuccessfulSaveAt: savedAt,
				status: "handed-off",
				workCreate: workCreateResult,
			};
			await input.prisma.captureWriteReceipt.create({
				data: {
					actorId: input.actorId,
					commandKey: command.idempotencyKey,
					id: crypto.randomUUID(),
					kind: "create-bug",
					resultJson: JSON.stringify(outcome),
				},
			});
			lastSuccessfulSaveAt = savedAt;
			return outcome;
		},
		lastSuccessfulSaveAt() {
			return lastSuccessfulSaveAt;
		},
		async list(scope) {
			const rows = await input.prisma.captureInboxItem.findMany({
				orderBy: { capturedAt: "asc" },
				where: {
					projectId: scope.kind === "project" ? scope.projectId : null,
					workspaceId: input.workspaceId,
				},
			});
			return rows.map(toItemView);
		},
		async save(command) {
			if (!connected()) {
				return { queued: false, reason: "offline", status: "refused" };
			}
			const existing = await input.prisma.captureWriteReceipt.findUnique({
				where: { commandKey: command.idempotencyKey },
			});
			if (existing) {
				return reviveSaveOutcome(
					JSON.parse(existing.resultJson) as SaveCaptureOutcome
				);
			}
			const template = command.template ?? null;
			const fields = templateFields(template, command.fields);
			const body = template
				? formatTemplateBody(template, fields)
				: (command.text ?? "");
			const capturedAt = clock.now();
			const row = await input.prisma.captureInboxItem.create({
				data: {
					body,
					capturedAt,
					fieldsText: JSON.stringify(fields),
					id: crypto.randomUUID(),
					ownerId: input.actorId,
					projectId: command.projectId ?? null,
					template,
					workspaceId: input.workspaceId,
				},
			});
			const item = toItemView(row);
			const outcome: SaveCaptureOutcome = {
				item,
				lastSuccessfulSaveAt: capturedAt,
				mainRecord: null,
				status: "saved",
			};
			await input.prisma.captureWriteReceipt.create({
				data: {
					actorId: input.actorId,
					commandKey: command.idempotencyKey,
					id: crypto.randomUUID(),
					kind: "save",
					resultJson: JSON.stringify(outcome),
				},
			});
			lastSuccessfulSaveAt = capturedAt;
			return outcome;
		},
		searchHits() {
			return [];
		},
		async surfaces(itemId) {
			const row = await input.prisma.captureInboxItem.findFirst({
				where: { id: itemId, workspaceId: input.workspaceId },
			});
			if (!row) {
				return null;
			}
			return CAPTURE_SURFACE_EXCLUSION;
		},
		unsavedRisk(hasUnsavedChanges) {
			return hasUnsavedChanges
				? CAPTURE_INBOX_COPY.unsavedChangesMayBeLost
				: null;
		},
		writeQueue() {
			return [];
		},
	};
}
