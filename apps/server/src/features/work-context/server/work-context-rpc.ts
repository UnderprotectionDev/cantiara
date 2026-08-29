import { protectedProcedure, protectedWriteProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { getProject } from "../../project-shell/server/project-shell";
import { WORK_TYPES } from "../../work-lifecycle/server/work-lifecycle-model";
import { loadWorkContextCard, loadWorkContextCopy } from "./work-context";
import {
	applyWorkContextLayout,
	getWorkContextCardLayout,
	previewWorkContextLayoutChange,
	undoWorkContextLayout,
} from "./work-context-layout";
import {
	applyWorkContextLayoutPayloadSchema,
	defaultLayoutSections,
	workContextLayoutCatalog,
} from "./work-context-model";

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

const workTypeSchema = z.enum(WORK_TYPES);

export const workContext = {
	applyLayout: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: applyWorkContextLayoutPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.payload.projectId);
			return await applyWorkContextLayout(getPrismaClient(), {
				actorId: access.accountId,
				idempotencyKey: input.idempotencyKey,
				payload: input.payload,
			});
		}),
	catalog: protectedProcedure.handler(() => workContextLayoutCatalog()),
	copyMarkdown: protectedProcedure
		.input(
			z.object({
				workId: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const copy = await loadWorkContextCopy(getPrismaClient(), {
				viewerWorkspaceId: access.workspaceId,
				workId: input.workId,
			});
			if (!copy) {
				throw new ORPCError("NOT_FOUND");
			}
			return copy;
		}),
	get: protectedProcedure
		.input(
			z.object({
				revealedSections: z.array(z.string()).optional(),
				workId: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const card = await loadWorkContextCard(getPrismaClient(), {
				revealedSections: input.revealedSections,
				viewerWorkspaceId: access.workspaceId,
				workId: input.workId,
			});
			if (!card) {
				throw new ORPCError("NOT_FOUND");
			}
			return card;
		}),
	getLayout: protectedProcedure
		.input(
			z.object({
				projectId: z.string().min(1),
				workType: workTypeSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.projectId);
			return await getWorkContextCardLayout(
				getPrismaClient(),
				input.projectId,
				input.workType
			);
		}),
	previewLayout: protectedProcedure
		.input(
			z.object({
				projectId: z.string().min(1),
				sections: applyWorkContextLayoutPayloadSchema.shape.sections,
				workType: workTypeSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.projectId);
			const current = await getWorkContextCardLayout(
				getPrismaClient(),
				input.projectId,
				input.workType
			);
			return previewWorkContextLayoutChange(
				current.sections.length > 0
					? current.sections
					: defaultLayoutSections(input.workType),
				input.sections,
				input.workType
			);
		}),
	undoLayout: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				projectId: z.string().min(1),
				workType: workTypeSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.projectId);
			return await undoWorkContextLayout(getPrismaClient(), {
				actorId: access.accountId,
				idempotencyKey: input.idempotencyKey,
				projectId: input.projectId,
				workType: input.workType,
			});
		}),
};
