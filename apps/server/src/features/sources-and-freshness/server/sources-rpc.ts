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
	inspectSourceFreshness,
	keepSourceEvidenceUse,
	rebindSourceEvidenceUse,
} from "./sources-evidence";
import {
	createSourcePayloadSchema,
	keepCurrentVersionCommandSchema,
	recheckSourceCommandSchema,
	SOURCES_COPY,
	saveCheckVersionCommandSchema,
	saveSourceVersionPayloadSchema,
	sourceEvidenceUseCommandSchema,
} from "./sources-model";
import { previewSmartLink } from "./sources-preview";
import {
	compareSourceCheck,
	keepCurrentSourceVersion,
	previewRecheck,
	recheckSource,
	saveCheckAsNewSourceVersion,
} from "./sources-recheck";

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

async function requireSource(workspaceId: string, sourceId: string) {
	const source = await getSource(getPrismaClient(), sourceId);
	if (!source) {
		throw new ORPCError("NOT_FOUND");
	}
	await requireProject(workspaceId, source.projectId);
	return source;
}

export const sources = {
	catalog: protectedProcedure.handler(() => SOURCES_COPY),
	compareCheck: protectedProcedure
		.input(z.object({ checkId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const compare = await compareSourceCheck(
				getPrismaClient(),
				input.checkId
			);
			if (!compare) {
				throw new ORPCError("NOT_FOUND");
			}
			const check = await getPrismaClient().sourceCheck.findUnique({
				where: { id: input.checkId },
			});
			if (!check) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireSource(access.workspaceId, check.sourceId);
			return compare;
		}),
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
	freshness: protectedProcedure
		.input(z.object({ sourceId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireSource(access.workspaceId, input.sourceId);
			const freshness = await inspectSourceFreshness(
				getPrismaClient(),
				input.sourceId
			);
			if (!freshness) {
				throw new ORPCError("NOT_FOUND");
			}
			return freshness;
		}),
	get: protectedProcedure
		.input(z.object({ sourceId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await requireSource(access.workspaceId, input.sourceId);
		}),
	keepCurrentVersion: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: keepCurrentVersionCommandSchema.shape.payload,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const check = await getPrismaClient().sourceCheck.findUnique({
				where: { id: input.payload.checkId },
			});
			if (!check) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireSource(access.workspaceId, check.sourceId);
			return await keepCurrentSourceVersion(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	keepEvidenceUse: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: sourceEvidenceUseCommandSchema.shape.payload,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const pin = await getPrismaClient().sourceEvidencePin.findUnique({
				where: { id: input.payload.pinId },
			});
			if (!pin) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireSource(access.workspaceId, pin.sourceId);
			return await keepSourceEvidenceUse(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
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
	rebindEvidenceUse: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: sourceEvidenceUseCommandSchema.shape.payload,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const pin = await getPrismaClient().sourceEvidencePin.findUnique({
				where: { id: input.payload.pinId },
			});
			if (!pin) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireSource(access.workspaceId, pin.sourceId);
			return await rebindSourceEvidenceUse(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	recheck: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: recheckSourceCommandSchema.shape.payload,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireSource(access.workspaceId, input.payload.sourceId);
			return await recheckSource(
				getPrismaClient(),
				{
					actorId: context.session.user.id,
					idempotencyKey: input.idempotencyKey,
					origin: "human",
					payload: input.payload,
				},
				{ transport: undiciHopTransport }
			);
		}),
	recheckPreview: protectedProcedure
		.input(z.object({ sourceId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireSource(access.workspaceId, input.sourceId);
			const preview = await previewRecheck(getPrismaClient(), input.sourceId);
			if (!preview) {
				throw new ORPCError("NOT_FOUND");
			}
			return preview;
		}),
	saveCheckVersion: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				idempotencyKey: z.string(),
				payload: saveCheckVersionCommandSchema.shape.payload,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const check = await getPrismaClient().sourceCheck.findUnique({
				where: { id: input.payload.checkId },
			});
			if (!check) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireSource(access.workspaceId, check.sourceId);
			return await saveCheckAsNewSourceVersion(getPrismaClient(), {
				actorId: context.session.user.id,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
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
			await requireSource(access.workspaceId, input.payload.sourceId);
			return await saveSourceVersion(getPrismaClient(), {
				actorId: context.session.user.id,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
};
