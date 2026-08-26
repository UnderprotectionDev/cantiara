/**
 * Mutation Contract seam — human base revision + client idempotency key,
 * non-human verified source id + delivery id + payload fingerprint +
 * revision condition at commit, Kayıt geçmişi actors, retry, reorder,
 * concurrent write, and Güvenli geri alma. Synthetic fixture for
 * docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Mutasyon sözleşmesi) and the closed journey
 * kayıt oluşturma, düzenleme, çatışma, geri alma.
 */
import { PrismaClient } from "@cantiara/db";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
	applyMutation,
	applyUndo,
	CHANGE_KIND,
	createMutationTarget,
	MUTATION_ACTOR,
	MUTATION_COPY,
	type MutationOrigin,
	payloadFingerprint,
	readMutationFields,
	readMutationRelations,
	readMutationTarget,
	readRecordHistory,
	readRetiredInto,
} from "./mutation-contract";

const DATABASE_URL =
	process.env.DATABASE_URL ??
	"postgresql://cantiara:cantiara@127.0.0.1:5432/cantiara";

const ACTOR_ID = "founder-1";
const NON_HUMAN_CASES = [
	{
		actor: MUTATION_ACTOR.github,
		origin: "github" as const,
		source: "github:repo:42",
	},
	{
		actor: MUTATION_ACTOR.systemAutomation,
		origin: "system-automation" as const,
		source: "import:batch-1",
	},
	{
		actor: MUTATION_ACTOR.authorizedIntegration,
		origin: "authorized-integration" as const,
		source: "integration:linear",
	},
] as const;

function humanCommand(input: {
	baseRevision?: number;
	idempotencyKey?: string;
	payload?: {
		attributedFields?: Record<string, string>;
		attributedRelationToIds?: string[];
		field?: string;
		kind?: string;
		secondaryValue?: string;
		value: string;
	};
	targetId: string;
}) {
	return {
		actorId: ACTOR_ID,
		baseRevision: input.baseRevision,
		idempotencyKey: input.idempotencyKey,
		origin: "human" as const,
		payload: input.payload ?? { value: "updated" },
		targetId: input.targetId,
	};
}

function nonHumanCommand(input: {
	deliveryId: string;
	origin: (typeof NON_HUMAN_CASES)[number]["origin"];
	payload?: { value: string };
	revisionCondition?: number;
	source: string;
	targetId: string;
	withHumanBase?: boolean;
}) {
	const payload = input.payload ?? { value: "from-source" };
	const command: Record<string, unknown> = {
		actorId: input.source,
		deliveryId: input.deliveryId,
		origin: input.origin,
		payload,
		payloadFingerprint: payloadFingerprint(payload),
		revisionCondition: input.revisionCondition,
		targetId: input.targetId,
		verifiedSourceId: input.source,
	};
	if (input.withHumanBase) {
		command.baseRevision = input.revisionCondition ?? 1;
		command.idempotencyKey = "forged-human-key";
	}
	return command;
}

describe("Mutation Contract", () => {
	let prisma: PrismaClient;
	let pool: Pool;

	beforeAll(() => {
		process.env.NODE_ENV = "test";
	});

	beforeEach(async () => {
		pool = new Pool({ connectionString: DATABASE_URL });
		prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
		await prisma.recordHistoryEntry.deleteMany();
		await prisma.mutationReceipt.deleteMany();
		await prisma.mutationFixtureIndexEntry.deleteMany();
		await prisma.mutationFixtureRelation.deleteMany();
		await prisma.mutationFixtureCounter.deleteMany();
		await prisma.mutationStagingOperation.deleteMany();
		await prisma.mutationFixtureRecord.deleteMany();
	});

	afterEach(async () => {
		await prisma.$disconnect();
		await pool.end();
	});

	it("does not apply a human command missing the base revision", async () => {
		const target = await createMutationTarget(prisma, "initial");
		const outcome = await applyMutation(
			prisma,
			humanCommand({
				idempotencyKey: "key-1",
				payload: { value: "changed" },
				targetId: target.targetId,
			})
		);
		expect(outcome).toEqual({
			reason: "missing-base-revision",
			status: "rejected",
		});
		expect(await readMutationTarget(prisma, target.targetId)).toEqual(target);
		expect(await readRecordHistory(prisma, target.targetId)).toEqual([]);
	});

	it("does not apply a human command missing the client idempotency key", async () => {
		const target = await createMutationTarget(prisma, "initial");
		const outcome = await applyMutation(
			prisma,
			humanCommand({
				baseRevision: 1,
				payload: { value: "changed" },
				targetId: target.targetId,
			})
		);
		expect(outcome).toEqual({
			reason: "missing-idempotency-key",
			status: "rejected",
		});
		expect(await readMutationTarget(prisma, target.targetId)).toEqual(target);
	});

	it("commits a human command and records the User actor on Kayıt geçmişi", async () => {
		const target = await createMutationTarget(prisma, "initial");
		const before = new Date();
		const outcome = await applyMutation(
			prisma,
			humanCommand({
				baseRevision: 1,
				idempotencyKey: "key-1",
				payload: { value: "changed" },
				targetId: target.targetId,
			})
		);
		expect(outcome).toEqual({
			receipt: {
				revision: 2,
				targetId: target.targetId,
				value: "changed",
			},
			status: "committed",
		});
		const history = await readRecordHistory(prisma, target.targetId);
		expect(history).toHaveLength(1);
		expect(history[0]?.actor).toBe(MUTATION_ACTOR.user);
		expect(history[0]?.actorId).toBe(ACTOR_ID);
		expect(history[0]?.origin).toBe("human");
		expect(history[0]?.previousValue).toBe("initial");
		expect(history[0]?.nextValue).toBe("changed");
		expect(history[0]?.revisionAfter).toBe(2);
		expect(history[0]?.occurredAt.getTime()).toBeGreaterThanOrEqual(
			before.getTime()
		);
	});

	it("returns the previous receipt when the same human key and payload retry", async () => {
		const target = await createMutationTarget(prisma, "initial");
		const command = humanCommand({
			baseRevision: 1,
			idempotencyKey: "key-1",
			payload: { value: "changed" },
			targetId: target.targetId,
		});
		const first = await applyMutation(prisma, command);
		const retry = await applyMutation(prisma, command);
		expect(first.status).toBe("committed");
		expect(retry).toEqual({
			receipt: {
				revision: 2,
				targetId: target.targetId,
				value: "changed",
			},
			status: "replayed",
		});
		expect(await readMutationTarget(prisma, target.targetId)).toEqual({
			revision: 2,
			targetId: target.targetId,
			value: "changed",
		});
		expect(await readRecordHistory(prisma, target.targetId)).toHaveLength(1);
	});

	it("returns Conflict when the same human key carries a different payload", async () => {
		const target = await createMutationTarget(prisma, "initial");
		await applyMutation(
			prisma,
			humanCommand({
				baseRevision: 1,
				idempotencyKey: "key-1",
				payload: { value: "changed" },
				targetId: target.targetId,
			})
		);
		const outcome = await applyMutation(
			prisma,
			humanCommand({
				baseRevision: 1,
				idempotencyKey: "key-1",
				payload: { value: "other" },
				targetId: target.targetId,
			})
		);
		expect(outcome).toEqual({
			conflict: MUTATION_COPY.conflict,
			status: "conflict",
		});
		expect(await readMutationTarget(prisma, target.targetId)).toEqual({
			revision: 2,
			targetId: target.targetId,
			value: "changed",
		});
	});

	it("rejects a stale human base, shows Current value, and does not last-write-wins", async () => {
		const target = await createMutationTarget(prisma, "initial");
		await applyMutation(
			prisma,
			humanCommand({
				baseRevision: 1,
				idempotencyKey: "key-1",
				payload: { value: "first" },
				targetId: target.targetId,
			})
		);
		const outcome = await applyMutation(
			prisma,
			humanCommand({
				baseRevision: 1,
				idempotencyKey: "key-2",
				payload: { value: "second" },
				targetId: target.targetId,
			})
		);
		expect(outcome).toEqual({
			current: {
				revision: 2,
				targetId: target.targetId,
				value: "first",
			},
			currentValueLabel: MUTATION_COPY.currentValue,
			status: "stale",
		});
		expect(await readMutationTarget(prisma, target.targetId)).toEqual({
			revision: 2,
			targetId: target.targetId,
			value: "first",
		});
	});

	it.each(
		NON_HUMAN_CASES
	)("commits a $origin command with verified source fields and records $actor", async ({
		actor,
		origin,
		source,
	}) => {
		const target = await createMutationTarget(prisma, "initial");
		const outcome = await applyMutation(
			prisma,
			nonHumanCommand({
				deliveryId: "delivery-1",
				origin,
				payload: { value: "from-source" },
				revisionCondition: 1,
				source,
				targetId: target.targetId,
			})
		);
		expect(outcome).toEqual({
			receipt: {
				revision: 2,
				targetId: target.targetId,
				value: "from-source",
			},
			status: "committed",
		});
		const history = await readRecordHistory(prisma, target.targetId);
		expect(history[0]?.actor).toBe(actor);
		expect(history[0]?.origin).toBe(origin);
		expect(history[0]?.previousValue).toBe("initial");
		expect(history[0]?.nextValue).toBe("from-source");
	});

	it.each(
		NON_HUMAN_CASES
	)("rejects a $origin command that forges a human base revision", async ({
		origin,
		source,
	}) => {
		const target = await createMutationTarget(prisma, "initial");
		const outcome = await applyMutation(
			prisma,
			nonHumanCommand({
				deliveryId: "delivery-1",
				origin,
				revisionCondition: 1,
				source,
				targetId: target.targetId,
				withHumanBase: true,
			})
		);
		expect(outcome).toEqual({
			reason: "fake-human-base",
			status: "rejected",
		});
		expect(await readMutationTarget(prisma, target.targetId)).toEqual(target);
	});

	it.each(
		NON_HUMAN_CASES
	)("returns the previous receipt when $origin redelivers the same source and payload", async ({
		origin,
		source,
	}) => {
		const target = await createMutationTarget(prisma, "initial");
		const command = nonHumanCommand({
			deliveryId: "delivery-1",
			origin,
			payload: { value: "from-source" },
			revisionCondition: 1,
			source,
			targetId: target.targetId,
		});
		const first = await applyMutation(prisma, command);
		const retry = await applyMutation(prisma, command);
		expect(first.status).toBe("committed");
		expect(retry).toEqual({
			receipt: {
				revision: 2,
				targetId: target.targetId,
				value: "from-source",
			},
			status: "replayed",
		});
		expect(await readRecordHistory(prisma, target.targetId)).toHaveLength(1);
	});

	it.each(
		NON_HUMAN_CASES
	)("returns Conflict when $origin reuses a delivery id with a different payload", async ({
		origin,
		source,
	}) => {
		const target = await createMutationTarget(prisma, "initial");
		await applyMutation(
			prisma,
			nonHumanCommand({
				deliveryId: "delivery-1",
				origin,
				payload: { value: "from-source" },
				revisionCondition: 1,
				source,
				targetId: target.targetId,
			})
		);
		const outcome = await applyMutation(
			prisma,
			nonHumanCommand({
				deliveryId: "delivery-1",
				origin,
				payload: { value: "swapped" },
				revisionCondition: 1,
				source,
				targetId: target.targetId,
			})
		);
		expect(outcome).toEqual({
			conflict: MUTATION_COPY.conflict,
			status: "conflict",
		});
		expect(await readMutationTarget(prisma, target.targetId)).toEqual({
			revision: 2,
			targetId: target.targetId,
			value: "from-source",
		});
	});

	it("does not apply a non-human command missing verified source id, delivery id, fingerprint, or revision condition", async () => {
		const target = await createMutationTarget(prisma, "initial");
		const payload = { value: "from-source" };
		const base = {
			actorId: "github:repo:42",
			origin: "github",
			payload,
			targetId: target.targetId,
		};
		expect(
			await applyMutation(prisma, {
				...base,
				deliveryId: "d1",
				payloadFingerprint: payloadFingerprint(payload),
				revisionCondition: 1,
			})
		).toEqual({ reason: "missing-source", status: "rejected" });
		expect(
			await applyMutation(prisma, {
				...base,
				payloadFingerprint: payloadFingerprint(payload),
				revisionCondition: 1,
				verifiedSourceId: "github:repo:42",
			})
		).toEqual({ reason: "missing-delivery-id", status: "rejected" });
		expect(
			await applyMutation(prisma, {
				...base,
				deliveryId: "d1",
				revisionCondition: 1,
				verifiedSourceId: "github:repo:42",
			})
		).toEqual({ reason: "missing-payload-fingerprint", status: "rejected" });
		expect(
			await applyMutation(prisma, {
				...base,
				deliveryId: "d1",
				payloadFingerprint: payloadFingerprint(payload),
				verifiedSourceId: "github:repo:42",
			})
		).toEqual({ reason: "missing-revision-condition", status: "rejected" });
		expect(await readMutationTarget(prisma, target.targetId)).toEqual(target);
	});

	it.each([
		{ kind: "human" as const },
		...NON_HUMAN_CASES.map((entry) => ({ kind: entry.origin })),
	])("does not overwrite a later write when a $kind delivery is reordered", async ({
		kind,
	}) => {
		const target = await createMutationTarget(prisma, "initial");
		const first = commandFor(kind, {
			expectedRevision: 1,
			key: "first",
			targetId: target.targetId,
			value: "one",
		});
		const second = commandFor(kind, {
			expectedRevision: 2,
			key: "second",
			targetId: target.targetId,
			value: "two",
		});
		expect((await applyMutation(prisma, first)).status).toBe("committed");
		expect((await applyMutation(prisma, second)).status).toBe("committed");
		const replayed = await applyMutation(prisma, first);
		expect(replayed).toEqual({
			receipt: {
				revision: 2,
				targetId: target.targetId,
				value: "one",
			},
			status: "replayed",
		});
		expect(await readMutationTarget(prisma, target.targetId)).toEqual({
			revision: 3,
			targetId: target.targetId,
			value: "two",
		});
		expect(await readRecordHistory(prisma, target.targetId)).toHaveLength(2);
	});

	it.each([
		{ kind: "human" as const },
		...NON_HUMAN_CASES.map((entry) => ({ kind: entry.origin })),
	])("lets only one of two concurrent $kind writes commit and shows Current value to the other", async ({
		kind,
	}) => {
		const target = await createMutationTarget(prisma, "initial");
		const left = commandFor(kind, {
			expectedRevision: 1,
			key: "left",
			targetId: target.targetId,
			value: "left",
		});
		const right = commandFor(kind, {
			expectedRevision: 1,
			key: "right",
			targetId: target.targetId,
			value: "right",
		});
		const [first, second] = await Promise.all([
			applyMutation(prisma, left),
			applyMutation(prisma, right),
		]);
		const outcomes = [first, second];
		const committed = outcomes.filter(
			(outcome) => outcome.status === "committed"
		);
		const stale = outcomes.filter((outcome) => outcome.status === "stale");
		expect(committed).toHaveLength(1);
		expect(stale).toHaveLength(1);
		expect(stale[0]?.currentValueLabel).toBe(MUTATION_COPY.currentValue);
		const current = await readMutationTarget(prisma, target.targetId);
		expect(current?.revision).toBe(2);
		expect(["left", "right"]).toContain(current?.value);
		expect(stale[0]?.current).toEqual(current);
		expect(committed[0]?.receipt).toEqual(current);
		expect(await readRecordHistory(prisma, target.targetId)).toHaveLength(1);
	});

	it("applies Undo on a deterministic field change", async () => {
		const target = await createMutationTarget(prisma, "initial");
		await applyMutation(
			prisma,
			humanCommand({
				baseRevision: 1,
				idempotencyKey: "edit-1",
				payload: { value: "changed" },
				targetId: target.targetId,
			})
		);
		const history = await readRecordHistory(prisma, target.targetId);
		expect(history[0]?.undo).toBe("Undo");
		const outcome = await applyUndo(
			prisma,
			undoCommand({
				baseRevision: 2,
				historyEntryId: history[0]?.id ?? "",
				idempotencyKey: "undo-1",
				targetId: target.targetId,
			})
		);
		expect(outcome).toEqual({
			receipt: {
				revision: 3,
				targetId: target.targetId,
				value: "initial",
			},
			status: "committed",
		});
		expect(await readMutationTarget(prisma, target.targetId)).toEqual({
			revision: 3,
			targetId: target.targetId,
			value: "initial",
		});
	});

	it("does not wrap an unrelated later field edit when Undo runs", async () => {
		const target = await createMutationTarget(prisma, "initial");
		await applyMutation(
			prisma,
			humanCommand({
				baseRevision: 1,
				idempotencyKey: "edit-value",
				payload: { value: "changed" },
				targetId: target.targetId,
			})
		);
		await applyMutation(
			prisma,
			humanCommand({
				baseRevision: 2,
				idempotencyKey: "edit-note",
				payload: { field: "note", value: "later note" },
				targetId: target.targetId,
			})
		);
		const history = await readRecordHistory(prisma, target.targetId);
		const valueEdit = history.find((entry) => entry.fieldKey === "value");
		const outcome = await applyUndo(
			prisma,
			undoCommand({
				baseRevision: 3,
				historyEntryId: valueEdit?.id ?? "",
				idempotencyKey: "undo-value",
				targetId: target.targetId,
			})
		);
		expect(outcome.status).toBe("committed");
		expect(await readMutationTarget(prisma, target.targetId)).toEqual({
			revision: 4,
			targetId: target.targetId,
			value: "initial",
		});
		expect(await readMutationFields(prisma, target.targetId)).toEqual({
			note: "later note",
			value: "initial",
		});
	});

	it("stops Undo and shows Conflict with Current value when the same field has a newer value", async () => {
		const target = await createMutationTarget(prisma, "initial");
		await applyMutation(
			prisma,
			humanCommand({
				baseRevision: 1,
				idempotencyKey: "edit-1",
				payload: { value: "first" },
				targetId: target.targetId,
			})
		);
		await applyMutation(
			prisma,
			humanCommand({
				baseRevision: 2,
				idempotencyKey: "edit-2",
				payload: { value: "second" },
				targetId: target.targetId,
			})
		);
		const [firstEdit] = await readRecordHistory(prisma, target.targetId);
		const outcome = await applyUndo(
			prisma,
			undoCommand({
				baseRevision: 3,
				historyEntryId: firstEdit?.id ?? "",
				idempotencyKey: "undo-first",
				targetId: target.targetId,
			})
		);
		expect(outcome).toEqual({
			conflict: "Conflict",
			current: {
				revision: 3,
				targetId: target.targetId,
				value: "second",
			},
			currentValueLabel: "Current value",
			status: "conflict",
		});
		expect(await readMutationTarget(prisma, target.targetId)).toEqual({
			revision: 3,
			targetId: target.targetId,
			value: "second",
		});
	});

	it("explains Current value of the conflicting field, not a different field", async () => {
		const target = await createMutationTarget(prisma, "title");
		await applyMutation(
			prisma,
			humanCommand({
				baseRevision: 1,
				idempotencyKey: "note-1",
				payload: { field: "note", value: "first note" },
				targetId: target.targetId,
			})
		);
		await applyMutation(
			prisma,
			humanCommand({
				baseRevision: 2,
				idempotencyKey: "note-2",
				payload: { field: "note", value: "newer note" },
				targetId: target.targetId,
			})
		);
		const [firstNote] = await readRecordHistory(prisma, target.targetId);
		const outcome = await applyUndo(
			prisma,
			undoCommand({
				baseRevision: 3,
				historyEntryId: firstNote?.id ?? "",
				idempotencyKey: "undo-note",
				targetId: target.targetId,
			})
		);
		expect(outcome).toEqual({
			conflict: "Conflict",
			current: {
				revision: 3,
				targetId: target.targetId,
				value: "newer note",
			},
			currentValueLabel: "Current value",
			status: "conflict",
		});
		expect(await readMutationTarget(prisma, target.targetId)).toEqual({
			revision: 3,
			targetId: target.targetId,
			value: "title",
		});
	});

	it.each([
		CHANGE_KIND.permanentDelete,
		CHANGE_KIND.securityRedaction,
		CHANGE_KIND.externalSystem,
		CHANGE_KIND.publishedExport,
	])("does not apply Undo to %s and does not offer the Undo action", async (kind) => {
		const target = await createMutationTarget(prisma, "initial");
		const committed = await applyMutation(
			prisma,
			humanCommand({
				baseRevision: 1,
				idempotencyKey: `unsafe-${kind}`,
				payload: { kind, value: "irreversible" },
				targetId: target.targetId,
			})
		);
		expect(committed.status).toBe("committed");
		const history = await readRecordHistory(prisma, target.targetId);
		expect(history[0]?.undo).toBeNull();
		const before = await readMutationTarget(prisma, target.targetId);
		const outcome = await applyUndo(
			prisma,
			undoCommand({
				baseRevision: 2,
				historyEntryId: history[0]?.id ?? "",
				idempotencyKey: `undo-${kind}`,
				targetId: target.targetId,
			})
		);
		expect(outcome).toEqual({
			reason: "undo-not-safe",
			status: "rejected",
		});
		expect(await readMutationTarget(prisma, target.targetId)).toEqual(before);
	});

	it("offers Undo on field, relation, view metadata, and atomic transform, not a general undo stack", async () => {
		const target = await createMutationTarget(prisma, "initial");
		const related = await createMutationTarget(prisma, "related");
		await applyMutation(
			prisma,
			humanCommand({
				baseRevision: 1,
				idempotencyKey: "field",
				payload: { kind: CHANGE_KIND.field, value: "named" },
				targetId: target.targetId,
			})
		);
		await applyMutation(
			prisma,
			humanCommand({
				baseRevision: 2,
				idempotencyKey: "relation",
				payload: {
					field: "related",
					kind: CHANGE_KIND.relation,
					value: related.targetId,
				},
				targetId: target.targetId,
			})
		);
		await applyMutation(
			prisma,
			humanCommand({
				baseRevision: 3,
				idempotencyKey: "view",
				payload: {
					field: "view.sort",
					kind: CHANGE_KIND.viewMetadata,
					value: "name",
				},
				targetId: target.targetId,
			})
		);
		await applyMutation(
			prisma,
			humanCommand({
				baseRevision: 4,
				idempotencyKey: "transform",
				payload: {
					kind: CHANGE_KIND.atomicTransform,
					secondaryValue: "together",
					value: "transformed",
				},
				targetId: target.targetId,
			})
		);
		const history = await readRecordHistory(prisma, target.targetId);
		expect(history.map((entry) => entry.undo)).toEqual([
			"Undo",
			"Undo",
			"Undo",
			"Undo",
		]);
		const viewEdit = history.find((entry) => entry.fieldKey === "view.sort");
		expect(
			(
				await applyUndo(
					prisma,
					undoCommand({
						baseRevision: 5,
						historyEntryId: viewEdit?.id ?? "",
						idempotencyKey: "undo-view",
						targetId: target.targetId,
					})
				)
			).status
		).toBe("committed");
		expect(await readMutationFields(prisma, target.targetId)).toEqual({
			note: "together",
			value: "transformed",
		});
		expect(await readMutationRelations(prisma, target.targetId)).toEqual([
			{ kind: "related", toId: related.targetId },
		]);
	});

	it("undoes an atomic transform without wrapping an unrelated later field", async () => {
		const target = await createMutationTarget(prisma, "initial");
		await applyMutation(
			prisma,
			humanCommand({
				baseRevision: 1,
				idempotencyKey: "transform",
				payload: {
					kind: CHANGE_KIND.atomicTransform,
					secondaryValue: "paired",
					value: "transformed",
				},
				targetId: target.targetId,
			})
		);
		await applyMutation(
			prisma,
			humanCommand({
				baseRevision: 2,
				idempotencyKey: "later-view",
				payload: {
					field: "view.sort",
					kind: CHANGE_KIND.viewMetadata,
					value: "name",
				},
				targetId: target.targetId,
			})
		);
		const history = await readRecordHistory(prisma, target.targetId);
		const transform = history.find(
			(entry) => entry.changeKind === CHANGE_KIND.atomicTransform
		);
		expect(
			(
				await applyUndo(
					prisma,
					undoCommand({
						baseRevision: 3,
						historyEntryId: transform?.id ?? "",
						idempotencyKey: "undo-transform",
						targetId: target.targetId,
					})
				)
			).status
		).toBe("committed");
		expect(await readMutationFields(prisma, target.targetId)).toEqual({
			value: "initial",
			"view.sort": "name",
		});
	});

	it("restores the Emekli kayıt kimliği on Birleştirmeyi geri alma and splits only merge-attributed values and relations", async () => {
		const survivor = await createMutationTarget(prisma, "survivor");
		const retired = await createMutationTarget(prisma, "retired");
		const related = await createMutationTarget(prisma, "related");
		await applyMutation(
			prisma,
			humanCommand({
				baseRevision: 1,
				idempotencyKey: "bind-retired",
				payload: {
					field: "related",
					kind: CHANGE_KIND.relation,
					value: related.targetId,
				},
				targetId: retired.targetId,
			})
		);
		await applyMutation(
			prisma,
			humanCommand({
				baseRevision: 1,
				idempotencyKey: "merge",
				payload: {
					attributedFields: { note: "from-retired" },
					attributedRelationToIds: [related.targetId],
					kind: CHANGE_KIND.merge,
					value: retired.targetId,
				},
				targetId: survivor.targetId,
			})
		);
		expect(await readRetiredInto(prisma, retired.targetId)).toBe(
			survivor.targetId
		);
		expect(await readMutationFields(prisma, survivor.targetId)).toEqual({
			note: "from-retired",
			value: "survivor",
		});
		expect(await readMutationRelations(prisma, survivor.targetId)).toEqual([
			{ kind: "related", toId: related.targetId },
		]);
		await applyMutation(
			prisma,
			humanCommand({
				baseRevision: 2,
				idempotencyKey: "later-survivor",
				payload: { value: "later survivor" },
				targetId: survivor.targetId,
			})
		);
		const history = await readRecordHistory(prisma, survivor.targetId);
		const mergeEntry = history.find(
			(entry) => entry.changeKind === CHANGE_KIND.merge
		);
		expect(mergeEntry?.undo).toBe("Undo");
		const outcome = await applyUndo(
			prisma,
			undoCommand({
				baseRevision: 3,
				historyEntryId: mergeEntry?.id ?? "",
				idempotencyKey: "undo-merge",
				targetId: survivor.targetId,
			})
		);
		expect(outcome.status).toBe("committed");
		expect(await readRetiredInto(prisma, retired.targetId)).toBeNull();
		expect(await readMutationFields(prisma, survivor.targetId)).toEqual({
			value: "later survivor",
		});
		expect(await readMutationRelations(prisma, survivor.targetId)).toEqual([]);
		expect(await readMutationFields(prisma, retired.targetId)).toEqual({
			note: "from-retired",
			value: "retired",
		});
		expect(await readMutationRelations(prisma, retired.targetId)).toEqual([
			{ kind: "related", toId: related.targetId },
		]);
	});

	it("walks create, edit, Conflict, and Undo on the Mutation Contract seam", async () => {
		const created = await createMutationTarget(prisma, "initial");
		const edited = await applyMutation(
			prisma,
			humanCommand({
				baseRevision: 1,
				idempotencyKey: "edit",
				payload: { value: "edited" },
				targetId: created.targetId,
			})
		);
		expect(edited.status).toBe("committed");
		await applyMutation(
			prisma,
			humanCommand({
				baseRevision: 2,
				idempotencyKey: "edit-again",
				payload: { value: "newer" },
				targetId: created.targetId,
			})
		);
		const history = await readRecordHistory(prisma, created.targetId);
		const [firstEdit, latestEdit] = history;
		expect(firstEdit?.undo).toBe("Undo");
		const conflict = await applyUndo(
			prisma,
			undoCommand({
				baseRevision: 3,
				historyEntryId: firstEdit?.id ?? "",
				idempotencyKey: "undo-first",
				targetId: created.targetId,
			})
		);
		expect(conflict).toEqual({
			conflict: "Conflict",
			current: {
				revision: 3,
				targetId: created.targetId,
				value: "newer",
			},
			currentValueLabel: "Current value",
			status: "conflict",
		});
		const undone = await applyUndo(
			prisma,
			undoCommand({
				baseRevision: 3,
				historyEntryId: latestEdit?.id ?? "",
				idempotencyKey: "undo-latest",
				targetId: created.targetId,
			})
		);
		expect(undone).toEqual({
			receipt: {
				revision: 4,
				targetId: created.targetId,
				value: "edited",
			},
			status: "committed",
		});
	});
});

function undoCommand(input: {
	baseRevision: number;
	historyEntryId: string;
	idempotencyKey: string;
	targetId: string;
}) {
	return {
		actorId: ACTOR_ID,
		baseRevision: input.baseRevision,
		historyEntryId: input.historyEntryId,
		idempotencyKey: input.idempotencyKey,
		origin: "human" as const,
		targetId: input.targetId,
	};
}

function commandFor(
	kind: MutationOrigin,
	input: {
		expectedRevision: number;
		key: string;
		targetId: string;
		value: string;
	}
) {
	if (kind === "human") {
		return humanCommand({
			baseRevision: input.expectedRevision,
			idempotencyKey: input.key,
			payload: { value: input.value },
			targetId: input.targetId,
		});
	}
	const source =
		NON_HUMAN_CASES.find((entry) => entry.origin === kind)?.source ?? kind;
	return nonHumanCommand({
		deliveryId: input.key,
		origin: kind,
		payload: { value: input.value },
		revisionCondition: input.expectedRevision,
		source,
		targetId: input.targetId,
	});
}
