import { z } from "zod";

import {
	HUMAN_ORIGIN,
	MUTATION_ACTOR,
} from "../../mutation-core/server/mutation-shared";

export const EXTERNAL_HANDOFFS_COPY = {
	changedAssumptions: "Changed assumptions",
	confirm: "Confirm",
	constraints: "Constraints",
	executor: "Executor",
	executorSummary: "Executor summary",
	expectedOutput: "Expected output",
	externalExecutionHandoff: "External Execution Handoff",
	followUpWork: "Follow-up Work",
	github: "GitHub",
	goingPackage: "Going package",
	handoff: "Handoff",
	newPackageVersion: "New package version",
	open: "Open",
	openQuestions: "Open questions",
	packageVersion: "Package version",
	permittedExternalLinks: "Permitted external links",
	producedAt: "Produced at",
	producedEvidence: "Produced evidence",
	purpose: "Purpose",
	reconcile: "Reconcile",
	reconciled: "Reconciled",
	recordReturn: "Record return",
	reject: "Reject",
	related: "Related",
	resultReturned: "Result returned",
	selectedVersions: "Selected versions",
	sourceOfTruth: "Source of truth is in the app",
	startHandoff: "Start Handoff",
} as const;

export const HANDOFF_STATUS = {
	open: EXTERNAL_HANDOFFS_COPY.open,
	reconciled: EXTERNAL_HANDOFFS_COPY.reconciled,
	resultReturned: EXTERNAL_HANDOFFS_COPY.resultReturned,
} as const;

export const HANDOFF_STATUSES = [
	HANDOFF_STATUS.open,
	HANDOFF_STATUS.resultReturned,
	HANDOFF_STATUS.reconciled,
] as const;

export type HandoffStatus = (typeof HANDOFF_STATUSES)[number];

export const HANDOFF_HISTORY_KIND = {
	packageExported: "package-exported",
	started: "started",
} as const;

export const SELECTED_VERSION_KINDS = [
	"Work",
	"Document",
	"Decision",
	"Risk",
	"Open Question",
	"Source",
] as const;

export type SelectedVersionKind = (typeof SELECTED_VERSION_KINDS)[number];

export const selectedVersionFieldSchema = z.object({
	inaccessible: z.boolean().optional(),
	name: z.string().min(1),
	secret: z.boolean().optional(),
	value: z.string(),
});

export const selectedVersionSchema = z.object({
	body: z.string().optional(),
	fields: z.array(selectedVersionFieldSchema).optional(),
	kind: z.enum(SELECTED_VERSION_KINDS),
	recordId: z.string().min(1),
	title: z.string(),
	versionId: z.string().min(1),
});

export type SelectedVersion = z.infer<typeof selectedVersionSchema>;

export const githubContextSchema = z.object({
	identifier: z.string().min(1),
});

export type GithubContext = z.infer<typeof githubContextSchema>;

export const proposedRelationSchema = z.object({
	id: z.string().min(1),
	toId: z.string().min(1),
	toKind: z.literal("Work"),
	toTitle: z.string(),
	type: z.literal(EXTERNAL_HANDOFFS_COPY.related),
});

export type ProposedRelation = z.infer<typeof proposedRelationSchema>;

export const proposedFollowUpWorkSchema = z.object({
	id: z.string().min(1),
	title: z.string().min(1),
});

export type ProposedFollowUpWork = z.infer<typeof proposedFollowUpWorkSchema>;

export const returnRecordSchema = z.object({
	changedAssumptions: z.string(),
	executorSummary: z.string(),
	openQuestions: z.string(),
	permittedExternalLinks: z.array(githubContextSchema),
	producedEvidence: z.string(),
	proposedFollowUpWork: z.array(proposedFollowUpWorkSchema),
	proposedRelations: z.array(proposedRelationSchema),
});

export type ReturnRecord = z.infer<typeof returnRecordSchema>;

export const reconcileDecisionSchema = z.object({
	confirmedAt: z.string(),
	kind: z.literal(EXTERNAL_HANDOFFS_COPY.reconcile),
	selectedFollowUpWorkIds: z.array(z.string().min(1)),
	selectedRelationIds: z.array(z.string().min(1)),
	writtenFollowUpWorkIds: z.array(z.string().min(1)),
	writtenRelationIds: z.array(z.string().min(1)),
});

export type ReconcileDecision = z.infer<typeof reconcileDecisionSchema>;

export const startHandoffPayloadSchema = z.object({
	constraints: z.string(),
	executorVisibleName: z.string(),
	expectedOutput: z.string(),
	permittedGithubContext: z.array(githubContextSchema).optional(),
	purpose: z.string(),
	selectedVersions: z.array(selectedVersionSchema),
	workId: z.string().min(1),
});

export type StartHandoffPayload = z.infer<typeof startHandoffPayloadSchema>;

export const startHandoffCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal(HUMAN_ORIGIN),
	payload: startHandoffPayloadSchema,
});

export type StartHandoffCommand = z.infer<typeof startHandoffCommandSchema>;

export const recordReturnPayloadSchema = z.object({
	changedAssumptions: z.string(),
	executorSummary: z.string(),
	handoffId: z.string().min(1),
	openQuestions: z.string(),
	permittedExternalLinks: z.array(githubContextSchema).optional(),
	producedEvidence: z.string(),
	proposedFollowUpWork: z.array(proposedFollowUpWorkSchema).optional(),
	proposedRelations: z.array(proposedRelationSchema).optional(),
});

export type RecordReturnPayload = z.infer<typeof recordReturnPayloadSchema>;

export const recordReturnCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal(HUMAN_ORIGIN),
	payload: recordReturnPayloadSchema,
});

export type RecordReturnCommand = z.infer<typeof recordReturnCommandSchema>;

export const confirmReconcilePayloadSchema = z.object({
	handoffId: z.string().min(1),
	previewAcknowledged: z.boolean(),
	selectedFollowUpWorkIds: z.array(z.string().min(1)),
	selectedRelationIds: z.array(z.string().min(1)),
});

export type ConfirmReconcilePayload = z.infer<
	typeof confirmReconcilePayloadSchema
>;

export const confirmReconcileCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal(HUMAN_ORIGIN),
	payload: confirmReconcilePayloadSchema,
});

export type ConfirmReconcileCommand = z.infer<
	typeof confirmReconcileCommandSchema
>;

export const rejectReconcilePayloadSchema = z.object({
	handoffId: z.string().min(1),
});

export const rejectReconcileCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal(HUMAN_ORIGIN),
	payload: rejectReconcilePayloadSchema,
});

export type RejectReconcileCommand = z.infer<
	typeof rejectReconcileCommandSchema
>;

export const produceGoingPackagePayloadSchema = z.object({
	handoffId: z.string().min(1),
	permittedGithubContext: z.array(githubContextSchema).optional(),
	selectedVersions: z.array(selectedVersionSchema),
	workId: z.string().min(1),
});

export type ProduceGoingPackagePayload = z.infer<
	typeof produceGoingPackagePayloadSchema
>;

export const produceGoingPackageCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal(HUMAN_ORIGIN),
	payload: produceGoingPackagePayloadSchema,
});

export type ProduceGoingPackageCommand = z.infer<
	typeof produceGoingPackageCommandSchema
>;

export const goingPackageSchema = z.object({
	liveSync: z.literal(false),
	markdown: z.string(),
	producedAt: z.string(),
	publishArtifact: z.literal(false),
	repositoryCopy: z.literal(false),
	version: z.number().int().positive(),
});

export type GoingPackage = z.infer<typeof goingPackageSchema>;

export const handoffIdentitySchema = z.object({
	independentLifecycle: z.literal(false),
	independentMainRecord: z.literal(false),
	ownedByWorkId: z.string().min(1),
	searchableApartFromWork: z.literal(false),
	shareableApartFromWork: z.literal(false),
});

export const runnerEffectsSchema = z.object({
	ci: z.literal(false),
	externalAgent: z.literal(false),
	ide: z.literal(false),
	repository: z.literal(false),
	telemetry: z.literal(false),
	terminal: z.literal(false),
});

export const handoffCopySchema = z.object({
	confirm: z.literal(EXTERNAL_HANDOFFS_COPY.confirm),
	externalExecutionHandoff: z.literal(
		EXTERNAL_HANDOFFS_COPY.externalExecutionHandoff
	),
	followUpWork: z.literal(EXTERNAL_HANDOFFS_COPY.followUpWork),
	open: z.literal(EXTERNAL_HANDOFFS_COPY.open),
	reconcile: z.literal(EXTERNAL_HANDOFFS_COPY.reconcile),
	reconciled: z.literal(EXTERNAL_HANDOFFS_COPY.reconciled),
	recordReturn: z.literal(EXTERNAL_HANDOFFS_COPY.recordReturn),
	reject: z.literal(EXTERNAL_HANDOFFS_COPY.reject),
	resultReturned: z.literal(EXTERNAL_HANDOFFS_COPY.resultReturned),
	sourceOfTruth: z.literal(EXTERNAL_HANDOFFS_COPY.sourceOfTruth),
	startHandoff: z.literal(EXTERNAL_HANDOFFS_COPY.startHandoff),
});

export const externalExecutionHandoffViewSchema = z.object({
	constraints: z.string(),
	copy: handoffCopySchema,
	executorVisibleName: z.string(),
	expectedOutput: z.string(),
	goingPackage: goingPackageSchema,
	goingPackageVersions: z.array(goingPackageSchema),
	id: z.string().min(1),
	identity: handoffIdentitySchema,
	permittedGithubContext: z.array(githubContextSchema),
	purpose: z.string(),
	reconcileDecision: reconcileDecisionSchema.nullable(),
	returnRecord: returnRecordSchema.nullable(),
	runner: runnerEffectsSchema,
	selectedVersions: z.array(selectedVersionSchema),
	status: z.enum(HANDOFF_STATUSES),
	workId: z.string().min(1),
	workKey: z.string().min(1),
});

export type ExternalExecutionHandoffView = z.infer<
	typeof externalExecutionHandoffViewSchema
>;

export const reconcilePreviewSchema = z.object({
	copy: z.object({
		confirm: z.literal(EXTERNAL_HANDOFFS_COPY.confirm),
		followUpWork: z.literal(EXTERNAL_HANDOFFS_COPY.followUpWork),
		reconcile: z.literal(EXTERNAL_HANDOFFS_COPY.reconcile),
		reject: z.literal(EXTERNAL_HANDOFFS_COPY.reject),
		related: z.literal(EXTERNAL_HANDOFFS_COPY.related),
	}),
	followUpWork: z.array(proposedFollowUpWorkSchema),
	gitMerge: z.literal(false),
	importWizard: z.literal(false),
	relations: z.array(proposedRelationSchema),
});

export type ReconcilePreview = z.infer<typeof reconcilePreviewSchema>;

export type HandoffWriteOutcome =
	| { handoff: ExternalExecutionHandoffView; status: "committed" }
	| { handoff: ExternalExecutionHandoffView; status: "replayed" }
	| { conflict: string; status: "conflict" }
	| { reason: string; status: "rejected" };

export type StartHandoffOutcome = HandoffWriteOutcome;

export type RecordReturnOutcome = HandoffWriteOutcome;

export type ConfirmReconcileOutcome = HandoffWriteOutcome;

export type RejectReconcileOutcome = HandoffWriteOutcome;

export type PreviewReconcileOutcome =
	| { preview: ReconcilePreview; status: "ok" }
	| { reason: string; status: "rejected" };

export type ProduceGoingPackageOutcome = StartHandoffOutcome;

export const handoffHistoryCopySchema = z.object({
	goingPackage: z.literal(EXTERNAL_HANDOFFS_COPY.goingPackage),
	startHandoff: z.literal(EXTERNAL_HANDOFFS_COPY.startHandoff),
});

export const handoffHistoryEntrySchema = z.object({
	actorId: z.string().min(1),
	actorType: z.literal(MUTATION_ACTOR.user),
	copy: handoffHistoryCopySchema,
	handoffId: z.string().min(1),
	id: z.string().min(1),
	kind: z.enum([
		HANDOFF_HISTORY_KIND.packageExported,
		HANDOFF_HISTORY_KIND.started,
	]),
	occurredAt: z.string(),
	packageVersion: z.number().int().positive().nullable(),
	workId: z.string().min(1),
});

export type HandoffHistoryEntry = z.infer<typeof handoffHistoryEntrySchema>;
