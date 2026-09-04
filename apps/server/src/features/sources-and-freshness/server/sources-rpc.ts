import { protectedProcedure, protectedWriteProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { getProject } from "../../project-shell/server/project-shell";
import { undiciHopTransport } from "./isolated-egress-undici";
import {
	createSource,
	getSource,
	listSources,
	saveSourceVersion,
} from "./sources";
import {
	createSourcePayloadSchema,
	SOURCES_COPY,
	saveSourceVersionPayloadSchema,
} from "./sources-model";
import { previewSmartLink } from "./sources-preview";

async function requireAccess(userId: string) {
	const access = await getAccountAccessForUser(getPrismaClient(), userId);
	if (!access) {
		throw new ORPCError("UNAUTHORIZED");
	}
	return access;
}

async function requireProject(workspaceId: string, projectId: string) {
	const project = await getProject(getPrismaClient(), projectId);
	if (!project || project.workspaceId !== workspaceId) {
		throw new ORPCError("NOT_FOUND");
	}
	return project;
}

export const sources = {
	catalog: protectedProcedure.handler(() => SOURCES_COPY),
	create: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: createSourcePayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.payload.projectId);
			return await createSource(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	get: protectedProcedure
		.input(z.object({ sourceId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const source = await getSource(getPrismaClient(), input.sourceId);
			if (!source) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireProject(access.workspaceId, source.projectId);
			return source;
		}),
	list: protectedProcedure
		.input(z.object({ projectId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.projectId);
			return await listSources(getPrismaClient(), input.projectId);
		}),
	preview: protectedProcedure
		.input(z.object({ url: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			await requireAccess(context.session.user.id);
			return await previewSmartLink(input.url, {
				transport: undiciHopTransport,
			});
		}),
	saveVersion: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				idempotencyKey: z.string(),
				payload: saveSourceVersionPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const source = await getSource(getPrismaClient(), input.payload.sourceId);
			if (!source) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireProject(access.workspaceId, source.projectId);
			return await saveSourceVersion(getPrismaClient(), {
				actorId: context.session.user.id,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
};
