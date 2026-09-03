import { describe, expect, it } from "bun:test";

import type { PrismaClient } from "../prisma/generated/client";
import { getPrismaClient } from "./index";
import { prismaClientHasCurrentWorkspaceModel } from "./prisma-client-delegates";
import {
	readWorkspaceOverviewLayout,
	type WorkspaceOverviewLayoutJson,
	writeWorkspaceOverviewLayout,
} from "./workspace-overview-layout";

const STALE_WORKSPACE_FIELDS = [
	{ name: "id" },
	{ name: "name" },
	{ name: "ownerId" },
	{ name: "createdAt" },
	{ name: "updatedAt" },
	{ name: "owner" },
	{ name: "projects" },
	{ name: "shortCodeReservations" },
	{ name: "tags" },
	{ name: "fileAttachments" },
];

const HIDE_ATTENTION = {
	hidden: ["Attention Required"],
	liveBlocks: [] as const,
	order: [
		"Active Projects",
		"Attention Required",
		"Upcoming",
		"Recent Work",
	] as const,
	savedLists: [] as const,
};

function asStaleWorkspaceClient(client: PrismaClient): PrismaClient {
	return new Proxy(client, {
		get(target, prop, receiver) {
			if (prop === "_runtimeDataModel") {
				return {
					models: {
						Workspace: { fields: STALE_WORKSPACE_FIELDS },
					},
				};
			}
			return Reflect.get(target, prop, receiver);
		},
	}) as PrismaClient;
}

describe("Workspace Overview layout persistence", () => {
	it("writes layout through SQL when bun --hot still has a pre-overviewLayout Workspace model", async () => {
		const prisma = getPrismaClient();
		const row = await prisma.workspace.findFirst({ select: { id: true } });
		if (!row) {
			return;
		}
		const previous = await readWorkspaceOverviewLayout(prisma, row.id);
		const stale = asStaleWorkspaceClient(prisma);
		expect(prismaClientHasCurrentWorkspaceModel(stale)).toBe(false);
		try {
			await writeWorkspaceOverviewLayout(stale, row.id, HIDE_ATTENTION);
			const stored = await readWorkspaceOverviewLayout(stale, row.id);
			expect(stored).toMatchObject({
				hidden: ["Attention Required"],
			});
		} finally {
			if (previous && typeof previous === "object") {
				const record = previous as {
					hidden?: string[];
					liveBlocks?: Array<{ kind: string; sourceId: string }>;
					order?: string[];
					savedLists?: WorkspaceOverviewLayoutJson["savedLists"];
				};
				await writeWorkspaceOverviewLayout(prisma, row.id, {
					hidden: record.hidden ?? [],
					liveBlocks: record.liveBlocks ?? [],
					order: record.order ?? [
						"Active Projects",
						"Attention Required",
						"Upcoming",
						"Recent Work",
					],
					savedLists: record.savedLists ?? [],
				});
			} else {
				await writeWorkspaceOverviewLayout(prisma, row.id, {
					hidden: [],
					liveBlocks: [],
					order: [
						"Active Projects",
						"Attention Required",
						"Upcoming",
						"Recent Work",
					],
					savedLists: [],
				});
			}
		}
	});
});
