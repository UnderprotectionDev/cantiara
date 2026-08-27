import { z } from "zod";

export const USAGE_KIND = {
	flowNodeScreenReference: "flow-node-screen-reference",
	inlineRecordReference: "inline-record-reference",
	liveContentBlock: "live-content-block",
	pinnedFileOrWireframeBind: "pinned-file-or-wireframe-bind",
	stableSectionReference: "stable-section-reference",
} as const;

export const USAGE_KINDS = [
	USAGE_KIND.inlineRecordReference,
	USAGE_KIND.stableSectionReference,
	USAGE_KIND.liveContentBlock,
	USAGE_KIND.pinnedFileOrWireframeBind,
	USAGE_KIND.flowNodeScreenReference,
] as const;

export type UsageKind = (typeof USAGE_KINDS)[number];

export const RELATIONS_COPY = {
	inlineReference: "Inline reference",
	liveBlock: "Live block",
	pinnedBind: "Pinned bind",
	related: "Related",
	screenReference: "Screen reference",
	sectionReference: "Section reference",
	unlink: "Unlink",
} as const;

export const USAGE_KIND_LABEL = {
	[USAGE_KIND.flowNodeScreenReference]: RELATIONS_COPY.screenReference,
	[USAGE_KIND.inlineRecordReference]: RELATIONS_COPY.inlineReference,
	[USAGE_KIND.liveContentBlock]: RELATIONS_COPY.liveBlock,
	[USAGE_KIND.pinnedFileOrWireframeBind]: RELATIONS_COPY.pinnedBind,
	[USAGE_KIND.stableSectionReference]: RELATIONS_COPY.sectionReference,
} as const;

export const STANDARD_RELATION_TYPE = {
	related: RELATIONS_COPY.related,
} as const;

export function isUsageKind(value: string): value is UsageKind {
	return (USAGE_KINDS as readonly string[]).includes(value);
}

export function usageKindLabel(kind: UsageKind): string {
	return USAGE_KIND_LABEL[kind];
}

export const usageLinkViewSchema = z.object({
	embedId: z.string().min(1),
	hostRecordId: z.string().min(1),
	id: z.string().min(1),
	kind: z.enum(USAGE_KINDS),
	kindLabel: z.string().min(1),
	sourceRecordId: z.string().min(1),
});

export type UsageLinkView = z.infer<typeof usageLinkViewSchema>;

export const typedRelationViewSchema = z.object({
	id: z.string().min(1),
	type: z.literal(STANDARD_RELATION_TYPE.related),
});

export type TypedRelationView = z.infer<typeof typedRelationViewSchema>;

export const recordGraphViewSchema = z.object({
	copy: z.object({
		inlineReference: z.literal(RELATIONS_COPY.inlineReference),
		liveBlock: z.literal(RELATIONS_COPY.liveBlock),
		pinnedBind: z.literal(RELATIONS_COPY.pinnedBind),
		related: z.literal(RELATIONS_COPY.related),
		screenReference: z.literal(RELATIONS_COPY.screenReference),
		sectionReference: z.literal(RELATIONS_COPY.sectionReference),
		unlink: z.literal(RELATIONS_COPY.unlink),
	}),
	relationCount: z.number().int().nonnegative(),
	typedRelations: z.array(typedRelationViewSchema),
	usageLinks: z.array(usageLinkViewSchema),
});

export type RecordGraphView = z.infer<typeof recordGraphViewSchema>;

export const createUsageLinkCommandSchema = z.object({
	actorId: z.string().min(1),
	evidenceRole: z.string().min(1).optional(),
	hostRecordId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	kind: z.string().min(1),
	origin: z.literal("human"),
	sourceRecordId: z.string().min(1),
});

export type CreateUsageLinkCommand = z.infer<
	typeof createUsageLinkCommandSchema
>;

export const unlinkUsageLinkCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	usageLinkId: z.string().min(1),
});

export type UnlinkUsageLinkCommand = z.infer<
	typeof unlinkUsageLinkCommandSchema
>;

export interface RecordStatusSlice {
	id: string;
	revision: number;
	status: string;
}

export type RelationsWriteOutcome =
	| {
			embed: { id: string; hostRecordId: string; sourceRecordId: string };
			host: RecordStatusSlice;
			source: RecordStatusSlice;
			status: "committed";
			usageLink: UsageLinkView;
	  }
	| {
			embed: { id: string; hostRecordId: string; sourceRecordId: string };
			host: RecordStatusSlice;
			source: RecordStatusSlice;
			status: "replayed";
			usageLink: UsageLinkView;
	  }
	| { conflict: "Conflict"; status: "conflict" }
	| {
			reason:
				| "evidence-role-not-allowed"
				| "target-not-found"
				| "unknown-usage-kind";
			status: "rejected";
	  };

export function toUsageLinkView(input: {
	embedId: string;
	hostRecordId: string;
	id: string;
	kind: UsageKind;
	sourceRecordId: string;
}): UsageLinkView {
	return {
		embedId: input.embedId,
		hostRecordId: input.hostRecordId,
		id: input.id,
		kind: input.kind,
		kindLabel: usageKindLabel(input.kind),
		sourceRecordId: input.sourceRecordId,
	};
}

export function inspectRecordGraph(input: {
	typedRelations: readonly TypedRelationView[];
	usageLinks: readonly UsageLinkView[];
}): RecordGraphView {
	const usageLinks = input.usageLinks.filter(
		(link) => link.kindLabel !== RELATIONS_COPY.related
	);
	return {
		copy: RELATIONS_COPY,
		relationCount: input.typedRelations.length,
		typedRelations: [...input.typedRelations],
		usageLinks,
	};
}
