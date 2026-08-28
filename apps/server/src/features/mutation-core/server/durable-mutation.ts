import type { Prisma, PrismaClient } from "@cantiara/db";

import { MUTATION_ACTOR, payloadFingerprint } from "./mutation-shared";

export type MutationDb = PrismaClient | Prisma.TransactionClient;

export async function lockMutation(
	db: Prisma.TransactionClient,
	key: string
): Promise<void> {
	await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
}

export async function readDurableReceipt(
	db: MutationDb,
	commandKey: string,
	payload: unknown
): Promise<
	null | { kind: "conflict" } | { kind: "replay"; resultValue: string }
> {
	const existing = await db.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (!existing) {
		return null;
	}
	if (existing.payloadFingerprint !== payloadFingerprint(payload)) {
		return { kind: "conflict" };
	}
	return { kind: "replay", resultValue: existing.resultValue };
}

export async function writeDurableReceipt(
	db: MutationDb,
	input: {
		actorId: string;
		commandKey: string;
		kind: string;
		payload: unknown;
		resultValue: string;
		targetId: string;
		committedRevision?: number;
	}
): Promise<void> {
	await db.mutationReceipt.create({
		data: {
			actorId: input.actorId,
			actorType: MUTATION_ACTOR.user,
			commandKey: input.commandKey,
			committedRevision: input.committedRevision ?? 1,
			id: crypto.randomUUID(),
			kind: input.kind,
			origin: "human",
			payloadFingerprint: payloadFingerprint(input.payload),
			resultValue: input.resultValue,
			targetId: input.targetId,
		},
	});
}
