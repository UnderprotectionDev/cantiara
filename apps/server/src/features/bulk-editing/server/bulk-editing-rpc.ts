import { protectedProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { getProject } from "../../project-shell/server/project-shell";
import { previewBulkEdit } from "./bulk-editing";

async function requireAccess(userId: string) {
	const access = await getAccountAccessForUser(getPrismaClient(), userId);
	if (!access) {
		throw new ORPCError("UNAUTHORIZED");
	}
	return access;
}

export const bulkEditing = {
	preview: protectedProcedure
		.input(
			z.object({
				changes: z.record(z.string(), z.unknown()),
				filterWorkIds: z.array(z.string().min(1)).optional(),
				selectedWorkIds: z.array(z.string()),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const prisma = getPrismaClient();
			if (input.selectedWorkIds.length > 0) {
				const rows = await prisma.work.findMany({
					select: { projectId: true },
					where: { id: { in: input.selectedWorkIds } },
				});
				const projectIds = [...new Set(rows.map((row) => row.projectId))];
				const projects = await Promise.all(
					projectIds.map((projectId) => getProject(prisma, projectId))
				);
				if (
					projects.some(
						(project) => !project || project.workspaceId !== access.workspaceId
					)
				) {
					throw new ORPCError("NOT_FOUND");
				}
			}
			return await previewBulkEdit(prisma, input);
		}),
};
