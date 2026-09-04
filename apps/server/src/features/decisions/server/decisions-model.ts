import { z } from "zod";

export const DECISIONS_COPY = {
	allDecisions: "All Decisions",
	createDecision: "Create Decision",
	decision: "Decision",
	decisionText: "Decision text",
	noDecisions: "No Decisions yet.",
	openCurrentDecision: "Open current decision",
	rationale: "Rationale",
	supersedeAnotherDecision: "Supersede another decision",
	superseded: "Superseded",
	supersedes: "Supersedes",
	title: "Title",
	transitionRationale: "Transition rationale",
	valid: "Valid",
	withdraw: "Withdraw",
	withdrawn: "Withdrawn",
} as const;

export const DECISION_LIFE = {
	superseded: DECISIONS_COPY.superseded,
	valid: DECISIONS_COPY.valid,
	withdrawn: DECISIONS_COPY.withdrawn,
} as const;

export const DECISION_LIVES = [
	DECISION_LIFE.valid,
	DECISION_LIFE.superseded,
	DECISION_LIFE.withdrawn,
] as const;

export type DecisionLife = (typeof DECISION_LIVES)[number];

export const DECISION_EVENT_KIND = {
	create: "create",
	removeSupersede: "remove-supersede",
	supersede: "supersede",
	withdraw: "withdraw",
} as const;

export function presentDecisionLife(
	stored: string | null | undefined
): DecisionLife {
	if (stored === DECISION_LIFE.withdrawn) {
		return DECISION_LIFE.withdrawn;
	}
	if (stored === DECISION_LIFE.superseded) {
		return DECISION_LIFE.superseded;
	}
	return DECISION_LIFE.valid;
}

export function importedDecisionLife(
	stored: string | null | undefined
): Exclude<DecisionLife, typeof DECISION_LIFE.superseded> {
	if (stored === DECISION_LIFE.withdrawn) {
		return DECISION_LIFE.withdrawn;
	}
	return DECISION_LIFE.valid;
}

export const decisionChainMemberSchema = z.object({
	id: z.string().min(1),
	life: z.enum(DECISION_LIVES),
	title: z.string(),
});

export const decisionViewSchema = z.object({
	chain: z.array(decisionChainMemberSchema),
	contentReadOnly: z.boolean(),
	currentDecision: z
		.object({
			id: z.string().min(1),
			title: z.string(),
		})
		.nullable(),
	decision: z.string(),
	id: z.string().min(1),
	life: z.enum(DECISION_LIVES),
	openCurrentDecisionId: z.string().min(1).nullable(),
	projectId: z.string().min(1),
	rationale: z.string(),
	recordKind: z.literal(DECISIONS_COPY.decision),
	revision: z.number().int().positive(),
	supersededBy: z
		.object({
			id: z.string().min(1),
			title: z.string(),
		})
		.nullable(),
	supersedes: z.array(
		z.object({
			id: z.string().min(1),
			title: z.string(),
		})
	),
	title: z.string(),
	transitionOccurredAt: z.string().nullable(),
	transitionRationale: z.string().nullable(),
	withdrawnAt: z.string().nullable(),
	withdrawnRationale: z.string().nullable(),
});

export type DecisionView = z.infer<typeof decisionViewSchema>;

export const createDecisionPayloadSchema = z.object({
	decision: z.string(),
	projectId: z.string().min(1),
	rationale: z.string(),
	title: z.string(),
});

export type CreateDecisionPayload = z.infer<typeof createDecisionPayloadSchema>;

export const createDecisionCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: createDecisionPayloadSchema,
});

export type CreateDecisionCommand = z.infer<typeof createDecisionCommandSchema>;

export const ingestImportedDecisionPayloadSchema = z.object({
	decision: z.string(),
	life: z.string().nullable().optional(),
	projectId: z.string().min(1),
	rationale: z.string(),
	title: z.string(),
});

export const ingestImportedDecisionCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: ingestImportedDecisionPayloadSchema,
});

export type IngestImportedDecisionCommand = z.infer<
	typeof ingestImportedDecisionCommandSchema
>;

export const withdrawDecisionPayloadSchema = z.object({
	decisionId: z.string().min(1),
	rationale: z.string().optional(),
});

export const withdrawDecisionCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: withdrawDecisionPayloadSchema,
});

export type WithdrawDecisionCommand = z.infer<
	typeof withdrawDecisionCommandSchema
>;

export const setDecisionLifePayloadSchema = z.object({
	decisionId: z.string().min(1),
	life: z.enum(DECISION_LIVES),
});

export const setDecisionLifeCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: setDecisionLifePayloadSchema,
});

export type SetDecisionLifeCommand = z.infer<
	typeof setDecisionLifeCommandSchema
>;

export const decisionWriteOutcomeSchema = z.discriminatedUnion("status", [
	z.object({
		decision: decisionViewSchema,
		status: z.literal("committed"),
	}),
	z.object({
		decision: decisionViewSchema,
		status: z.literal("replayed"),
	}),
	z.object({
		conflict: z.literal("Conflict"),
		status: z.literal("conflict"),
	}),
	z.object({
		reason: z.enum([
			"invalid-command",
			"decision-not-found",
			"superseded-requires-relation",
			"life-not-selectable",
			"self-link",
			"cycle",
			"conflicting-fork",
			"successor-not-valid",
			"superseded-not-valid",
			"preview-required",
		]),
		status: z.literal("rejected"),
	}),
]);

export type DecisionWriteOutcome = z.infer<typeof decisionWriteOutcomeSchema>;

export const supersedePayloadSchema = z.object({
	successorId: z.string().min(1),
	supersededIds: z.array(z.string().min(1)).min(1),
	supersededRevisions: z
		.array(
			z.object({
				id: z.string().min(1),
				revision: z.number().int().nonnegative(),
			})
		)
		.optional(),
	transitionRationale: z.string().optional(),
});

export const previewSupersessionInputSchema = z.object({
	payload: supersedePayloadSchema.omit({ supersededRevisions: true }),
});

export type PreviewSupersessionInput = z.infer<
	typeof previewSupersessionInputSchema
>;

export const supersedeDecisionsCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: supersedePayloadSchema,
});

export type SupersedeDecisionsCommand = z.infer<
	typeof supersedeDecisionsCommandSchema
>;

export const decisionPreviewSideSchema = z.object({
	decision: z.string(),
	evidenceSummary: z.array(z.string()),
	id: z.string().min(1),
	life: z.enum(DECISION_LIVES),
	nextLife: z.enum(DECISION_LIVES),
	rationale: z.string(),
	revision: z.number().int().positive(),
	title: z.string(),
});

export const lifeChangeSchema = z.object({
	from: z.enum(DECISION_LIVES),
	id: z.string().min(1),
	title: z.string(),
	to: z.enum(DECISION_LIVES),
});

export const supersessionPreviewSchema = z.object({
	livesChanging: z.array(lifeChangeSchema),
	successor: decisionPreviewSideSchema,
	superseded: z.array(decisionPreviewSideSchema),
	transitionRationale: z.string().nullable(),
});

export const previewSupersessionOutcomeSchema = z.discriminatedUnion("status", [
	z.object({
		preview: supersessionPreviewSchema,
		status: z.literal("ok"),
	}),
	z.object({
		reason: z.enum([
			"invalid-command",
			"decision-not-found",
			"self-link",
			"cycle",
			"conflicting-fork",
			"successor-not-valid",
			"superseded-not-valid",
		]),
		status: z.literal("rejected"),
	}),
]);

export type PreviewSupersessionOutcome = z.infer<
	typeof previewSupersessionOutcomeSchema
>;

export const supersedeRelationViewSchema = z.object({
	fromId: z.string().min(1),
	id: z.string().min(1),
	toId: z.string().min(1),
});

export const supersedeWriteOutcomeSchema = z.discriminatedUnion("status", [
	z.object({
		relations: z.array(supersedeRelationViewSchema),
		status: z.literal("committed"),
		successor: decisionViewSchema,
		superseded: z.array(decisionViewSchema),
		transitionRationale: z.string().nullable(),
	}),
	z.object({
		relations: z.array(supersedeRelationViewSchema),
		status: z.literal("replayed"),
		successor: decisionViewSchema,
		superseded: z.array(decisionViewSchema),
		transitionRationale: z.string().nullable(),
	}),
	z.object({
		conflict: z.literal("Conflict"),
		status: z.literal("conflict"),
	}),
	z.object({
		reason: z.enum([
			"invalid-command",
			"decision-not-found",
			"self-link",
			"cycle",
			"conflicting-fork",
			"successor-not-valid",
			"superseded-not-valid",
		]),
		status: z.literal("rejected"),
	}),
]);

export type SupersedeWriteOutcome = z.infer<typeof supersedeWriteOutcomeSchema>;

export const removeSupersessionPayloadSchema = z.object({
	confirm: z.boolean().optional(),
	successorId: z.string().min(1),
	supersededId: z.string().min(1),
});

export const previewRemoveSupersessionInputSchema = z.object({
	payload: removeSupersessionPayloadSchema.omit({ confirm: true }),
});

export const removeSupersessionCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: removeSupersessionPayloadSchema,
});

export type RemoveSupersessionCommand = z.infer<
	typeof removeSupersessionCommandSchema
>;

export const removeSupersessionPreviewSchema = z.object({
	successor: z.object({
		id: z.string().min(1),
		life: z.enum(DECISION_LIVES),
		nextLife: z.enum(DECISION_LIVES),
		title: z.string(),
	}),
	superseded: z.object({
		id: z.string().min(1),
		life: z.enum(DECISION_LIVES),
		nextLife: z.enum(DECISION_LIVES),
		title: z.string(),
	}),
	wouldRestoreValid: z.boolean(),
});

export const previewRemoveSupersessionOutcomeSchema = z.discriminatedUnion(
	"status",
	[
		z.object({
			preview: removeSupersessionPreviewSchema,
			status: z.literal("ok"),
		}),
		z.object({
			reason: z.enum(["invalid-command", "decision-not-found"]),
			status: z.literal("rejected"),
		}),
	]
);

export type PreviewRemoveSupersessionOutcome = z.infer<
	typeof previewRemoveSupersessionOutcomeSchema
>;

export const removeSupersessionWriteOutcomeSchema = z.discriminatedUnion(
	"status",
	[
		z.object({
			status: z.literal("committed"),
			successor: decisionViewSchema,
			superseded: decisionViewSchema,
		}),
		z.object({
			status: z.literal("replayed"),
			successor: decisionViewSchema,
			superseded: decisionViewSchema,
		}),
		z.object({
			conflict: z.literal("Conflict"),
			status: z.literal("conflict"),
		}),
		z.object({
			reason: z.enum([
				"invalid-command",
				"decision-not-found",
				"preview-required",
			]),
			status: z.literal("rejected"),
		}),
	]
);

export type RemoveSupersessionWriteOutcome = z.infer<
	typeof removeSupersessionWriteOutcomeSchema
>;

export const CLOSED_WORLD_ITEM_KIND = {
	decision: DECISIONS_COPY.decision,
	supersedes: DECISIONS_COPY.supersedes,
} as const;

export const closedWorldItemSchema = z.discriminatedUnion("kind", [
	z.object({
		id: z.string().min(1),
		kind: z.literal(CLOSED_WORLD_ITEM_KIND.decision),
		title: z.string(),
	}),
	z.object({
		fromId: z.string().min(1),
		id: z.string().min(1),
		kind: z.literal(CLOSED_WORLD_ITEM_KIND.supersedes),
		toId: z.string().min(1),
	}),
]);

export type ClosedWorldItem = z.infer<typeof closedWorldItemSchema>;

export const publishedSnapshotSchema = z.object({
	includedDecisionId: z.string().min(1),
	includedRevision: z.number().int().positive(),
});

export type PublishedSnapshot = z.infer<typeof publishedSnapshotSchema>;

export const resolvePublishedSnapshotOutcomeSchema = z.object({
	decisionId: z.string().min(1),
	redirected: z.literal(false),
	silentlyUpdated: z.literal(false),
});

export type ResolvePublishedSnapshotOutcome = z.infer<
	typeof resolvePublishedSnapshotOutcomeSchema
>;
