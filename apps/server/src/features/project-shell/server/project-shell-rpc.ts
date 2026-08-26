import { protectedProcedure, protectedWriteProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import {
	createProject,
	getProject,
	listProjects,
	suggestShortCode,
	updateShortCode,
} from "./project-shell";
import {
	createProjectPayloadSchema,
	PROJECT_SHELL_COPY,
	STARTER_CONFIGURATIONS,
} from "./project-shell-model";

async function requireAccess(userId: string) {
	const access = await getAccountAccessForUser(getPrismaClient(), userId);
	if (!access) {
		throw new ORPCError("UNAUTHORIZED");
	}
	return access;
}

export const projectShell = {
	catalog: protectedProcedure.handler(() => ({
		copy: PROJECT_SHELL_COPY,
		starterConfigurations: STARTER_CONFIGURATIONS,
	})),
	create: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: createProjectPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await createProject(getPrismaClient(), {
				actorId: access.accountId,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
				workspaceId: access.workspaceId,
			});
		}),
	get: protectedProcedure
		.input(z.object({ projectId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const project = await getProject(getPrismaClient(), input.projectId);
			if (!project || project.workspaceId !== access.workspaceId) {
				throw new ORPCError("NOT_FOUND");
			}
			return project;
		}),
	list: protectedProcedure.handler(async ({ context }) => {
		const access = await requireAccess(context.session.user.id);
		return await listProjects(getPrismaClient(), access.workspaceId);
	}),
	suggestShortCode: protectedProcedure
		.input(z.object({ name: z.string() }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return {
				shortCode: await suggestShortCode(
					getPrismaClient(),
					access.workspaceId,
					input.name
				),
			};
		}),
	updateShortCode: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				idempotencyKey: z.string(),
				projectId: z.string().min(1),
				shortCode: z.string(),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const existing = await getProject(getPrismaClient(), input.projectId);
			if (!existing || existing.workspaceId !== access.workspaceId) {
				throw new ORPCError("NOT_FOUND");
			}
			return await updateShortCode(getPrismaClient(), {
				actorId: access.accountId,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				projectId: input.projectId,
				shortCode: input.shortCode,
			});
		}),
};
