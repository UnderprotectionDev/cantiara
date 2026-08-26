import type { PrismaClient } from "@cantiara/db";
import { z } from "zod";

import {
	MUTATION_ACTOR,
	MUTATION_COPY,
	payloadFingerprint,
} from "../../mutation-core/server/mutation-shared";
import {
	type BulkClusterView,
	type BulkPlacementView,
	type BulkSenseMakingView,
	CAPTURE_INBOX_COPY,
	type CaptureInboxItemView,
} from "./capture-inbox-model";

const EMPTY_LAYOUT_TEXT = '{"clusters":[],"placements":[]}';

const layoutSchema = z.object({
	clusters: z.array(z.object({ id: z.string(), name: z.string() })),
	placements: z.array(
		z.object({
			clusterId: z.string().nullable(),
			itemId: z.string(),
			position: z.object({ x: z.number(), y: z.number() }),
		})
	),
});

export type BulkLayout = z.infer<typeof layoutSchema>;

export type NameBulkClusterOutcome =
	| { cluster: BulkClusterView; status: "named" }
	| { queued: false; reason: "offline"; status: "refused" }
	| { reason: typeof MUTATION_COPY.conflict; status: "conflict" };

export type PlaceInBulkOutcome =
	| { placement: BulkPlacementView; status: "placed" }
	| { status: "not-found" }
	| { queued: false; reason: "offline"; status: "refused" }
	| { reason: typeof MUTATION_COPY.conflict; status: "conflict" };

function parseLayout(layoutText: string): BulkLayout {
	return layoutSchema.parse(JSON.parse(layoutText));
}

function toClusterView(cluster: { id: string; name: string }): BulkClusterView {
	return {
		id: cluster.id,
		kind: "view-metadata",
		name: cluster.name,
	};
}

async function readHumanReceipt(
	prisma: PrismaClient,
	commandKey: string,
	payload: unknown
) {
	const existing = await prisma.mutationReceipt.findUnique({
		where: { commandKey },
	});
	if (!existing) {
		return null;
	}
	if (existing.payloadFingerprint !== payloadFingerprint(payload)) {
		return { kind: "conflict" as const };
	}
	return { kind: "replay" as const, resultValue: existing.resultValue };
}

async function writeHumanReceipt(
	prisma: PrismaClient,
	input: {
		actorId: string;
		commandKey: string;
		kind: string;
		payload: unknown;
		resultValue: string;
		targetId: string;
	}
) {
	await prisma.mutationReceipt.create({
		data: {
			actorId: input.actorId,
			actorType: MUTATION_ACTOR.user,
			commandKey: input.commandKey,
			committedRevision: 1,
			id: crypto.randomUUID(),
			kind: input.kind,
			origin: "human",
			payloadFingerprint: payloadFingerprint(input.payload),
			resultValue: input.resultValue,
			targetId: input.targetId,
		},
	});
}

// bun --hot can keep a PrismaClient generated before CaptureBulkSenseView.
// Table SQL still writes view metadata; the generated delegate is optional.
async function findBulkView(
	prisma: PrismaClient,
	input: { ownerId: string; workspaceId: string }
): Promise<{ id: string; layoutText: string } | null> {
	const rows = await prisma.$queryRaw<
		Array<{ id: string; layoutText: string }>
	>`
		SELECT id, "layoutText"
		FROM "capture_bulk_sense_view"
		WHERE "workspaceId" = ${input.workspaceId} AND "ownerId" = ${input.ownerId}
		LIMIT 1
	`;
	return rows[0] ?? null;
}

async function insertBulkView(
	prisma: PrismaClient,
	input: {
		id: string;
		layoutText: string;
		ownerId: string;
		workspaceId: string;
	}
) {
	const now = new Date();
	await prisma.$executeRaw`
		INSERT INTO "capture_bulk_sense_view" (
			id,
			"workspaceId",
			"ownerId",
			"layoutText",
			"createdAt",
			"updatedAt"
		)
		VALUES (
			${input.id},
			${input.workspaceId},
			${input.ownerId},
			${input.layoutText},
			${now},
			${now}
		)
	`;
}

async function updateBulkView(
	prisma: PrismaClient,
	input: { id: string; layoutText: string }
) {
	const now = new Date();
	await prisma.$executeRaw`
		UPDATE "capture_bulk_sense_view"
		SET "layoutText" = ${input.layoutText}, "updatedAt" = ${now}
		WHERE id = ${input.id}
	`;
}

async function loadOrCreateLayout(
	prisma: PrismaClient,
	input: { actorId: string; workspaceId: string }
): Promise<{ id: string; layout: BulkLayout }> {
	const existing = await findBulkView(prisma, {
		ownerId: input.actorId,
		workspaceId: input.workspaceId,
	});
	if (existing) {
		return { id: existing.id, layout: parseLayout(existing.layoutText) };
	}
	const created = {
		id: crypto.randomUUID(),
		layoutText: EMPTY_LAYOUT_TEXT,
		ownerId: input.actorId,
		workspaceId: input.workspaceId,
	};
	await insertBulkView(prisma, created);
	return { id: created.id, layout: parseLayout(created.layoutText) };
}

async function writeLayout(
	prisma: PrismaClient,
	input: { id: string; layout: BulkLayout }
) {
	await updateBulkView(prisma, {
		id: input.id,
		layoutText: JSON.stringify(input.layout),
	});
}

export function createBulkSenseMaking(ctx: {
	actorId: string;
	connected: () => boolean;
	listAll: () => Promise<CaptureInboxItemView[]>;
	prisma: PrismaClient;
	workspaceId: string;
}) {
	return {
		async bulkSenseMaking(): Promise<BulkSenseMakingView> {
			const items = await ctx.listAll();
			const openIds = new Set(items.map((item) => item.id));
			const row = await findBulkView(ctx.prisma, {
				ownerId: ctx.actorId,
				workspaceId: ctx.workspaceId,
			});
			const layout = row
				? parseLayout(row.layoutText)
				: { clusters: [], placements: [] };
			const placements = layout.placements.filter((placement) =>
				openIds.has(placement.itemId)
			);
			return {
				clusters: layout.clusters.map(toClusterView),
				items,
				kind: "view-metadata",
				label: CAPTURE_INBOX_COPY.bulkSenseMaking,
				placements,
			};
		},
		async nameBulkCluster(input: {
			idempotencyKey: string;
			name: string;
		}): Promise<NameBulkClusterOutcome> {
			if (!ctx.connected()) {
				return { queued: false, reason: "offline", status: "refused" };
			}
			const name = input.name.trim();
			const payload = { name };
			const existing = await readHumanReceipt(
				ctx.prisma,
				input.idempotencyKey,
				payload
			);
			if (existing?.kind === "conflict") {
				return { reason: MUTATION_COPY.conflict, status: "conflict" };
			}
			if (existing?.kind === "replay") {
				return JSON.parse(existing.resultValue) as NameBulkClusterOutcome;
			}
			const stored = await loadOrCreateLayout(ctx.prisma, {
				actorId: ctx.actorId,
				workspaceId: ctx.workspaceId,
			});
			const cluster = { id: crypto.randomUUID(), name };
			stored.layout.clusters.push(cluster);
			await writeLayout(ctx.prisma, stored);
			const outcome: NameBulkClusterOutcome = {
				cluster: toClusterView(cluster),
				status: "named",
			};
			await writeHumanReceipt(ctx.prisma, {
				actorId: ctx.actorId,
				commandKey: input.idempotencyKey,
				kind: "name-bulk-cluster",
				payload,
				resultValue: JSON.stringify(outcome),
				targetId: cluster.id,
			});
			return outcome;
		},
		async placeInBulk(input: {
			clusterId: string | null;
			idempotencyKey: string;
			itemId: string;
			position: { x: number; y: number };
		}): Promise<PlaceInBulkOutcome> {
			if (!ctx.connected()) {
				return { queued: false, reason: "offline", status: "refused" };
			}
			const payload = {
				clusterId: input.clusterId ?? "",
				itemId: input.itemId,
				x: input.position.x,
				y: input.position.y,
			};
			const existing = await readHumanReceipt(
				ctx.prisma,
				input.idempotencyKey,
				payload
			);
			if (existing?.kind === "conflict") {
				return { reason: MUTATION_COPY.conflict, status: "conflict" };
			}
			if (existing?.kind === "replay") {
				return JSON.parse(existing.resultValue) as PlaceInBulkOutcome;
			}
			const items = await ctx.listAll();
			const item = items.find((candidate) => candidate.id === input.itemId);
			if (!item) {
				return { status: "not-found" };
			}
			const stored = await loadOrCreateLayout(ctx.prisma, {
				actorId: ctx.actorId,
				workspaceId: ctx.workspaceId,
			});
			if (
				input.clusterId !== null &&
				!stored.layout.clusters.some(
					(cluster) => cluster.id === input.clusterId
				)
			) {
				return { status: "not-found" };
			}
			const placement: BulkPlacementView = {
				clusterId: input.clusterId,
				itemId: input.itemId,
				position: input.position,
			};
			stored.layout.placements = stored.layout.placements.filter(
				(candidate) => candidate.itemId !== input.itemId
			);
			stored.layout.placements.push(placement);
			await writeLayout(ctx.prisma, stored);
			const outcome: PlaceInBulkOutcome = {
				placement,
				status: "placed",
			};
			await writeHumanReceipt(ctx.prisma, {
				actorId: ctx.actorId,
				commandKey: input.idempotencyKey,
				kind: "place-in-bulk",
				payload,
				resultValue: JSON.stringify(outcome),
				targetId: input.itemId,
			});
			return outcome;
		},
		async removePlacement(itemId: string) {
			const row = await findBulkView(ctx.prisma, {
				ownerId: ctx.actorId,
				workspaceId: ctx.workspaceId,
			});
			if (!row) {
				return;
			}
			const layout = parseLayout(row.layoutText);
			const nextPlacements = layout.placements.filter(
				(placement) => placement.itemId !== itemId
			);
			if (nextPlacements.length === layout.placements.length) {
				return;
			}
			const usedClusterIds = new Set(
				nextPlacements
					.map((placement) => placement.clusterId)
					.filter((clusterId): clusterId is string => clusterId !== null)
			);
			await writeLayout(ctx.prisma, {
				id: row.id,
				layout: {
					clusters: layout.clusters.filter((cluster) =>
						usedClusterIds.has(cluster.id)
					),
					placements: nextPlacements,
				},
			});
		},
	};
}
