import { protectedProcedure, protectedWriteProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { getProject } from "../../project-shell/server/project-shell";
import { getSource } from "../../sources-and-freshness/server/sources";
import { getWork } from "../../work-lifecycle/server/work-lifecycle";
import {
	bindFeedbackEvidence,
	bindFeedbackOrigin,
	convertFeedbackToWork,
	createFeedback,
	createFeedbackFromSource,
	getFeedback,
	listFeedback,
	listFeedbackEvidence,
	previewConvertFeedbackToWork,
	setFeedbackEvidenceFollowUp,
	setFeedbackEvidenceQuality,
	setFeedbackEvidenceRole,
	setFeedbackStatus,
} from "./feedback";
import {
	bindFeedbackEvidencePayloadSchema,
	bindFeedbackOriginPayloadSchema,
	convertFeedbackToWorkPayloadSchema,
	createFeedbackFromSourcePayloadSchema,
	createFeedbackPayloadSchema,
	FEEDBACK_STATUSES,
	feedbackCatalog,
	listFeedbackEvidenceInputSchema,
	previewConvertFeedbackToWorkInputSchema,
	setFeedbackEvidenceFollowUpPayloadSchema,
	setFeedbackEvidenceQualityPayloadSchema,
	setFeedbackEvidenceRolePayloadSchema,
	setFeedbackStatusPayloadSchema,
} from "./feedback-model";

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

export const feedback = {
	bindEvidence: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: bindFeedbackEvidencePayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const record = await getFeedback(
				getPrismaClient(),
				input.payload.feedbackId
			);
			if (!record) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireProject(access.workspaceId, record.projectId);
			return await bindFeedbackEvidence(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
				viewerWorkspaceId: access.workspaceId,
			});
		}),
	bindOrigin: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: bindFeedbackOriginPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const record = await getFeedback(
				getPrismaClient(),
				input.payload.feedbackId
			);
			if (!record) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireProject(access.workspaceId, record.projectId);
			return await bindFeedbackOrigin(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
				viewerWorkspaceId: access.workspaceId,
			});
		}),
	catalog: protectedProcedure.handler(() => feedbackCatalog()),
	convertToWork: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: convertFeedbackToWorkPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const record = await getFeedback(
				getPrismaClient(),
				input.payload.feedbackId
			);
			if (!record) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireProject(access.workspaceId, record.projectId);
			if (input.payload.projectId) {
				await requireProject(access.workspaceId, input.payload.projectId);
			}
			return await convertFeedbackToWork(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
				viewerWorkspaceId: access.workspaceId,
			});
		}),
	create: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: createFeedbackPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.payload.projectId);
			return await createFeedback(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
				viewerWorkspaceId: access.workspaceId,
			});
		}),
	createFromSource: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: createFeedbackFromSourcePayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const source = await getSource(getPrismaClient(), input.payload.sourceId);
			if (!source) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireProject(access.workspaceId, source.projectId);
			return await createFeedbackFromSource(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
				viewerWorkspaceId: access.workspaceId,
			});
		}),
	get: protectedProcedure
		.input(z.object({ feedbackId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const record = await getFeedback(getPrismaClient(), input.feedbackId);
			if (!record) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireProject(access.workspaceId, record.projectId);
			return record;
		}),
	list: protectedProcedure
		.input(
			z.object({
				projectId: z.string().min(1),
				status: z.enum(FEEDBACK_STATUSES).optional(),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.projectId);
			return await listFeedback(getPrismaClient(), input.projectId, {
				status: input.status,
			});
		}),
	listEvidence: protectedProcedure
		.input(listFeedbackEvidenceInputSchema)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			if (input.feedbackId) {
				const record = await getFeedback(getPrismaClient(), input.feedbackId);
				if (!record) {
					throw new ORPCError("NOT_FOUND");
				}
				await requireProject(access.workspaceId, record.projectId);
			}
			if (input.workId) {
				const work = await getWork(getPrismaClient(), input.workId);
				if (!work) {
					throw new ORPCError("NOT_FOUND");
				}
				await requireProject(access.workspaceId, work.projectId);
			}
			return await listFeedbackEvidence(getPrismaClient(), input);
		}),
	previewConvertToWork: protectedProcedure
		.input(previewConvertFeedbackToWorkInputSchema)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const record = await getFeedback(getPrismaClient(), input.feedbackId);
			if (!record) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireProject(access.workspaceId, record.projectId);
			if (input.projectId) {
				await requireProject(access.workspaceId, input.projectId);
			}
			return await previewConvertFeedbackToWork(getPrismaClient(), input);
		}),
	setEvidenceFollowUp: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: setFeedbackEvidenceFollowUpPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const record = await getFeedback(
				getPrismaClient(),
				input.payload.feedbackId
			);
			if (!record) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireProject(access.workspaceId, record.projectId);
			return await setFeedbackEvidenceFollowUp(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
				viewerWorkspaceId: access.workspaceId,
			});
		}),
	setEvidenceQuality: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: setFeedbackEvidenceQualityPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const record = await getFeedback(
				getPrismaClient(),
				input.payload.feedbackId
			);
			if (!record) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireProject(access.workspaceId, record.projectId);
			return await setFeedbackEvidenceQuality(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
				viewerWorkspaceId: access.workspaceId,
			});
		}),
	setEvidenceRole: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: setFeedbackEvidenceRolePayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const record = await getFeedback(
				getPrismaClient(),
				input.payload.feedbackId
			);
			if (!record) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireProject(access.workspaceId, record.projectId);
			return await setFeedbackEvidenceRole(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
				viewerWorkspaceId: access.workspaceId,
			});
		}),
	setStatus: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				idempotencyKey: z.string(),
				payload: setFeedbackStatusPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const record = await getFeedback(
				getPrismaClient(),
				input.payload.feedbackId
			);
			if (!record) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireProject(access.workspaceId, record.projectId);
			return await setFeedbackStatus(getPrismaClient(), {
				actorId: context.session.user.id,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
};
