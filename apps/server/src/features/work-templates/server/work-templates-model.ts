import { z } from "zod";

import {
	CALENDAR_DATE_PATTERN,
	customFieldStoredValueSchema,
} from "../../custom-fields/server/custom-fields-model";
import {
	lightChecklistItemSchema,
	WORK_TYPES,
	type WorkView,
	workViewSchema,
} from "../../work-lifecycle/server/work-lifecycle-model";

export const WORK_TEMPLATE_COPY = {
	addChecklistItem: "Add checklist item",
	addWorkTemplate: "Add Work Template",
	checklist: "Checklist",
	createDay: "Create day",
	createFromTemplate: "Create from template",
	daysFromCreate: "Days from create",
	description: "Description",
	documentPlaceholderRefused:
		"Work Template cannot carry Document placeholder syntax.",
	duplicateWork: "Duplicate Work",
	fieldsToCopy: "Fields to copy",
	forbiddenPayload:
		"A Work Template cannot carry history, relations, close outcome, current status, or absolute dates.",
	moveToTrash: "Move to Trash",
	name: "Name",
	nameRequired: "Name is required.",
	plannedStart: "Planned start",
	previewDates: "Preview dates",
	previewRequired: "Review the fields to copy before duplicating.",
	relativeDateUnresolved: "Relative dates could not be resolved.",
	save: "Save",
	targetDate: "Target date",
	title: "Title",
	trashedNotEffective: "A trashed Work Template is not effective.",
	type: "Type",
	unknownWorkType: "Unknown Work type.",
	workTemplate: "Work Template",
} as const;

export const relativeDateRuleSchema = z.object({
	offsetDays: z.number().int(),
});

export type RelativeDateRule = z.infer<typeof relativeDateRuleSchema>;

export const workTemplateChecklistItemSchema = z.object({
	id: z.string().min(1),
	title: z.string().min(1),
});

export type WorkTemplateChecklistItem = z.infer<
	typeof workTemplateChecklistItemSchema
>;

export const selectedFieldDefaultSchema = z.object({
	definitionId: z.string().min(1),
	value: customFieldStoredValueSchema,
});

export type SelectedFieldDefaultInput = z.infer<
	typeof selectedFieldDefaultSchema
>;

export const selectedFieldDefaultViewSchema = z.object({
	definitionId: z.string().min(1),
	name: z.string().min(1),
	type: z.string().min(1),
	value: customFieldStoredValueSchema,
});

export type SelectedFieldDefaultView = z.infer<
	typeof selectedFieldDefaultViewSchema
>;

export const createWorkTemplatePayloadSchema = z
	.object({
		descriptionSkeleton: z.string().optional(),
		lightChecklist: z.array(workTemplateChecklistItemSchema).optional(),
		name: z.string().optional(),
		plannedStartRule: relativeDateRuleSchema.nullable().optional(),
		projectId: z.string().min(1),
		selectedFieldDefaults: z.array(selectedFieldDefaultSchema).optional(),
		targetDateRule: relativeDateRuleSchema.nullable().optional(),
		workType: z.string().optional(),
	})
	.passthrough();

export type CreateWorkTemplatePayload = z.infer<
	typeof createWorkTemplatePayloadSchema
>;

export const createWorkTemplateCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: createWorkTemplatePayloadSchema,
});

export type CreateWorkTemplateCommand = z.infer<
	typeof createWorkTemplateCommandSchema
>;

export const updateWorkTemplatePayloadSchema =
	createWorkTemplatePayloadSchema.extend({
		templateId: z.string().min(1),
	});

export type UpdateWorkTemplatePayload = z.infer<
	typeof updateWorkTemplatePayloadSchema
>;

export const updateWorkTemplateCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: updateWorkTemplatePayloadSchema,
});

export type UpdateWorkTemplateCommand = z.infer<
	typeof updateWorkTemplateCommandSchema
>;

export const trashWorkTemplatePayloadSchema = z.object({
	templateId: z.string().min(1),
});

export const trashWorkTemplateCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: trashWorkTemplatePayloadSchema,
});

export type TrashWorkTemplateCommand = z.infer<
	typeof trashWorkTemplateCommandSchema
>;

export const instantiateWorkFromTemplatePayloadSchema = z
	.object({
		createDay: z.string().optional(),
		templateId: z.string().min(1),
		title: z.string().optional(),
	})
	.passthrough();

export type InstantiateWorkFromTemplatePayload = z.infer<
	typeof instantiateWorkFromTemplatePayloadSchema
>;

export const instantiateWorkFromTemplateCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: instantiateWorkFromTemplatePayloadSchema,
});

export type InstantiateWorkFromTemplateCommand = z.infer<
	typeof instantiateWorkFromTemplateCommandSchema
>;

export const workTemplateViewSchema = z.object({
	descriptionSkeleton: z.string().nullable(),
	id: z.string().min(1),
	lightChecklist: z.array(workTemplateChecklistItemSchema),
	name: z.string().min(1),
	plannedStartRule: relativeDateRuleSchema.nullable(),
	projectId: z.string().min(1),
	revision: z.number().int().positive(),
	selectedFieldDefaults: z.array(selectedFieldDefaultViewSchema),
	targetDateRule: relativeDateRuleSchema.nullable(),
	workType: z.string().min(1),
});

export type WorkTemplateView = z.infer<typeof workTemplateViewSchema>;

export const relativeDatePreviewSchema = z.object({
	createDay: z.string().regex(CALENDAR_DATE_PATTERN),
	plannedStart: z.string().regex(CALENDAR_DATE_PATTERN).nullable(),
	targetDate: z.string().regex(CALENDAR_DATE_PATTERN).nullable(),
});

export type RelativeDatePreview = z.infer<typeof relativeDatePreviewSchema>;

export const previewRelativeDatesInputSchema = z.object({
	createDay: z.string().min(1),
	plannedStartRule: relativeDateRuleSchema.nullable().optional(),
	targetDateRule: relativeDateRuleSchema.nullable().optional(),
	templateId: z.string().min(1).optional(),
});

export type PreviewRelativeDatesInput = z.infer<
	typeof previewRelativeDatesInputSchema
>;

export const duplicateWorkPreviewFieldSchema = z.object({
	definitionId: z.string().min(1),
	name: z.string().min(1),
	type: z.string().min(1),
	value: customFieldStoredValueSchema,
});

export const duplicateWorkPreviewSchema = z.object({
	becomesTemplate: z.literal(false),
	copy: z.object({
		checklist: z.literal(WORK_TEMPLATE_COPY.checklist),
		description: z.literal(WORK_TEMPLATE_COPY.description),
		duplicateWork: z.literal(WORK_TEMPLATE_COPY.duplicateWork),
		fieldsToCopy: z.literal(WORK_TEMPLATE_COPY.fieldsToCopy),
		title: z.literal(WORK_TEMPLATE_COPY.title),
		type: z.literal(WORK_TEMPLATE_COPY.type),
	}),
	copyableFields: z.object({
		customFields: z.array(duplicateWorkPreviewFieldSchema),
		description: z.string().nullable(),
		lightChecklist: z.array(lightChecklistItemSchema),
		title: z.string().min(1),
		type: z.string().min(1),
	}),
	excluded: z.object({
		absoluteDates: z.literal(true),
		closeOutcome: z.literal(true),
		currentStatus: z.literal(true),
		history: z.literal(true),
		planningMemberships: z.literal(true),
		relations: z.literal(true),
	}),
	projectId: z.string().min(1),
	source: z.object({
		closureResult: z.string().nullable(),
		id: z.string().min(1),
		key: z.string().min(1),
		status: z.string().min(1),
	}),
});

export type DuplicateWorkPreview = z.infer<typeof duplicateWorkPreviewSchema>;

export const previewDuplicateWorkInputSchema = z.object({
	workId: z.string().min(1),
});

export const duplicateWorkPayloadSchema = z
	.object({
		previewAcknowledged: z.boolean().optional(),
		workId: z.string().min(1),
	})
	.passthrough();

export type DuplicateWorkPayload = z.infer<typeof duplicateWorkPayloadSchema>;

export const duplicateWorkCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: duplicateWorkPayloadSchema,
});

export type DuplicateWorkCommand = z.infer<typeof duplicateWorkCommandSchema>;

export const WORK_TEMPLATE_REJECTION_REASONS = [
	"absolute-date",
	"date-field-default",
	"document-placeholder",
	"forbidden-payload",
	"missing-idempotency-key",
	"missing-name",
	"preview-required",
	"relative-date-unresolved",
	"target-not-found",
	"trashed-not-effective",
	"unbound-field",
	"unknown-work-type",
	"value-type-mismatch",
] as const;

export type WorkTemplateRejectionReason =
	(typeof WORK_TEMPLATE_REJECTION_REASONS)[number];

export const instantiatedWorkViewSchema = z.object({
	selectedFieldDefaults: z.array(selectedFieldDefaultViewSchema),
	work: workViewSchema,
});

export type InstantiatedWorkView = z.infer<typeof instantiatedWorkViewSchema>;

export type WorkTemplateOutcome =
	| { status: "committed"; template: WorkTemplateView }
	| { status: "replayed"; template: WorkTemplateView }
	| { conflict: string; status: "conflict" }
	| { reason: WorkTemplateRejectionReason; status: "rejected" };

export type InstantiateWorkOutcome =
	| {
			selectedFieldDefaults: SelectedFieldDefaultView[];
			status: "committed";
			work: WorkView;
	  }
	| {
			selectedFieldDefaults: SelectedFieldDefaultView[];
			status: "replayed";
			work: WorkView;
	  }
	| { conflict: string; status: "conflict" }
	| { reason: WorkTemplateRejectionReason; status: "rejected" };

export type RelativeDatePreviewOutcome =
	| { preview: RelativeDatePreview; status: "ok" }
	| { reason: WorkTemplateRejectionReason; status: "rejected" };

export type DuplicateWorkPreviewOutcome =
	| { preview: DuplicateWorkPreview; status: "ok" }
	| { reason: WorkTemplateRejectionReason; status: "rejected" };

export type DuplicateWorkOutcome =
	| {
			status: "committed";
			templateCreated: false;
			work: WorkView;
	  }
	| {
			status: "replayed";
			templateCreated: false;
			work: WorkView;
	  }
	| { conflict: string; status: "conflict" }
	| { reason: WorkTemplateRejectionReason; status: "rejected" };

export const FORBIDDEN_DUPLICATE_PAYLOAD_KEYS = [
	"absoluteDates",
	"closeOutcome",
	"closureResult",
	"currentStatus",
	"due",
	"history",
	"plannedStart",
	"planningMemberships",
	"relations",
	"status",
	"targetDate",
	"workingHistory",
] as const;

export const FORBIDDEN_TEMPLATE_PAYLOAD_KEYS = [
	"absoluteDates",
	"closeOutcome",
	"closureResult",
	"currentStatus",
	"due",
	"history",
	"plannedStart",
	"relations",
	"status",
	"targetDate",
	"workingHistory",
] as const;

export function workTemplatesCatalog() {
	return {
		copy: WORK_TEMPLATE_COPY,
		workTypes: WORK_TYPES,
	} as const;
}

export function isWorkType(
	value: string
): value is (typeof WORK_TYPES)[number] {
	return (WORK_TYPES as readonly string[]).includes(value);
}

export function padCalendarPart(value: number): string {
	return String(value).padStart(2, "0");
}

export function resolveRelativeDate(
	createDay: string,
	rule: RelativeDateRule | null | undefined
): { date: string | null; status: "ok" } | { status: "unresolved" } {
	if (!rule) {
		return { date: null, status: "ok" };
	}
	if (!Number.isInteger(rule.offsetDays)) {
		return { status: "unresolved" };
	}
	if (!CALENDAR_DATE_PATTERN.test(createDay)) {
		return { status: "unresolved" };
	}
	const year = Number(createDay.slice(0, 4));
	const month = Number(createDay.slice(5, 7));
	const day = Number(createDay.slice(8, 10));
	const start = new Date(Date.UTC(year, month - 1, day));
	if (
		start.getUTCFullYear() !== year ||
		start.getUTCMonth() !== month - 1 ||
		start.getUTCDate() !== day
	) {
		return { status: "unresolved" };
	}
	start.setUTCDate(start.getUTCDate() + rule.offsetDays);
	return {
		date: `${start.getUTCFullYear()}-${padCalendarPart(start.getUTCMonth() + 1)}-${padCalendarPart(start.getUTCDate())}`,
		status: "ok",
	};
}

export function previewRelativeDateRules(input: {
	createDay: string;
	plannedStartRule?: RelativeDateRule | null;
	targetDateRule?: RelativeDateRule | null;
}): RelativeDatePreviewOutcome {
	const planned = resolveRelativeDate(input.createDay, input.plannedStartRule);
	const target = resolveRelativeDate(input.createDay, input.targetDateRule);
	if (planned.status === "unresolved" || target.status === "unresolved") {
		return { reason: "relative-date-unresolved", status: "rejected" };
	}
	return {
		preview: {
			createDay: input.createDay,
			plannedStart: planned.date,
			targetDate: target.date,
		},
		status: "ok",
	};
}
