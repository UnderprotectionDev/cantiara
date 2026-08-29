import type { PrismaClient } from "../prisma/generated/client";

import { prismaClientHasCurrentWorkspaceModel } from "./prisma-client-delegates";

export interface WorkspaceOverviewLayoutJson {
	hidden: readonly string[];
	liveBlocks: ReadonlyArray<{ kind: string; sourceId: string }>;
	order: readonly string[];
}

export async function readWorkspaceOverviewLayout(
	prisma: PrismaClient,
	workspaceId: string
): Promise<unknown> {
	if (prismaClientHasCurrentWorkspaceModel(prisma)) {
		const row = await prisma.workspace.findUnique({
			select: { overviewLayout: true },
			where: { id: workspaceId },
		});
		return row?.overviewLayout;
	}
	const rows = await prisma.$queryRaw<Array<{ overviewLayout: unknown }>>`
		SELECT "overviewLayout" FROM "workspace" WHERE "id" = ${workspaceId} LIMIT 1
	`;
	return rows[0]?.overviewLayout;
}

export async function writeWorkspaceOverviewLayout(
	prisma: PrismaClient,
	workspaceId: string,
	layout: WorkspaceOverviewLayoutJson
): Promise<void> {
	if (prismaClientHasCurrentWorkspaceModel(prisma)) {
		await prisma.workspace.update({
			data: { overviewLayout: layout },
			where: { id: workspaceId },
		});
		return;
	}
	const payload = JSON.stringify(layout);
	await prisma.$executeRaw`
		UPDATE "workspace"
		SET "overviewLayout" = CAST(${payload} AS JSONB), "updatedAt" = CURRENT_TIMESTAMP
		WHERE "id" = ${workspaceId}
	`;
}
