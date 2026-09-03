import { protectedProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { createProjectGoals } from "../../goals/server/project-goals";
import { getProject } from "../../project-shell/server/project-shell";
import {
	overviewSourcesFromProject,
	projectOverview,
} from "./project-overview";

async function requireAccess(userId: string) {
	const access = await getAccountAccessForUser(getPrismaClient(), userId);
	if (!access) {
		throw new ORPCError("UNAUTHORIZED");
	}
	return access;
}

export const projectOverviewRouter = {
	get: protectedProcedure
		.input(z.object({ projectId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const project = await getProject(getPrismaClient(), input.projectId);
			if (!project || project.workspaceId !== access.workspaceId) {
				throw new ORPCError("NOT_FOUND");
			}
			const surface = createProjectGoals({
				accountId: access.accountId,
				prisma: getPrismaClient(),
				workspaceId: access.workspaceId,
			});
			const goals = await surface.list(project.id);
			return projectOverview(
				overviewSourcesFromProject(project, {
					goals: goals.map((goal) => ({
						id: goal.id,
						title: goal.title,
					})),
				})
			);
		}),
};
