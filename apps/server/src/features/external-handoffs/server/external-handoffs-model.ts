import { z } from "zod";

import { HUMAN_ORIGIN } from "../../mutation-core/server/mutation-shared";

export const EXTERNAL_HANDOFFS_COPY = {
	canceled: "Canceled",
	cancelHandoff: "Cancel Handoff",
	constraints: "Constraints",
	executor: "Executor",
	expectedOutput: "Expected output",
	externalExecutionHandoff: "External Execution Handoff",
	github: "GitHub",
	handoff: "Handoff",
	open: "Open",
	producedAt: "Produced at",
	purpose: "Purpose",
	reason: "Reason",
	reconciled: "Reconciled",
	resultReturned: "Result returned",
	selectedVersions: "Selected versions",
	sourceOfTruth: "Source of truth is in the app",
	startHandoff: "Start Handoff",
} as const;

export const HANDOFF_STATUS = {
	canceled: EXTERNAL_HANDOFFS_COPY.canceled,
	open: EXTERNAL_HANDOFFS_COPY.open,
	reconciled: EXTERNAL_HANDOFFS_COPY.reconciled,
	resultReturned: EXTERNAL_HANDOFFS_COPY.resultReturned,
} as const;

export type HandoffStatus =
	(typeof HANDOFF_STATUS)[keyof typeof HANDOFF_STATUS];

export function handoffStatusCatalog(): ReadonlyArray<{
	status: HandoffStatus;
	terminal: boolean;
}> {
	return [
		{ status: HANDOFF_STATUS.open, terminal: false },
		{ status: HANDOFF_STATUS.resultReturned, terminal: false },
		{ status: HANDOFF_STATUS.reconciled, terminal: true },
		{ status: HANDOFF_STATUS.canceled, terminal: true },
	];
}

export function isHandoffStatus(value: string): value is HandoffStatus {
	return (Object.values(HANDOFF_STATUS) as string[]).includes(value);
}

export function isTerminalHandoffStatus(status: string): boolean {
	return handoffStatusCatalog().some(
		(entry) => entry.status === status && entry.terminal
	);
}

export const HANDOFF_SEPARATIONS = {
	externalHumanAssignment: false,
	officialTestHistory: false,
	productGapEscape: false,
	publishArtifact: false,
	testHandoffPackage: false,
	testSession: false,
} as const;

export const NON_CLOSING_HANDOFF_EVENTS = [
	"github-commit-bound",
	"github-pull-request-bound",
	"external-result-arrived",
] as const;

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

export const cancelHandoffPayloadSchema = z.object({
	handoffId: z.string().min(1),
	reason: z.string(),
});

export type CancelHandoffPayload = z.infer<typeof cancelHandoffPayloadSchema>;

export const cancelHandoffCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal(HUMAN_ORIGIN),
	payload: cancelHandoffPayloadSchema,
});

export type CancelHandoffCommand = z.infer<typeof cancelHandoffCommandSchema>;

export const nonClosingHandoffEventSchema = z.object({
	event: z.enum(NON_CLOSING_HANDOFF_EVENTS),
	handoffId: z.string().min(1),
	identifier: z.string().optional(),
});

export type NonClosingHandoffEvent = z.infer<
	typeof nonClosingHandoffEventSchema
>;

export const goingPackageSchema = z.object({
	liveSync: z.literal(false),
	markdown: z.string(),
	producedAt: z.string(),
	publishArtifact: z.literal(false),
	repositoryCopy: z.literal(false),
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

export const handoffSeparationsSchema = z.object({
	externalHumanAssignment: z.literal(false),
	officialTestHistory: z.literal(false),
	productGapEscape: z.literal(false),
	publishArtifact: z.literal(false),
	testHandoffPackage: z.literal(false),
	testSession: z.literal(false),
});

export const handoffStatusSchema = z.enum([
	HANDOFF_STATUS.open,
	HANDOFF_STATUS.resultReturned,
	HANDOFF_STATUS.reconciled,
	HANDOFF_STATUS.canceled,
]);

export const externalExecutionHandoffViewSchema = z.object({
	cancelReason: z.string().nullable(),
	constraints: z.string(),
	copy: z.object({
		canceled: z.literal(EXTERNAL_HANDOFFS_COPY.canceled),
		cancelHandoff: z.literal(EXTERNAL_HANDOFFS_COPY.cancelHandoff),
		externalExecutionHandoff: z.literal(
			EXTERNAL_HANDOFFS_COPY.externalExecutionHandoff
		),
		open: z.literal(EXTERNAL_HANDOFFS_COPY.open),
		reconciled: z.literal(EXTERNAL_HANDOFFS_COPY.reconciled),
		resultReturned: z.literal(EXTERNAL_HANDOFFS_COPY.resultReturned),
		sourceOfTruth: z.literal(EXTERNAL_HANDOFFS_COPY.sourceOfTruth),
		startHandoff: z.literal(EXTERNAL_HANDOFFS_COPY.startHandoff),
	}),
	executorVisibleName: z.string(),
	expectedOutput: z.string(),
	goingPackage: goingPackageSchema,
	id: z.string().min(1),
	identity: handoffIdentitySchema,
	permittedGithubContext: z.array(githubContextSchema),
	purpose: z.string(),
	runner: runnerEffectsSchema,
	selectedVersions: z.array(selectedVersionSchema),
	separations: handoffSeparationsSchema,
	status: handoffStatusSchema,
	terminal: z.boolean(),
	workId: z.string().min(1),
	workKey: z.string().min(1),
});

export type ExternalExecutionHandoffView = z.infer<
	typeof externalExecutionHandoffViewSchema
>;

export type StartHandoffOutcome =
	| { handoff: ExternalExecutionHandoffView; status: "committed" }
	| { handoff: ExternalExecutionHandoffView; status: "replayed" }
	| { conflict: string; status: "conflict" }
	| { reason: string; status: "rejected" };

export type CancelHandoffOutcome = StartHandoffOutcome;

export type NonClosingHandoffEventOutcome =
	| {
			handoff: ExternalExecutionHandoffView;
			reason: "not-a-terminal-event";
			status: "ignored";
	  }
	| { reason: string; status: "rejected" };
