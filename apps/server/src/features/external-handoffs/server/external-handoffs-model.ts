import { z } from "zod";

import {
	HUMAN_ORIGIN,
	MUTATION_ACTOR,
} from "../../mutation-core/server/mutation-shared";

export const EXTERNAL_HANDOFFS_COPY = {
	constraints: "Constraints",
	executor: "Executor",
	expectedOutput: "Expected output",
	externalExecutionHandoff: "External Execution Handoff",
	github: "GitHub",
	goingPackage: "Going package",
	handoff: "Handoff",
	newPackageVersion: "New package version",
	open: "Open",
	packageVersion: "Package version",
	producedAt: "Produced at",
	purpose: "Purpose",
	selectedVersions: "Selected versions",
	sourceOfTruth: "Source of truth is in the app",
	startHandoff: "Start Handoff",
} as const;

export const HANDOFF_STATUS = {
	open: EXTERNAL_HANDOFFS_COPY.open,
} as const;

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

export const externalExecutionHandoffViewSchema = z.object({
	constraints: z.string(),
	copy: z.object({
		externalExecutionHandoff: z.literal(
			EXTERNAL_HANDOFFS_COPY.externalExecutionHandoff
		),
		open: z.literal(EXTERNAL_HANDOFFS_COPY.open),
		sourceOfTruth: z.literal(EXTERNAL_HANDOFFS_COPY.sourceOfTruth),
		startHandoff: z.literal(EXTERNAL_HANDOFFS_COPY.startHandoff),
	}),
	executorVisibleName: z.string(),
	expectedOutput: z.string(),
	goingPackage: goingPackageSchema,
	goingPackageVersions: z.array(goingPackageSchema),
	id: z.string().min(1),
	identity: handoffIdentitySchema,
	permittedGithubContext: z.array(githubContextSchema),
	purpose: z.string(),
	runner: runnerEffectsSchema,
	selectedVersions: z.array(selectedVersionSchema),
	status: z.literal(HANDOFF_STATUS.open),
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
