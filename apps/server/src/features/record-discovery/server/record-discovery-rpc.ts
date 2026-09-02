import { protectedProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { FILE_LIFECYCLE } from "../../file-attachments/server/file-attachments-model";
import {
	loadSearchIndexFromRows,
	SEARCH_EXCLUDED_KINDS,
	SEARCH_SECRET_FIELDS,
	searchRecords,
} from "./record-discovery";
import { RECORD_DISCOVERY_COPY } from "./record-discovery-copy";

async function requireAccess(userId: string) {
	const access = await getAccountAccessForUser(getPrismaClient(), userId);
	if (!access) {
		throw new ORPCError("UNAUTHORIZED");
	}
	return access;
}

async function loadWorkspaceIndex(workspaceId: string) {
	const prisma = getPrismaClient();
	const [works, fileAttachments] = await Promise.all([
		prisma.work.findMany({
			select: {
				archived: true,
				closureResult: true,
				description: true,
				id: true,
				key: true,
				projectId: true,
				status: true,
				title: true,
				trashedAt: true,
				updatedAt: true,
			},
			where: { project: { workspaceId } },
		}),
		prisma.fileAttachment.findMany({
			select: {
				id: true,
				lifecycle: true,
				projectId: true,
				scopeKind: true,
				title: true,
				updatedAt: true,
				versions: {
					orderBy: { versionNumber: "asc" },
					select: { filename: true },
				},
			},
			where: {
				lifecycle: { not: FILE_LIFECYCLE.trash },
				workspaceId,
			},
		}),
	]);
	return loadSearchIndexFromRows({ fileAttachments, works });
}

const searchInput = z.object({
	includeArchived: z.boolean().optional(),
	openProjectId: z.string().nullable().optional(),
	query: z.string(),
});

export const recordDiscovery = {
	catalog: protectedProcedure.handler(() => ({
		copy: RECORD_DISCOVERY_COPY,
		excludedKinds: SEARCH_EXCLUDED_KINDS,
		secretFields: SEARCH_SECRET_FIELDS,
		surface: RECORD_DISCOVERY_COPY.search,
	})),
	search: protectedProcedure
		.input(searchInput)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const index = await loadWorkspaceIndex(access.workspaceId);
			return searchRecords(index, {
				includeArchived: input.includeArchived ?? false,
				openProjectId: input.openProjectId ?? null,
				text: input.query,
			});
		}),
};
