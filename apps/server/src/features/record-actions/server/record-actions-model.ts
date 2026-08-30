import { z } from "zod";

import { MUTATION_ACTOR } from "../../mutation-core/server/mutation-shared";
import {
	WORK_STATUS,
	WORK_STATUSES,
} from "../../work-lifecycle/server/work-lifecycle-model";

export const RECORD_ACTION_COPY = {
	addRecordAction: "Add Record Action",
	bulkEditNotAllowed:
		"Bulk field editing is not a named Record Action. Multi-record field updates stay Bulk Editing.",
	dailyFocusAdd: "Add to Daily Focus",
	dailyFocusRemove: "Remove from Daily Focus",
	forbiddenStep:
		"A Record Action cannot run JavaScript, HTTP, new record creation, or GitHub mutation.",
	moveToTrash: "Move to Trash",
	multiTarget:
		"A Record Action targets exactly one record. Multi-record combined buttons are not available.",
	name: "Name",
	nameRequired: "Name is required.",
	recordAction: "Record Action",
	save: "Save",
	setExistingField: "Set existing field",
	setWorkStatus: "Set Work status",
	startWork: "Start Work",
	steps: "Steps",
	trashedNotEffective: "A trashed Record Action is not effective.",
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
	"empty-steps",
	"forbidden-step",
	"missing-idempotency-key",
	"missing-name",
	"multi-target",
	"target-not-found",
	"trashed-not-effective",
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
