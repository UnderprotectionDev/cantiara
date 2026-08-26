/**
 * Mutation Contract seam — multi-step staging, one commit barrier,
 * full commit or full rollback receipt, retry, payload fingerprint
 * Conflict, and post-barrier Cancel refused in favor of Finalizing.
 * Atomic package of docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Mutasyon sözleşmesi).
 */
import { PrismaClient } from "@cantiara/db";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	cancelAtomicWrite,
	cleanupExpiredStaging,
	createMutationTarget,
	finalizeAtomicWrite,
	readAtomicLiveState,
	readAtomicWrite,
	readMutationTarget,
	stageAtomicWrite,
} from "./mutation-contract";

const DATABASE_URL =
	process.env.DATABASE_URL ??
	"postgresql://cantiara:cantiara@127.0.0.1:5432/cantiara";

const ACTOR_ID = "founder-1";
const SCOPE = "project:alpha";
const RELATION_TARGET = "related-1";

function atomicCommand(input: {
	authorization?: "allowed" | "denied";
	baseRevision?: number;
	counterDelta?: number;
	idempotencyKey?: string;
	indexToken?: string;
	quotaRemaining?: number;
	relation?: { kind: string; targetId: string };
	targetId: string;
	targetScope?: string;
	value?: string;
}) {
	return {
		actorId: ACTOR_ID,
		authorization: input.authorization ?? "allowed",
		baseRevision: input.baseRevision,
		idempotencyKey: input.idempotencyKey,
		origin: "human" as const,
		payload: {
			counterDelta: input.counterDelta ?? 1,
			indexToken: input.indexToken ?? "token-a",
			relation: input.relation ?? {
				kind: "related",
				targetId: RELATION_TARGET,
			},
			value: input.value ?? "staged-value",
		},
		quotaRemaining: input.quotaRemaining ?? 3,
		targetId: input.targetId,
		targetScope: input.targetScope ?? SCOPE,
	};
}

describe("Mutation Contract atomic finalize", () => {
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

	it("holds a multi-step write in the hazırlama alanı so live records stay unchanged", async () => {
		const target = await createMutationTarget(prisma, "initial");
		const outcome = await stageAtomicWrite(
			prisma,
			atomicCommand({
				baseRevision: 1,
				idempotencyKey: "op-1",
				targetId: target.targetId,
			})
		);
		expect(outcome.status).toBe("staged");
		if (outcome.status !== "staged") {
			return;
		}
		expect(outcome.operation.ui).toEqual({
			cancelAvailable: true,
			label: "Cancel",
		});
		expect(await readMutationTarget(prisma, target.targetId)).toEqual(target);
		expect(await readAtomicLiveState(prisma, target.targetId)).toEqual({
			counter: 0,
			indexTokens: [],
			record: target,
			relations: [],
		});
	});

	it("cancels a staged write before the commit barrier and leaves no live effects", async () => {
		const target = await createMutationTarget(prisma, "initial");
		const staged = await stageAtomicWrite(
			prisma,
			atomicCommand({
				baseRevision: 1,
				idempotencyKey: "op-1",
				targetId: target.targetId,
			})
		);
		expect(staged.status).toBe("staged");
		if (staged.status !== "staged") {
			return;
		}
		const cancelled = await cancelAtomicWrite(
			prisma,
			staged.operation.operationId
		);
		expect(cancelled).toEqual({
			operation: {
				operationId: staged.operation.operationId,
				status: "cancelled",
				ui: {
					cancelAvailable: false,
					label: "Cancel",
				},
			},
			status: "cancelled",
		});
		expect(
			await readAtomicWrite(prisma, staged.operation.operationId)
		).toBeNull();
		expect(await readAtomicLiveState(prisma, target.targetId)).toEqual({
			counter: 0,
			indexTokens: [],
			record: target,
			relations: [],
		});
	});

	it("commits every live effect together and returns a full commit receipt", async () => {
		const target = await createMutationTarget(prisma, "initial");
		await stageAtomicWrite(
			prisma,
			atomicCommand({
				baseRevision: 1,
				idempotencyKey: "op-1",
				targetId: target.targetId,
				value: "committed-value",
			})
		);
		const outcome = await finalizeAtomicWrite(
			prisma,
			atomicCommand({
				baseRevision: 1,
				idempotencyKey: "op-1",
				targetId: target.targetId,
				value: "committed-value",
			})
		);
		expect(outcome).toEqual({
			operation: {
				operationId: expect.any(String),
				status: "committed",
				ui: {
					cancelAvailable: false,
					label: "Finalizing",
				},
			},
			receipt: {
				kind: "commit",
				revision: 2,
				targetId: target.targetId,
				value: "committed-value",
			},
			status: "committed",
		});
		expect(await readAtomicLiveState(prisma, target.targetId)).toEqual({
			counter: 1,
			indexTokens: ["token-a"],
			record: {
				revision: 2,
				targetId: target.targetId,
				value: "committed-value",
			},
			relations: [{ kind: "related", targetId: RELATION_TARGET }],
		});
	});

	it("rolls back a failed apply so no partial record, relation, counter, or index remains", async () => {
		const target = await createMutationTarget(prisma, "initial");
		await stageAtomicWrite(
			prisma,
			atomicCommand({
				baseRevision: 1,
				idempotencyKey: "op-1",
				indexToken: "shared",
				targetId: target.targetId,
				value: "first",
			})
		);
		const first = await finalizeAtomicWrite(
			prisma,
			atomicCommand({
				baseRevision: 1,
				idempotencyKey: "op-1",
				indexToken: "shared",
				targetId: target.targetId,
				value: "first",
			})
		);
		expect(first.status).toBe("committed");
		await stageAtomicWrite(
			prisma,
			atomicCommand({
				baseRevision: 2,
				idempotencyKey: "op-2",
				indexToken: "shared",
				targetId: target.targetId,
				value: "second",
			})
		);
		const outcome = await finalizeAtomicWrite(
			prisma,
			atomicCommand({
				baseRevision: 2,
				idempotencyKey: "op-2",
				indexToken: "shared",
				targetId: target.targetId,
				value: "second",
			})
		);
		expect(outcome.status).toBe("rolled-back");
		if (outcome.status !== "rolled-back") {
			return;
		}
		expect(outcome.receipt).toEqual({
			kind: "rollback",
			revision: 2,
			targetId: target.targetId,
			value: "first",
		});
		expect(outcome.operation.ui).toEqual({
			cancelAvailable: false,
			label: "Finalizing",
		});
		expect(await readAtomicLiveState(prisma, target.targetId)).toEqual({
			counter: 1,
			indexTokens: ["shared"],
			record: {
				revision: 2,
				targetId: target.targetId,
				value: "first",
			},
			relations: [{ kind: "related", targetId: RELATION_TARGET }],
		});
	});

	it("re-checks authorization, scope, and quota at the barrier and rolls back when they fail", async () => {
		const target = await createMutationTarget(prisma, "initial");
		const stagedAuth = await stageAtomicWrite(
			prisma,
			atomicCommand({
				baseRevision: 1,
				idempotencyKey: "op-auth",
				targetId: target.targetId,
			})
		);
		expect(stagedAuth.status).toBe("staged");
		expect(
			await finalizeAtomicWrite(
				prisma,
				atomicCommand({
					authorization: "denied",
					baseRevision: 1,
					idempotencyKey: "op-auth",
					targetId: target.targetId,
				})
			)
		).toMatchObject({
			receipt: { kind: "rollback", revision: 1, value: "initial" },
			status: "rolled-back",
		});
		await stageAtomicWrite(
			prisma,
			atomicCommand({
				baseRevision: 1,
				idempotencyKey: "op-scope",
				targetId: target.targetId,
			})
		);
		expect(
			await finalizeAtomicWrite(
				prisma,
				atomicCommand({
					baseRevision: 1,
					idempotencyKey: "op-scope",
					targetId: target.targetId,
					targetScope: "project:other",
				})
			)
		).toMatchObject({
			receipt: { kind: "rollback", revision: 1, value: "initial" },
			status: "rolled-back",
		});
		await stageAtomicWrite(
			prisma,
			atomicCommand({
				baseRevision: 1,
				idempotencyKey: "op-quota",
				quotaRemaining: 3,
				targetId: target.targetId,
			})
		);
		expect(
			await finalizeAtomicWrite(
				prisma,
				atomicCommand({
					baseRevision: 1,
					idempotencyKey: "op-quota",
					quotaRemaining: 0,
					targetId: target.targetId,
				})
			)
		).toMatchObject({
			receipt: { kind: "rollback", revision: 1, value: "initial" },
			status: "rolled-back",
		});
		expect(await readAtomicLiveState(prisma, target.targetId)).toEqual({
			counter: 0,
			indexTokens: [],
			record: target,
			relations: [],
		});
	});

	it("re-checks the base revision at the barrier, shows Current value, and rolls back", async () => {
		const target = await createMutationTarget(prisma, "initial");
		await stageAtomicWrite(
			prisma,
			atomicCommand({
				baseRevision: 1,
				idempotencyKey: "op-stale",
				targetId: target.targetId,
				value: "from-atomic",
			})
		);
		await finalizeAtomicWrite(
			prisma,
			atomicCommand({
				baseRevision: 1,
				idempotencyKey: "op-other",
				indexToken: "other",
				targetId: target.targetId,
				value: "winner",
			})
		);
		const outcome = await finalizeAtomicWrite(
			prisma,
			atomicCommand({
				baseRevision: 1,
				idempotencyKey: "op-stale",
				targetId: target.targetId,
				value: "from-atomic",
			})
		);
		expect(outcome).toMatchObject({
			current: {
				revision: 2,
				targetId: target.targetId,
				value: "winner",
			},
			currentValueLabel: "Current value",
			receipt: {
				kind: "rollback",
				revision: 2,
				targetId: target.targetId,
				value: "winner",
			},
			status: "stale",
		});
		expect(await readMutationTarget(prisma, target.targetId)).toEqual({
			revision: 2,
			targetId: target.targetId,
			value: "winner",
		});
	});

	it("returns the previous commit receipt when the same atomic operation retries", async () => {
		const target = await createMutationTarget(prisma, "initial");
		const command = atomicCommand({
			baseRevision: 1,
			idempotencyKey: "op-1",
			targetId: target.targetId,
			value: "committed-value",
		});
		await stageAtomicWrite(prisma, command);
		const first = await finalizeAtomicWrite(prisma, command);
		const retry = await finalizeAtomicWrite(prisma, command);
		expect(first.status).toBe("committed");
		expect(retry.status).toBe("replayed");
		if (retry.status !== "replayed" || first.status !== "committed") {
			return;
		}
		expect(retry.receipt).toEqual(first.receipt);
		expect(await readAtomicLiveState(prisma, target.targetId)).toEqual({
			counter: 1,
			indexTokens: ["token-a"],
			record: {
				revision: 2,
				targetId: target.targetId,
				value: "committed-value",
			},
			relations: [{ kind: "related", targetId: RELATION_TARGET }],
		});
	});

	it("returns Conflict when the retried atomic payload fingerprint changes", async () => {
		const target = await createMutationTarget(prisma, "initial");
		await stageAtomicWrite(
			prisma,
			atomicCommand({
				baseRevision: 1,
				idempotencyKey: "op-1",
				targetId: target.targetId,
				value: "first",
			})
		);
		await finalizeAtomicWrite(
			prisma,
			atomicCommand({
				baseRevision: 1,
				idempotencyKey: "op-1",
				targetId: target.targetId,
				value: "first",
			})
		);
		const outcome = await finalizeAtomicWrite(
			prisma,
			atomicCommand({
				baseRevision: 1,
				idempotencyKey: "op-1",
				targetId: target.targetId,
				value: "changed",
			})
		);
		expect(outcome).toEqual({
			conflict: "Conflict",
			status: "conflict",
		});
		expect(await readMutationTarget(prisma, target.targetId)).toEqual({
			revision: 2,
			targetId: target.targetId,
			value: "first",
		});
	});

	it("refuses Cancel after the commit barrier and shows Finalizing instead", async () => {
		const target = await createMutationTarget(prisma, "initial");
		const staged = await stageAtomicWrite(
			prisma,
			atomicCommand({
				baseRevision: 1,
				idempotencyKey: "op-1",
				targetId: target.targetId,
			})
		);
		expect(staged.status).toBe("staged");
		if (staged.status !== "staged") {
			return;
		}
		const finalized = await finalizeAtomicWrite(
			prisma,
			atomicCommand({
				baseRevision: 1,
				idempotencyKey: "op-1",
				targetId: target.targetId,
			})
		);
		expect(finalized.status).toBe("committed");
		const cancelled = await cancelAtomicWrite(
			prisma,
			staged.operation.operationId
		);
		expect(cancelled).toEqual({
			status: "refused",
			ui: {
				cancelAvailable: false,
				label: "Finalizing",
			},
		});
		const view = await readAtomicWrite(prisma, staged.operation.operationId);
		expect(view?.ui).toEqual({
			cancelAvailable: false,
			label: "Finalizing",
		});
		expect(view?.status).toBe("committed");
	});

	it("returns the previous rollback receipt when the same failed atomic operation retries", async () => {
		const target = await createMutationTarget(prisma, "initial");
		const command = atomicCommand({
			authorization: "denied",
			baseRevision: 1,
			idempotencyKey: "op-denied",
			targetId: target.targetId,
		});
		await stageAtomicWrite(
			prisma,
			atomicCommand({
				baseRevision: 1,
				idempotencyKey: "op-denied",
				targetId: target.targetId,
			})
		);
		const first = await finalizeAtomicWrite(prisma, command);
		const retry = await finalizeAtomicWrite(prisma, command);
		expect(first.status).toBe("rolled-back");
		expect(retry.status).toBe("replayed");
		if (retry.status !== "replayed") {
			return;
		}
		expect(retry.receipt.kind).toBe("rollback");
		expect(await readAtomicLiveState(prisma, target.targetId)).toEqual({
			counter: 0,
			indexTokens: [],
			record: target,
			relations: [],
		});
	});

	it("cleans expired staged writes without touching live records or durable receipts", async () => {
		const target = await createMutationTarget(prisma, "initial");
		const staged = await stageAtomicWrite(
			prisma,
			atomicCommand({
				baseRevision: 1,
				idempotencyKey: "op-expired",
				targetId: target.targetId,
			}),
			{ now: new Date("2020-01-01T00:00:00.000Z") }
		);
		expect(staged.status).toBe("staged");
		if (staged.status !== "staged") {
			return;
		}
		const kept = await stageAtomicWrite(
			prisma,
			atomicCommand({
				baseRevision: 1,
				idempotencyKey: "op-fresh",
				indexToken: "fresh",
				targetId: target.targetId,
				value: "fresh",
			}),
			{ now: new Date("2026-08-26T00:00:00.000Z") }
		);
		expect(kept.status).toBe("staged");
		await finalizeAtomicWrite(
			prisma,
			atomicCommand({
				baseRevision: 1,
				idempotencyKey: "op-kept-commit",
				indexToken: "kept",
				targetId: target.targetId,
				value: "kept",
			}),
			{ now: new Date("2026-08-26T00:00:00.000Z") }
		);
		const removed = await cleanupExpiredStaging(
			prisma,
			new Date("2026-08-26T00:00:00.000Z")
		);
		expect(removed).toBe(1);
		expect(
			await readAtomicWrite(prisma, staged.operation.operationId)
		).toBeNull();
		if (kept.status !== "staged") {
			return;
		}
		expect(
			await readAtomicWrite(prisma, kept.operation.operationId)
		).not.toBeNull();
		expect(await readMutationTarget(prisma, target.targetId)).toEqual({
			revision: 2,
			targetId: target.targetId,
			value: "kept",
		});
	});
});
