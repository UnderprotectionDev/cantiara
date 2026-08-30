import { z } from "zod";

import { MUTATION_ACTOR } from "../../mutation-core/server/mutation-shared";
import {
	WORK_STATUS,
	WORK_STATUSES,
} from "../../work-lifecycle/server/work-lifecycle-model";

export const RECORD_ACTION_COPY = {
	addRecordAction: "Add Record Action",
	apply: "Apply",
	bulkEditNotAllowed:
		"Bulk field editing is not a named Record Action. Multi-record field updates stay Bulk Editing.",
	closeStepRequired:
		"Closed status needs the close step. Data was not written.",
	dailyFocusAdd: "Add to Daily Focus",
	dailyFocusMember: "In Daily Focus",
	dailyFocusNotMember: "Not in Daily Focus",
	dailyFocusRemove: "Remove from Daily Focus",
	explicitStartRequired: "Start the Record Action before it can apply.",
	forbiddenStep:
		"A Record Action cannot run JavaScript, HTTP, new record creation, or GitHub mutation.",
	laterWrite: "Undo stopped because a later write changed an attributed field.",
	moveToTrash: "Move to Trash",
	multiTarget:
		"A Record Action targets exactly one record. Multi-record combined buttons are not available.",
	name: "Name",
	nameRequired: "Name is required.",
	preview: "Preview",
	previewMismatch: "The previewed diff no longer matches the record.",
	recordAction: "Record Action",
	save: "Save",
	setExistingField: "Set existing field",
	setWorkStatus: "Set Work status",
	start: "Start",
	startWork: "Start Work",
	steps: "Steps",
	trashedNotEffective: "A trashed Record Action is not effective.",
	undoNotSafe: "This Record Action cannot be undone without a partial rewind.",
	unknownStep: "That step is not in the closed catalog.",
	useStartWork: "Use Start Work",
} as const;

export const RECORD_ACTION_TARGET_KIND = "Work" as const;

export const DAILY_FOCUS_MEMBERSHIP_OPERATIONS = ["add", "remove"] as const;

export type DailyFocusMembershipOperation =
	(typeof DAILY_FOCUS_MEMBERSHIP_OPERATIONS)[number];

export const EXISTING_FIELD_KEYS = ["title", "type", "description"] as const;

export type ExistingFieldKey = (typeof EXISTING_FIELD_KEYS)[number];

export const setWorkStatusStepSchema = z.object({
	kind: z.literal("setWorkStatus"),
	status: z.enum(WORK_STATUSES),
});

export const dailyFocusMembershipStepSchema = z.object({
	kind: z.literal("dailyFocusMembership"),
	operation: z.enum(DAILY_FOCUS_MEMBERSHIP_OPERATIONS),
});

export const setExistingFieldStepSchema = z.object({
	fieldKey: z.enum(EXISTING_FIELD_KEYS),
	kind: z.literal("setExistingField"),
	value: z.string(),
});

export const recordActionStepSchema = z.discriminatedUnion("kind", [
	setWorkStatusStepSchema,
	dailyFocusMembershipStepSchema,
	setExistingFieldStepSchema,
]);

export type RecordActionStep = z.infer<typeof recordActionStepSchema>;

export const RECORD_ACTION_STEP_KINDS = [
	"setWorkStatus",
	"dailyFocusMembership",
	"setExistingField",
] as const;

export type RecordActionStepKind = (typeof RECORD_ACTION_STEP_KINDS)[number];

export const FORBIDDEN_RECORD_ACTION_STEP_KINDS = [
	"javascript",
	"http",
	"createRecord",
	"githubMutation",
	"bulkEdit",
] as const;

export const START_WORK_STEPS = [
	{
		kind: "setWorkStatus",
		status: WORK_STATUS.inProgress,
	},
	{
		kind: "dailyFocusMembership",
		operation: "add",
	},
] as const satisfies readonly RecordActionStep[];

export function recordActionsCatalog() {
	return {
		copy: RECORD_ACTION_COPY,
		examples: {
			startWork: {
				name: RECORD_ACTION_COPY.startWork,
				steps: START_WORK_STEPS,
				targetKind: RECORD_ACTION_TARGET_KIND,
			},
		},
		existingFieldKeys: EXISTING_FIELD_KEYS,
		runActor: MUTATION_ACTOR.user,
		stepKinds: RECORD_ACTION_STEP_KINDS,
		targetKind: RECORD_ACTION_TARGET_KIND,
	} as const;
}

export const recordActionViewSchema = z.object({
	actor: z.literal(MUTATION_ACTOR.user),
	id: z.string().min(1),
	name: z.string().min(1),
	projectId: z.string().min(1),
	revision: z.number().int().positive(),
	steps: z.array(recordActionStepSchema).min(1),
	targetKind: z.literal(RECORD_ACTION_TARGET_KIND),
});

export type RecordActionView = z.infer<typeof recordActionViewSchema>;

export const createRecordActionPayloadSchema = z
	.object({
		name: z.string().optional(),
		projectId: z.string().min(1),
		steps: z.array(z.unknown()).optional(),
		targetKind: z.string().optional(),
		targetRecordIds: z.array(z.string().min(1)).optional(),
	})
	.passthrough();

export type CreateRecordActionPayload = z.infer<
	typeof createRecordActionPayloadSchema
>;

export const createRecordActionCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: createRecordActionPayloadSchema,
});

export type CreateRecordActionCommand = z.infer<
	typeof createRecordActionCommandSchema
>;

export const trashRecordActionPayloadSchema = z.object({
	recordActionId: z.string().min(1),
});

export const trashRecordActionCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: trashRecordActionPayloadSchema,
});

export type TrashRecordActionCommand = z.infer<
	typeof trashRecordActionCommandSchema
>;

export const resolveRecordActionInputSchema = z.object({
	recordActionId: z.string().min(1),
	targetRecordId: z.string().min(1),
	targetRecordIds: z.array(z.string().min(1)).optional(),
});

export type ResolveRecordActionInput = z.infer<
	typeof resolveRecordActionInputSchema
>;

export const resolvedRecordActionSchema = z.object({
	actor: z.literal(MUTATION_ACTOR.user),
	definition: recordActionViewSchema,
	targetKind: z.literal(RECORD_ACTION_TARGET_KIND),
	targetRecordId: z.string().min(1),
});

export type ResolvedRecordAction = z.infer<typeof resolvedRecordActionSchema>;

export const RECORD_ACTION_REJECTION_REASONS = [
	"bulk-edit-not-allowed",
	"close-step-required",
	"empty-steps",
	"explicit-start-required",
	"forbidden-step",
	"later-write",
	"missing-base-revision",
	"missing-idempotency-key",
	"missing-name",
	"multi-target",
	"preview-mismatch",
	"target-not-found",
	"trashed-not-effective",
	"undo-not-safe",
	"unknown-step",
	"unknown-target-kind",
] as const;

export type RecordActionRejectionReason =
	(typeof RECORD_ACTION_REJECTION_REASONS)[number];

export type RecordActionOutcome =
	| { action: RecordActionView; status: "committed" }
	| { action: RecordActionView; status: "replayed" }
	| { conflict: string; status: "conflict" }
	| { reason: RecordActionRejectionReason; status: "rejected" };

export type ResolveRecordActionOutcome =
	| { resolved: ResolvedRecordAction; status: "ok" }
	| { reason: RecordActionRejectionReason; status: "rejected" };

export const recordActionFieldDiffSchema = z.object({
	from: z.string().nullable(),
	id: z.string().min(1),
	label: z.string().min(1),
	to: z.string(),
});

export type RecordActionFieldDiff = z.infer<typeof recordActionFieldDiffSchema>;

export const recordActionPreviewSchema = z.object({
	actor: z.literal(MUTATION_ACTOR.user),
	baseRevision: z.number().int().nonnegative(),
	copy: z.object({
		apply: z.literal(RECORD_ACTION_COPY.apply),
		finalizing: z.literal("Finalizing"),
		preview: z.literal(RECORD_ACTION_COPY.preview),
		start: z.literal(RECORD_ACTION_COPY.start),
	}),
	fields: z.array(recordActionFieldDiffSchema),
	fingerprint: z.string().min(1),
	recordActionId: z.string().min(1),
	targetRecordId: z.string().min(1),
});

export type RecordActionPreview = z.infer<typeof recordActionPreviewSchema>;

export type PreviewRecordActionOutcome =
	| { preview: RecordActionPreview; status: "ok" }
	| { reason: RecordActionRejectionReason; status: "rejected" };

export const previewRecordActionInputSchema = z.object({
	actorId: z.string().min(1).optional(),
	recordActionId: z.string().min(1),
	targetRecordId: z.string().min(1),
	targetRecordIds: z.array(z.string().min(1)).optional(),
});

export const applyRecordActionPayloadSchema = z
	.object({
		previewAcknowledged: z.boolean().optional(),
		previewFingerprint: z.string().min(1).optional(),
		recordActionId: z.string().min(1),
		targetRecordId: z.string().min(1),
		targetRecordIds: z.array(z.string().min(1)).optional(),
	})
	.passthrough();

export const applyRecordActionCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: applyRecordActionPayloadSchema,
});

export type ApplyRecordActionCommand = z.infer<
	typeof applyRecordActionCommandSchema
>;

export const undoRecordActionPayloadSchema = z.object({
	runId: z.string().min(1),
});

export const undoRecordActionCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: undoRecordActionPayloadSchema,
});

export type UndoRecordActionCommand = z.infer<
	typeof undoRecordActionCommandSchema
>;

export const recordActionRunViewSchema = z.object({
	actor: z.literal(MUTATION_ACTOR.user),
	fields: z.array(recordActionFieldDiffSchema),
	id: z.string().min(1),
	recordActionId: z.string().min(1),
	revision: z.number().int().positive(),
	targetRecordId: z.string().min(1),
	undo: z.literal("Undo").nullable(),
});

export type RecordActionRunView = z.infer<typeof recordActionRunViewSchema>;

export const RECORD_ACTION_POST_BARRIER_UI = {
	cancelAvailable: false,
	label: "Finalizing",
} as const;

export type RecordActionPostBarrierUi = typeof RECORD_ACTION_POST_BARRIER_UI;

export type RecordActionRunOutcome =
	| {
			run: RecordActionRunView;
			status: "committed";
			ui: RecordActionPostBarrierUi;
	  }
	| {
			run: RecordActionRunView;
			status: "replayed";
			ui: RecordActionPostBarrierUi;
	  }
	| { conflict: string; status: "conflict" }
	| {
			currentValueLabel: "Current value";
			revision: number;
			status: "stale";
	  }
	| {
			explanation?: string;
			reason: RecordActionRejectionReason;
			status: "rejected";
	  };
