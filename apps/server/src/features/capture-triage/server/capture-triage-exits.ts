import type { Prisma, PrismaClient } from "@cantiara/db";
import { z } from "zod";
import {
	lockMutation,
	writeDurableReceipt,
} from "../../mutation-core/server/durable-mutation";
import {
	MUTATION_COPY,
	payloadFingerprint,
} from "../../mutation-core/server/mutation-shared";
import {
	CAPTURE_INBOX_COPY,
	type CaptureAttachmentView,
	type CaptureInboxItemView,
	type CaptureInboxScope,
	MINI_TEMPLATE_CATALOG,
} from "./capture-inbox-model";

export const TRIAGE_EXITS = ["convert", "attach", "delete"] as const;
export type TriageExit = (typeof TRIAGE_EXITS)[number];

export const CONVERT_TARGET_KINDS = [
	"work",
	"document",
	"file-attachment",
	"feedback",
] as const;
export type ConvertTargetKind = (typeof CONVERT_TARGET_KINDS)[number];

export const BIND_RELATIONS = ["origin", "evidence"] as const;
export type BindRelation = (typeof BIND_RELATIONS)[number];

export const convertTargetKindSchema = z.enum(CONVERT_TARGET_KINDS);
export const bindRelationSchema = z.enum(BIND_RELATIONS);

export const TRIAGE_EXIT_CATALOG = [
	{ id: "convert", label: CAPTURE_INBOX_COPY.convert },
	{ id: "attach", label: CAPTURE_INBOX_COPY.attachToExisting },
	{ id: "delete", label: CAPTURE_INBOX_COPY.delete },
] as const;

export type SuggestionBasisKind = "title" | "text" | "link" | "related-context";

export interface SuggestionBasis {
	excerpt: string;
	kind: SuggestionBasisKind;
}

export interface SimilarMatch {
	basis: SuggestionBasis;
	id: string;
	projectId: string;
	projectName: string;
	title: string;
}

export interface SimilarSuggestions {
	otherProjects: {
		heading: typeof CAPTURE_INBOX_COPY.otherProjects;
		matches: SimilarMatch[];
	};
	primary: SimilarMatch[];
}

export interface ConvertFieldMapping {
	sourceField: string;
	targetField: string;
	value: string;
}

export interface ConvertTargetScope {
	heading:
		| typeof CAPTURE_INBOX_COPY.projectCaptureInbox
		| typeof CAPTURE_INBOX_COPY.workspaceCaptureInbox;
	kind: CaptureInboxScope["kind"];
	projectId: string | null;
}

export interface ConvertPreview {
	fieldMappings: ConvertFieldMapping[];
	original: {
		capturedAt: Date;
		link: string;
		origin: string;
		screenshot: string | null;
		text: string;
	};
	proposed: {
		body: string;
		kind: ConvertTargetKind;
		label: string;
		link: string;
		screenshot: string | null;
		targetScope: ConvertTargetScope;
	};
}

export interface ConvertCommand {
	actorId: string;
	idempotencyKey: string;
	item: CaptureInboxItemView;
	targetKind: ConvertTargetKind;
}

export interface ConvertResult {
	handedOff: boolean;
	recordId: string | null;
	targetKind: ConvertTargetKind;
}

export type ConvertAdapter = (
	command: ConvertCommand
) => Promise<ConvertResult>;

export function handOffConvert(
	command: ConvertCommand
): Promise<ConvertResult> {
	return Promise.resolve({
		handedOff: true,
		recordId: null,
		targetKind: command.targetKind,
	});
}

export interface FileAttachmentPromotionCommand {
	actorId: string;
	idempotencyKey: string;
	item: CaptureInboxItemView;
	staging: CaptureAttachmentView;
	targetScope: ConvertTargetScope;
}

export type FileAttachmentPromotionResult =
	| {
			fileAttachmentId: string | null;
			status: "promoted";
			visibleAttachment: null;
	  }
	| {
			explanation?: {
				reason: string;
				retryBound: "none" | "once";
				supportReference: string;
				written: boolean;
			};
			status: "failed";
			visibleAttachment: null;
	  };

export type FileAttachmentFinalizeAdapter = (
	command: FileAttachmentPromotionCommand
) => Promise<FileAttachmentPromotionResult>;

export function handOffFileAttachmentPromote(): Promise<FileAttachmentPromotionResult> {
	return Promise.resolve({
		fileAttachmentId: null,
		status: "promoted",
		visibleAttachment: null,
	});
}

export interface BoundRecord {
	binds: Array<{
		attributed: Record<string, string>;
		captureId: string;
		mergeId: string;
		previous: Record<string, string>;
		relation: BindRelation;
	}>;
	fields: Record<string, string>;
	id: string;
	projectId: string;
	projectName: string;
	title: string;
}

export interface RecordBinder {
	bind: (input: {
		attributedFields: Record<string, string>;
		captureId: string;
		mergeId: string;
		relation: BindRelation;
		targetId: string;
	}) => BoundRecord | undefined;
	editField: (id: string, field: string, value: string) => void;
	get: (id: string) => BoundRecord | undefined;
	unbind: (mergeId: string) => BoundRecord | undefined;
}

export function createRecordBinder(
	records: Omit<BoundRecord, "binds">[]
): RecordBinder {
	const store = new Map<string, BoundRecord>(
		records.map((record) => [
			record.id,
			{
				...record,
				binds: [],
				fields: { ...record.fields },
			},
		])
	);

	function snapshot(record: BoundRecord | undefined): BoundRecord | undefined {
		if (!record) {
			return;
		}
		return {
			...record,
			binds: record.binds.map((bind) => ({
				...bind,
				attributed: { ...bind.attributed },
				previous: { ...bind.previous },
			})),
			fields: { ...record.fields },
		};
	}

	return {
		bind(input) {
			const record = store.get(input.targetId);
			if (!record) {
				return;
			}
			const previous: Record<string, string> = {};
			for (const [key, value] of Object.entries(input.attributedFields)) {
				previous[key] = record.fields[key] ?? "";
				record.fields[key] = value;
			}
			record.binds.push({
				attributed: { ...input.attributedFields },
				captureId: input.captureId,
				mergeId: input.mergeId,
				previous,
				relation: input.relation,
			});
			return snapshot(record);
		},
		editField(id, field, value) {
			const record = store.get(id);
			if (!record) {
				return;
			}
			record.fields[field] = value;
		},
		get(id) {
			return snapshot(store.get(id));
		},
		unbind(mergeId) {
			for (const record of store.values()) {
				const bind = record.binds.find((entry) => entry.mergeId === mergeId);
				if (!bind) {
					continue;
				}
				record.binds = record.binds.filter(
					(entry) => entry.mergeId !== mergeId
				);
				for (const [key, written] of Object.entries(bind.attributed)) {
					if (record.fields[key] !== written) {
						continue;
					}
					const previous = bind.previous[key] ?? "";
					if (previous) {
						record.fields[key] = previous;
					} else {
						delete record.fields[key];
					}
				}
				return snapshot(record);
			}
		},
	};
}

export interface AttachPreview {
	crossProject: boolean;
	item: CaptureInboxItemView;
	relation: BindRelation;
	target: {
		id: string;
		projectId: string;
		projectName: string;
		title: string;
	};
}

export interface MergeUndoPreview {
	bindsToRemove: Array<{
		fields: Record<string, string>;
		relation: BindRelation;
		targetId: string;
	}>;
	mergeId: string;
	restoredItem: CaptureInboxItemView;
}

export type TriageWriteOutcome =
	| { queued: false; reason: "offline"; status: "refused" }
	| { reason: typeof MUTATION_COPY.conflict; status: "conflict" };

export type DeleteOutcome =
	| TriageWriteOutcome
	| { exit: "delete"; inboxItem: null; status: "consumed" }
	| { status: "not-found" };

export type ConvertOutcome =
	| TriageWriteOutcome
	| {
			exit: "convert";
			inboxItem: null;
			mainRecord: null;
			recordCreate: ConvertResult;
			status: "consumed";
			visibleAttachment: null;
	  }
	| {
			explanation?: {
				reason: string;
				retryBound: "none" | "once";
				supportReference: string;
				written: boolean;
			};
			inboxItem: CaptureInboxItemView;
			status: "finalize-failed";
			visibleAttachment: null;
	  }
	| { preview: ConvertPreview; status: "needs-preview" }
	| { status: "not-found" };

export type AttachOutcome =
	| TriageWriteOutcome
	| {
			bind: {
				fields: Record<string, string>;
				relation: BindRelation;
				targetId: string;
			};
			exit: "attach";
			inboxItem: null;
			mergeId: string;
			status: "consumed";
	  }
	| { preview: AttachPreview; status: "needs-preview" }
	| { status: "not-found" };

export type UndoMergeOutcome =
	| TriageWriteOutcome
	| { inboxItem: CaptureInboxItemView; status: "restored" }
	| { status: "not-found" };

const templateById = new Map(
	MINI_TEMPLATE_CATALOG.map((template) => [template.id, template])
);

export function convertTargetLabel(kind: ConvertTargetKind): string {
	if (kind === "work") {
		return CAPTURE_INBOX_COPY.work;
	}
	if (kind === "document") {
		return CAPTURE_INBOX_COPY.document;
	}
	if (kind === "feedback") {
		return CAPTURE_INBOX_COPY.feedback;
	}
	return CAPTURE_INBOX_COPY.fileAttachment;
}

export function convertTargetScope(
	item: CaptureInboxItemView
): ConvertTargetScope {
	if (item.scope.kind === "project") {
		return {
			heading: CAPTURE_INBOX_COPY.projectCaptureInbox,
			kind: "project",
			projectId: item.scope.projectId,
		};
	}
	return {
		heading: CAPTURE_INBOX_COPY.workspaceCaptureInbox,
		kind: "workspace",
		projectId: null,
	};
}

export function convertFieldMappings(
	item: CaptureInboxItemView
): ConvertFieldMapping[] {
	if (!item.template) {
		return [];
	}
	const template = templateById.get(item.template);
	if (!template) {
		return [];
	}
	const mappings: ConvertFieldMapping[] = [];
	for (const field of template.fields) {
		const value = item.fields[field.id];
		if (!value) {
			continue;
		}
		mappings.push({
			sourceField: field.label,
			targetField: field.label,
			value,
		});
	}
	return mappings;
}

export function buildConvertPreview(
	item: CaptureInboxItemView,
	targetKind: ConvertTargetKind
): ConvertPreview {
	return {
		fieldMappings: convertFieldMappings(item),
		original: {
			capturedAt: item.capturedAt,
			link: item.link,
			origin: item.origin,
			screenshot: item.attachment
				? item.attachment.filename
				: item.attachmentRef,
			text: item.body,
		},
		proposed: {
			body: item.body,
			kind: targetKind,
			label: convertTargetLabel(targetKind),
			link: item.link,
			screenshot: item.attachment
				? item.attachment.filename
				: item.attachmentRef,
			targetScope: convertTargetScope(item),
		},
	};
}

export function groupSimilarSuggestions(
	item: CaptureInboxItemView,
	matches: SimilarMatch[]
): SimilarSuggestions {
	const itemProjectId =
		item.scope.kind === "project"
			? item.scope.projectId.trim().toLocaleLowerCase("en-US")
			: "";
	const primary: SimilarMatch[] = [];
	const other: SimilarMatch[] = [];
	for (const match of matches) {
		const matchProject = match.projectId.trim().toLocaleLowerCase("en-US");
		if (itemProjectId && matchProject === itemProjectId) {
			primary.push(match);
			continue;
		}
		other.push(match);
	}
	return {
		otherProjects: {
			heading: CAPTURE_INBOX_COPY.otherProjects,
			matches: other,
		},
		primary,
	};
}

export function originAttributedFields(
	item: CaptureInboxItemView
): Record<string, string> {
	const fields: Record<string, string> = {
		originCapturedAt: item.capturedAt.toISOString(),
		originMessage: item.body,
	};
	if (item.link) {
		fields.originLink = item.link;
	}
	if (item.attachmentRef) {
		fields.originAttachment = item.attachmentRef;
	}
	if (item.origin) {
		fields.originSource = item.origin;
	}
	return fields;
}

function parseStringRecord(text: string): Record<string, string> {
	try {
		const parsed: unknown = JSON.parse(text);
		if (
			typeof parsed !== "object" ||
			parsed === null ||
			Array.isArray(parsed)
		) {
			return {};
		}
		const record: Record<string, string> = {};
		for (const [key, entry] of Object.entries(parsed)) {
			if (typeof entry === "string") {
				record[key] = entry;
			}
		}
		return record;
	} catch {
		return {};
	}
}

function reviveDate(value: Date | string): Date {
	return value instanceof Date ? value : new Date(value);
}

interface InboxRow {
	attachmentRef: string | null;
	body: string;
	capturedAt: Date;
	consumedAttributedText: string;
	consumedExit: string | null;
	consumedMergeId: string | null;
	consumedRelation: string | null;
	consumedTargetId: string | null;
	consumedTargetKind: string | null;
	fieldsText: string;
	id: string;
	link: string;
	origin: string;
	projectId: string | null;
	staging?: { filename: string } | null;
	template: string | null;
}

export interface TriageExitsContext {
	actorId: string;
	binder: RecordBinder;
	clock: { now: () => Date };
	connected: () => boolean;
	convertCreate: ConvertAdapter;
	deleteStaging: (inboxItemId: string) => Promise<void>;
	fileAttachmentFinalize: FileAttachmentFinalizeAdapter;
	prisma: PrismaClient;
	similarRecords: (item: CaptureInboxItemView) => SimilarMatch[];
	toItemView: (row: InboxRow) => CaptureInboxItemView;
	workspaceId: string;
}

async function readHumanReceipt(
	prisma: PrismaClient | Prisma.TransactionClient,
	commandKey: string,
	payload: unknown
) {
	const existing = await prisma.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (!existing) {
		return null;
	}
	if (existing.payloadFingerprint !== payloadFingerprint(payload)) {
		return { kind: "conflict" as const };
	}
	return { kind: "replay" as const, resultValue: existing.resultValue };
}

function reviveItem(item: CaptureInboxItemView): CaptureInboxItemView {
	return {
		...item,
		capturedAt: reviveDate(item.capturedAt),
	};
}

function convertFinalizeFailed(
	item: CaptureInboxItemView,
	explanation?: {
		reason: string;
		retryBound: "none" | "once";
		supportReference: string;
		written: boolean;
	}
): ConvertOutcome {
	return {
		...(explanation ? { explanation } : {}),
		inboxItem: item,
		status: "finalize-failed",
		visibleAttachment: null,
	};
}

async function promoteThenCreateRecord(
	ctx: TriageExitsContext,
	input: {
		idempotencyKey: string;
		item: CaptureInboxItemView;
		targetKind: ConvertTargetKind;
		targetScope: ConvertPreview["proposed"]["targetScope"];
	}
): Promise<
	| { recordCreate: ConvertResult; status: "ok" }
	| { outcome: ConvertOutcome; status: "failed" }
> {
	if (input.item.attachment) {
		const promotion = await ctx.fileAttachmentFinalize({
			actorId: ctx.actorId,
			idempotencyKey: input.idempotencyKey,
			item: input.item,
			staging: input.item.attachment,
			targetScope: input.targetScope,
		});
		if (promotion.status === "failed") {
			return {
				outcome: convertFinalizeFailed(input.item, promotion.explanation),
				status: "failed",
			};
		}
	}
	const recordCreate = await ctx.convertCreate({
		actorId: ctx.actorId,
		idempotencyKey: input.idempotencyKey,
		item: input.item,
		targetKind: input.targetKind,
	});
	if (!recordCreate.handedOff) {
		return {
			outcome: convertFinalizeFailed(input.item),
			status: "failed",
		};
	}
	return { recordCreate, status: "ok" };
}

function reviveConvertOutcome(outcome: ConvertOutcome): ConvertOutcome {
	if (outcome.status === "needs-preview") {
		return {
			...outcome,
			preview: {
				...outcome.preview,
				original: {
					...outcome.preview.original,
					capturedAt: reviveDate(outcome.preview.original.capturedAt),
				},
			},
		};
	}
	if (outcome.status === "finalize-failed") {
		return {
			...outcome,
			inboxItem: reviveItem(outcome.inboxItem),
		};
	}
	return outcome;
}

function reviveAttachOutcome(outcome: AttachOutcome): AttachOutcome {
	if (outcome.status === "needs-preview") {
		return {
			...outcome,
			preview: {
				...outcome.preview,
				item: reviveItem(outcome.preview.item),
			},
		};
	}
	return outcome;
}

function reviveUndoOutcome(outcome: UndoMergeOutcome): UndoMergeOutcome {
	if (outcome.status !== "restored") {
		return outcome;
	}
	return {
		...outcome,
		inboxItem: reviveItem(outcome.inboxItem),
	};
}

export function createTriageExits(ctx: TriageExitsContext) {
	async function loadOpenItem(itemId: string) {
		return await ctx.prisma.captureInboxItem.findFirst({
			include: { staging: true },
			where: {
				consumedAt: null,
				id: itemId,
				workspaceId: ctx.workspaceId,
			},
		});
	}

	async function loadConsumedMerge(mergeId: string) {
		return await ctx.prisma.captureInboxItem.findFirst({
			include: { staging: true },
			where: {
				consumedExit: "attach",
				consumedMergeId: mergeId,
				workspaceId: ctx.workspaceId,
			},
		});
	}

	return {
		async attach(input: {
			idempotencyKey: string;
			itemId: string;
			previewed: boolean;
			relation: BindRelation;
			targetId: string;
		}): Promise<AttachOutcome> {
			if (!ctx.connected()) {
				return { queued: false, reason: "offline", status: "refused" };
			}
			const payload = {
				itemId: input.itemId,
				previewed: input.previewed,
				relation: input.relation,
				targetId: input.targetId,
			};
			const existing = await readHumanReceipt(
				ctx.prisma,
				input.idempotencyKey,
				payload
			);
			if (existing?.kind === "conflict") {
				return { reason: MUTATION_COPY.conflict, status: "conflict" };
			}
			if (existing?.kind === "replay") {
				return reviveAttachOutcome(
					JSON.parse(existing.resultValue) as AttachOutcome
				);
			}
			const row = await loadOpenItem(input.itemId);
			if (!row) {
				return { status: "not-found" };
			}
			const item = ctx.toItemView(row);
			const target = ctx.binder.get(input.targetId);
			if (!target) {
				return { status: "not-found" };
			}
			const preview: AttachPreview = {
				crossProject:
					item.scope.kind === "project" &&
					item.scope.projectId.trim().toLocaleLowerCase("en-US") !==
						target.projectId.trim().toLocaleLowerCase("en-US"),
				item,
				relation: input.relation,
				target: {
					id: target.id,
					projectId: target.projectId,
					projectName: target.projectName,
					title: target.title,
				},
			};
			if (!input.previewed) {
				return {
					preview,
					status: "needs-preview",
				};
			}
			const attributed = originAttributedFields(item);
			const mergeId = crypto.randomUUID();
			const outcome: AttachOutcome = {
				bind: {
					fields: attributed,
					relation: input.relation,
					targetId: target.id,
				},
				exit: "attach",
				inboxItem: null,
				mergeId,
				status: "consumed",
			};
			const committed = await ctx.prisma.$transaction(async (tx) => {
				await lockMutation(tx, `capture-item:${item.id}`);
				const updated = await tx.captureInboxItem.updateMany({
					data: {
						consumedAt: ctx.clock.now(),
						consumedAttributedText: JSON.stringify(attributed),
						consumedExit: "attach",
						consumedMergeId: mergeId,
						consumedRelation: input.relation,
						consumedTargetId: target.id,
					},
					where: { consumedAt: null, id: item.id },
				});
				if (updated.count !== 1) {
					const receipt = await readHumanReceipt(
						tx,
						input.idempotencyKey,
						payload
					);
					if (receipt?.kind === "replay") {
						return {
							outcome: reviveAttachOutcome(
								JSON.parse(receipt.resultValue) as AttachOutcome
							),
							replayed: true,
						};
					}
					throw new Error("capture-already-consumed");
				}
				await writeDurableReceipt(tx, {
					actorId: ctx.actorId,
					commandKey: input.idempotencyKey,
					kind: "attach",
					payload,
					resultValue: JSON.stringify(outcome),
					targetId: item.id,
				});
				return { outcome, replayed: false };
			});
			if (committed.replayed) {
				return committed.outcome;
			}
			const bound = ctx.binder.bind({
				attributedFields: attributed,
				captureId: item.id,
				mergeId,
				relation: input.relation,
				targetId: target.id,
			});
			if (!bound) {
				await ctx.prisma.$transaction(async (tx) => {
					await lockMutation(tx, `capture-item:${item.id}`);
					await tx.captureInboxItem.updateMany({
						data: {
							consumedAt: null,
							consumedAttributedText: "{}",
							consumedExit: null,
							consumedMergeId: null,
							consumedRelation: null,
							consumedTargetId: null,
						},
						where: { consumedMergeId: mergeId, id: item.id },
					});
					await tx.mutationReceipt.deleteMany({
						where: { commandKey: input.idempotencyKey },
					});
				});
				return { status: "not-found" };
			}
			return outcome;
		},
		async convert(input: {
			idempotencyKey: string;
			itemId: string;
			previewed: boolean;
			targetKind: ConvertTargetKind;
		}): Promise<ConvertOutcome> {
			if (!ctx.connected()) {
				return { queued: false, reason: "offline", status: "refused" };
			}
			const payload = {
				itemId: input.itemId,
				previewed: input.previewed,
				targetKind: input.targetKind,
			};
			const existing = await readHumanReceipt(
				ctx.prisma,
				input.idempotencyKey,
				payload
			);
			if (existing?.kind === "conflict") {
				return { reason: MUTATION_COPY.conflict, status: "conflict" };
			}
			if (existing?.kind === "replay") {
				return reviveConvertOutcome(
					JSON.parse(existing.resultValue) as ConvertOutcome
				);
			}
			const row = await loadOpenItem(input.itemId);
			if (!row) {
				return { status: "not-found" };
			}
			const item = ctx.toItemView(row);
			const preview = buildConvertPreview(item, input.targetKind);
			if (!input.previewed) {
				return {
					preview,
					status: "needs-preview",
				};
			}
			// Promotion is an external boundary and is deliberately completed
			// before the Inbox commit. The adapter's idempotency key makes a
			// retry safe; an adapter failure never produces a consumed outcome.
			const created = await promoteThenCreateRecord(ctx, {
				idempotencyKey: input.idempotencyKey,
				item,
				targetKind: input.targetKind,
				targetScope: preview.proposed.targetScope,
			});
			if (created.status === "failed") {
				return created.outcome;
			}
			const outcome: ConvertOutcome = {
				exit: "convert",
				inboxItem: null,
				mainRecord: null,
				recordCreate: created.recordCreate,
				status: "consumed",
				visibleAttachment: null,
			};
			await ctx.prisma.$transaction(async (tx) => {
				await lockMutation(tx, `capture-item:${item.id}`);
				const updated = await tx.captureInboxItem.updateMany({
					data: {
						consumedAt: ctx.clock.now(),
						consumedExit: "convert",
						consumedTargetKind: input.targetKind,
					},
					where: { consumedAt: null, id: item.id },
				});
				if (updated.count !== 1) {
					throw new Error("capture-already-consumed");
				}
				await writeDurableReceipt(tx, {
					actorId: ctx.actorId,
					commandKey: input.idempotencyKey,
					kind: "convert",
					payload,
					resultValue: JSON.stringify(outcome),
					targetId: item.id,
				});
			});
			await ctx.deleteStaging(item.id);
			return outcome;
		},
		async deleteItem(input: {
			idempotencyKey: string;
			itemId: string;
		}): Promise<DeleteOutcome> {
			if (!ctx.connected()) {
				return { queued: false, reason: "offline", status: "refused" };
			}
			const payload = { itemId: input.itemId };
			const existing = await readHumanReceipt(
				ctx.prisma,
				input.idempotencyKey,
				payload
			);
			if (existing?.kind === "conflict") {
				return { reason: MUTATION_COPY.conflict, status: "conflict" };
			}
			if (existing?.kind === "replay") {
				return JSON.parse(existing.resultValue) as DeleteOutcome;
			}
			const row = await loadOpenItem(input.itemId);
			if (!row) {
				return { status: "not-found" };
			}
			const outcome: DeleteOutcome = {
				exit: "delete",
				inboxItem: null,
				status: "consumed",
			};
			await ctx.prisma.$transaction(async (tx) => {
				await lockMutation(tx, `capture-item:${row.id}`);
				await tx.captureInboxItem.update({
					data: {
						consumedAt: ctx.clock.now(),
						consumedExit: "delete",
						stagingCleanupAt: ctx.clock.now(),
						stagingCleanupError: null,
						stagingCleanupStatus: "pending",
					},
					where: { id: row.id },
				});
				await writeDurableReceipt(tx, {
					actorId: ctx.actorId,
					commandKey: input.idempotencyKey,
					kind: "delete",
					payload,
					resultValue: JSON.stringify(outcome),
					targetId: row.id,
				});
			});
			await ctx.deleteStaging(row.id);
			await ctx.prisma.captureInboxItem.delete({ where: { id: row.id } });
			return outcome;
		},
		async previewAttach(input: {
			itemId: string;
			relation: BindRelation;
			targetId: string;
		}): Promise<AttachPreview | { status: "not-found" }> {
			const row = await loadOpenItem(input.itemId);
			if (!row) {
				return { status: "not-found" };
			}
			const item = ctx.toItemView(row);
			const target = ctx.binder.get(input.targetId);
			if (!target) {
				return { status: "not-found" };
			}
			const sameProject =
				item.scope.kind === "project" &&
				item.scope.projectId.trim().toLocaleLowerCase("en-US") ===
					target.projectId.trim().toLocaleLowerCase("en-US");
			return {
				crossProject: !sameProject,
				item,
				relation: input.relation,
				target: {
					id: target.id,
					projectId: target.projectId,
					projectName: target.projectName,
					title: target.title,
				},
			};
		},
		async previewConvert(input: {
			itemId: string;
			targetKind: ConvertTargetKind;
		}): Promise<ConvertPreview | { status: "not-found" }> {
			const row = await loadOpenItem(input.itemId);
			if (!row) {
				return { status: "not-found" };
			}
			return buildConvertPreview(ctx.toItemView(row), input.targetKind);
		},
		async previewUndoMerge(input: {
			mergeId: string;
		}): Promise<MergeUndoPreview | { status: "not-found" }> {
			const row = await loadConsumedMerge(input.mergeId);
			if (!(row?.consumedTargetId && row.consumedRelation)) {
				return { status: "not-found" };
			}
			const relation = bindRelationSchema.safeParse(row.consumedRelation);
			if (!relation.success) {
				return { status: "not-found" };
			}
			return {
				bindsToRemove: [
					{
						fields: parseStringRecord(row.consumedAttributedText),
						relation: relation.data,
						targetId: row.consumedTargetId,
					},
				],
				mergeId: input.mergeId,
				restoredItem: ctx.toItemView(row),
			};
		},
		async suggestSimilar(input: {
			itemId: string;
		}): Promise<SimilarSuggestions | { status: "not-found" }> {
			const row = await loadOpenItem(input.itemId);
			if (!row) {
				return { status: "not-found" };
			}
			const item = ctx.toItemView(row);
			return groupSimilarSuggestions(item, ctx.similarRecords(item));
		},
		triageExits(): readonly TriageExit[] {
			return TRIAGE_EXITS;
		},
		async undoMerge(input: {
			idempotencyKey: string;
			mergeId: string;
		}): Promise<UndoMergeOutcome> {
			if (!ctx.connected()) {
				return { queued: false, reason: "offline", status: "refused" };
			}
			const payload = { mergeId: input.mergeId };
			const existing = await readHumanReceipt(
				ctx.prisma,
				input.idempotencyKey,
				payload
			);
			if (existing?.kind === "conflict") {
				return { reason: MUTATION_COPY.conflict, status: "conflict" };
			}
			if (existing?.kind === "replay") {
				return reviveUndoOutcome(
					JSON.parse(existing.resultValue) as UndoMergeOutcome
				);
			}
			const row = await loadConsumedMerge(input.mergeId);
			if (!row) {
				return { status: "not-found" };
			}
			ctx.binder.unbind(input.mergeId);
			const restored = await ctx.prisma.$transaction(async (tx) => {
				await lockMutation(tx, `capture-item:${row.id}`);
				const restoredRow = await tx.captureInboxItem.update({
					data: {
						consumedAt: null,
						consumedAttributedText: "{}",
						consumedExit: null,
						consumedMergeId: null,
						consumedRelation: null,
						consumedTargetId: null,
					},
					where: { id: row.id },
				});
				const inboxItem = ctx.toItemView(restoredRow);
				const outcome: UndoMergeOutcome = {
					inboxItem,
					status: "restored",
				};
				await writeDurableReceipt(tx, {
					actorId: ctx.actorId,
					commandKey: input.idempotencyKey,
					kind: "undo-merge",
					payload,
					resultValue: JSON.stringify(outcome),
					targetId: row.id,
				});
				return restoredRow;
			});
			const inboxItem = ctx.toItemView(restored);
			const outcome: UndoMergeOutcome = {
				inboxItem,
				status: "restored",
			};
			return outcome;
		},
	};
}
