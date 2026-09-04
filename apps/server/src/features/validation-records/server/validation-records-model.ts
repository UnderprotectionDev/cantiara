import { z } from "zod";

export const VALIDATION_RECORDS_COPY = {
	allValidationRecords: "All Validation Records",
	assumption: "Assumption",
	createValidationRecord: "Create Validation Record",
	decision: "Decision",
	method: "Method",
	noValidationRecords: "No Validation Records yet.",
	openQuestion: "Open Question",
	relateContext: "Relate context",
	related: "Related",
	result: "Result",
	title: "Title",
	validationRecord: "Validation Record",
} as const;

export const VALIDATION_RECORD_KIND = VALIDATION_RECORDS_COPY.validationRecord;

export const VALIDATION_RELATION_KIND = "Experiment/Validation" as const;

export const VALIDATION_CONTEXT_KINDS = [
	"Assumption",
	"Question",
	"Decision",
] as const;

export type ValidationContextKind = (typeof VALIDATION_CONTEXT_KINDS)[number];

export const VALIDATION_RECORDS_COUNTERPARTS = {
	continuousFeedbackLoop: false,
	feedback: false,
	plannedTestCase: false,
	releaseGate: false,
	researchSession: false,
	sessionTest: false,
	survey: false,
	testGap: false,
	testReportAcceptance: false,
	testSession: false,
	timedVoting: false,
	writesAssumptionLife: false,
	writesDecisionLife: false,
} as const;

export const VALIDATION_FOREIGN_RECORD_KINDS = [
	"Planned Test Case",
	"Test Session",
	"Session Test",
	"Test Gap",
	"Research Session",
	"User Research Session",
	"Feedback",
] as const;

export const validationContextRefSchema = z.object({
	id: z.string().min(1),
	kind: z.enum(VALIDATION_CONTEXT_KINDS),
	title: z.string(),
});

export type ValidationContextRef = z.infer<typeof validationContextRefSchema>;

export const validationRecordViewSchema = z.object({
	id: z.string().min(1),
	method: z.string(),
	projectId: z.string().min(1),
	recordKind: z.literal(VALIDATION_RECORD_KIND),
	relatedContext: z.array(validationContextRefSchema),
	result: z.string(),
	revision: z.number().int().positive(),
	title: z.string(),
});

export type ValidationRecordView = z.infer<typeof validationRecordViewSchema>;

export const createValidationRecordPayloadSchema = z
	.object({
		method: z.string(),
		projectId: z.string().min(1),
		result: z.string(),
		title: z.string(),
	})
	.strict();

export type CreateValidationRecordPayload = z.infer<
	typeof createValidationRecordPayloadSchema
>;

export const createValidationRecordCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: createValidationRecordPayloadSchema,
	viewerWorkspaceId: z.string().min(1),
});

export type CreateValidationRecordCommand = z.infer<
	typeof createValidationRecordCommandSchema
>;

export const relateValidationContextPayloadSchema = z
	.object({
		related: z.object({
			id: z.string().min(1),
			kind: z.enum(VALIDATION_CONTEXT_KINDS),
		}),
		validationRecordId: z.string().min(1),
	})
	.strict();

export const relateValidationContextCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: relateValidationContextPayloadSchema,
	viewerWorkspaceId: z.string().min(1),
});

export type RelateValidationContextCommand = z.infer<
	typeof relateValidationContextCommandSchema
>;

export const validationRecordWriteOutcomeSchema = z.discriminatedUnion(
	"status",
	[
		z.object({
			status: z.literal("committed"),
			validationRecord: validationRecordViewSchema,
		}),
		z.object({
			status: z.literal("replayed"),
			validationRecord: validationRecordViewSchema,
		}),
		z.object({
			conflict: z.literal("Conflict"),
			status: z.literal("conflict"),
		}),
		z.object({
			reason: z.enum([
				"invalid-command",
				"validation-record-not-found",
				"decision-not-found",
				"ends-not-allowed",
			]),
			status: z.literal("rejected"),
		}),
	]
);

export type ValidationRecordWriteOutcome = z.infer<
	typeof validationRecordWriteOutcomeSchema
>;

export function validationRecordsCatalog() {
	return {
		copy: VALIDATION_RECORDS_COPY,
		counterparts: VALIDATION_RECORDS_COUNTERPARTS,
		foreignRecordKinds: VALIDATION_FOREIGN_RECORD_KINDS,
		kind: VALIDATION_RECORD_KIND,
		relationKind: VALIDATION_RELATION_KIND,
	};
}
