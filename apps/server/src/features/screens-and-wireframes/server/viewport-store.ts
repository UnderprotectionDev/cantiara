import type { Prisma, PrismaClient } from "@cantiara/db";

import type { PersonalViewport } from "./screens-and-wireframes-model";

export type ScreenDb = PrismaClient | Prisma.TransactionClient;

export interface ScreenPersonalViewportRow {
	centerX: number;
	centerY: number;
	collapsedGroupIds: Prisma.JsonValue;
	id: string;
	screenId: string;
	userId: string;
	zoom: number;
}

export function hasViewportDelegate(db: ScreenDb): boolean {
	const delegate = (
		db as unknown as Record<
			string,
			{ findUnique?: unknown; upsert?: unknown } | undefined
		>
	).screenPersonalViewport;
	if (!delegate) {
		return false;
	}
	return (
		typeof delegate.findUnique === "function" &&
		typeof delegate.upsert === "function"
	);
}

export async function findPersonalViewportRow(
	db: ScreenDb,
	input: { screenId: string; userId: string }
): Promise<ScreenPersonalViewportRow | null> {
	if (hasViewportDelegate(db)) {
		return await db.screenPersonalViewport.findUnique({
			where: {
				screenId_userId: {
					screenId: input.screenId,
					userId: input.userId,
				},
			},
		});
	}
	const rows = await db.$queryRaw<ScreenPersonalViewportRow[]>`
		SELECT
			"centerX",
			"centerY",
			"collapsedGroupIds",
			"id",
			"screenId",
			"userId",
			"zoom"
		FROM "screen_personal_viewport"
		WHERE "screenId" = ${input.screenId}
			AND "userId" = ${input.userId}
		LIMIT 1
	`;
	const [found] = rows;
	return found ?? null;
}

export async function upsertPersonalViewportRow(
	db: ScreenDb,
	input: {
		id: string;
		screenId: string;
		userId: string;
		viewport: PersonalViewport;
	}
): Promise<void> {
	if (hasViewportDelegate(db)) {
		await db.screenPersonalViewport.upsert({
			create: {
				centerX: input.viewport.centerX,
				centerY: input.viewport.centerY,
				collapsedGroupIds: input.viewport.collapsedGroupIds,
				id: input.id,
				screenId: input.screenId,
				userId: input.userId,
				zoom: input.viewport.zoom,
			},
			update: {
				centerX: input.viewport.centerX,
				centerY: input.viewport.centerY,
				collapsedGroupIds: input.viewport.collapsedGroupIds,
				zoom: input.viewport.zoom,
			},
			where: {
				screenId_userId: {
					screenId: input.screenId,
					userId: input.userId,
				},
			},
		});
		return;
	}
	const collapsed = JSON.stringify(input.viewport.collapsedGroupIds);
	await db.$executeRaw`
		INSERT INTO "screen_personal_viewport" (
			"id",
			"screenId",
			"userId",
			"centerX",
			"centerY",
			"zoom",
			"collapsedGroupIds",
			"createdAt",
			"updatedAt"
		)
		VALUES (
			${input.id},
			${input.screenId},
			${input.userId},
			${input.viewport.centerX},
			${input.viewport.centerY},
			${input.viewport.zoom},
			CAST(${collapsed} AS JSONB),
			CURRENT_TIMESTAMP,
			CURRENT_TIMESTAMP
		)
		ON CONFLICT ("screenId", "userId") DO UPDATE SET
			"centerX" = EXCLUDED."centerX",
			"centerY" = EXCLUDED."centerY",
			"zoom" = EXCLUDED."zoom",
			"collapsedGroupIds" = EXCLUDED."collapsedGroupIds",
			"updatedAt" = CURRENT_TIMESTAMP
	`;
}
