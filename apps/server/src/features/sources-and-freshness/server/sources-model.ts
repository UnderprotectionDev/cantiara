import { z } from "zod";

export const SOURCES_COPY = {
	accessedAt: "Accessed at",
	address: "Address",
	approvedVersion: "Approved version",
	capturedContent: "Captured content",
	createSource: "Create Source",
	excerpt: "Excerpt",
	externalId: "External id",
	externalRecordType: "External record type",
	noSources: "No Sources yet.",
	provider: "Provider",
	saveAsNewSourceVersion: "Save as new Source version",
	source: "Source",
	title: "Title",
	versions: "Versions",
} as const;

export const SOURCE_PROVIDER = {
	github: "GitHub",
	youtube: "YouTube",
} as const;

export const SOURCE_EXTERNAL_RECORD_TYPE = {
	issue: "Issue",
	pullRequest: "Pull request",
	repository: "Repository",
	video: "Video",
} as const;

export const sourceVersionViewSchema = z.object({
	accessedAt: z.string(),
	capturedContent: z.string(),
	excerpt: z.string(),
	externalId: z.string().nullable(),
	externalRecordType: z.string().nullable(),
	id: z.string().min(1),
	provider: z.string().nullable(),
	title: z.string(),
	url: z.string(),
	versionNumber: z.number().int().positive(),
});

export type SourceVersionView = z.infer<typeof sourceVersionViewSchema>;

export const sourceViewSchema = z.object({
	accessedAt: z.string(),
	approvedVersionNumber: z.number().int().positive(),
	capturedContent: z.string(),
	excerpt: z.string(),
	externalId: z.string().nullable(),
	externalRecordType: z.string().nullable(),
	id: z.string().min(1),
	projectId: z.string().min(1),
	provider: z.string().nullable(),
	recordKind: z.literal(SOURCES_COPY.source),
	revision: z.number().int().positive(),
	title: z.string(),
	url: z.string(),
	versions: z.array(sourceVersionViewSchema),
});

export type SourceView = z.infer<typeof sourceViewSchema>;

const optionalOriginField = z.string().trim().min(1).optional();

export const createSourcePayloadSchema = z.object({
	accessedAt: z.string().optional(),
	capturedContent: z.string(),
	excerpt: z.string().optional(),
	externalId: optionalOriginField,
	externalRecordType: optionalOriginField,
	projectId: z.string().min(1),
	provider: optionalOriginField,
	title: z.string().min(1),
	url: z.string().trim().min(1),
});

export type CreateSourcePayload = z.infer<typeof createSourcePayloadSchema>;

export const createSourceCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: createSourcePayloadSchema,
});

export type CreateSourceCommand = z.infer<typeof createSourceCommandSchema>;

export const saveSourceVersionPayloadSchema = z.object({
	accessedAt: z.string().optional(),
	capturedContent: z.string(),
	excerpt: z.string().optional(),
	externalId: optionalOriginField,
	externalRecordType: optionalOriginField,
	provider: optionalOriginField,
	sourceId: z.string().min(1),
	title: z.string().min(1),
	url: z.string().trim().min(1),
});

export const saveSourceVersionCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: saveSourceVersionPayloadSchema,
});

export type SaveSourceVersionCommand = z.infer<
	typeof saveSourceVersionCommandSchema
>;

export const sourceWriteOutcomeSchema = z.discriminatedUnion("status", [
	z.object({
		source: sourceViewSchema,
		status: z.literal("committed"),
	}),
	z.object({
		source: sourceViewSchema,
		status: z.literal("replayed"),
	}),
	z.object({
		conflict: z.literal("Conflict"),
		status: z.literal("conflict"),
	}),
	z.object({
		reason: z.enum([
			"invalid-command",
			"source-not-found",
			"project-not-found",
		]),
		status: z.literal("rejected"),
	}),
]);

export type SourceWriteOutcome = z.infer<typeof sourceWriteOutcomeSchema>;
