import { protectedProcedure, protectedWriteProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { getProject } from "../../project-shell/server/project-shell";
import { createScreen, listScreensForProject } from "./screen-double";
import {
	applyEditorOp,
	bindOutlineScreen,
	createUserFlow,
	getPersonalViewport,
	getUserFlow,
	groupOutline,
	listUserFlows,
	placeFlowNode,
	placeScreenNode,
	reorderOutline,
	savePersonalViewport,
	unbindOutlineScreen,
	updateNodePathText,
} from "./user-flow";
import {
	convertAndBind,
	instantiateUserFlowTemplate,
	listUserFlowTemplates,
	moveLiveCard,
	placeLiveCard,
	previewConvertAndBind,
	previewRebindOrigin,
	promoteStepToScreen,
	rebindOrigin,
	removeLiveCard,
	saveUserFlowTemplate,
} from "./user-flow-bind";
import { userFlowCatalog } from "./user-flow-editor";
import {
	applyEditorOpPayloadSchema,
	bindOutlineScreenPayloadSchema,
	convertAndBindPayloadSchema,
	createScreenPayloadSchema,
	createUserFlowPayloadSchema,
	groupOutlinePayloadSchema,
	instantiateUserFlowTemplatePayloadSchema,
	moveLiveCardPayloadSchema,
	placeFlowNodePayloadSchema,
	placeLiveCardPayloadSchema,
	placeScreenNodePayloadSchema,
	previewConvertAndBindInputSchema,
	previewRebindOriginInputSchema,
	promoteStepToScreenPayloadSchema,
	rebindOriginPayloadSchema,
	removeLiveCardPayloadSchema,
	reorderOutlinePayloadSchema,
	savePersonalViewportPayloadSchema,
	saveUserFlowTemplatePayloadSchema,
	unbindOutlineScreenPayloadSchema,
	updateNodePathTextPayloadSchema,
} from "./user-flow-model";

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

export const userFlow = {
	applyEditorOp: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				idempotencyKey: z.string(),
				payload: applyEditorOpPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const flow = await getUserFlow(getPrismaClient(), {
				userFlowId: input.payload.userFlowId,
				workspaceId: access.workspaceId,
			});
			if (!flow) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireProject(access.workspaceId, flow.projectId);
			return await applyEditorOp(getPrismaClient(), {
				actorId: context.session.user.id,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	bindOutlineScreen: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				idempotencyKey: z.string(),
				payload: bindOutlineScreenPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const flow = await getUserFlow(getPrismaClient(), {
				userFlowId: input.payload.userFlowId,
				workspaceId: access.workspaceId,
			});
			if (!flow) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireProject(access.workspaceId, flow.projectId);
			return await bindOutlineScreen(getPrismaClient(), {
				actorId: context.session.user.id,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	catalog: protectedProcedure.handler(() => userFlowCatalog()),
	convertAndBind: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				idempotencyKey: z.string(),
				payload: convertAndBindPayloadSchema,
				previewAcknowledged: z.boolean(),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const flow = await getUserFlow(getPrismaClient(), {
				userFlowId: input.payload.userFlowId,
				workspaceId: access.workspaceId,
			});
			if (!flow) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireProject(access.workspaceId, flow.projectId);
			return await convertAndBind(getPrismaClient(), {
				actorId: context.session.user.id,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
				previewAcknowledged: input.previewAcknowledged,
			});
		}),
	create: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: createUserFlowPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.payload.projectId);
			return await createUserFlow(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	createScreen: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: createScreenPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.payload.projectId);
			return await createScreen(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	get: protectedProcedure
		.input(z.object({ userFlowId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const flow = await getUserFlow(getPrismaClient(), {
				userFlowId: input.userFlowId,
				workspaceId: access.workspaceId,
			});
			if (!flow) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireProject(access.workspaceId, flow.projectId);
			return flow;
		}),
	getViewport: protectedProcedure
		.input(z.object({ userFlowId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const viewport = await getPersonalViewport(getPrismaClient(), {
				actorId: context.session.user.id,
				userFlowId: input.userFlowId,
				workspaceId: access.workspaceId,
			});
			if (!viewport) {
				throw new ORPCError("NOT_FOUND");
			}
			return viewport;
		}),
	groupOutline: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				idempotencyKey: z.string(),
				payload: groupOutlinePayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const flow = await getUserFlow(getPrismaClient(), {
				userFlowId: input.payload.userFlowId,
				workspaceId: access.workspaceId,
			});
			if (!flow) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireProject(access.workspaceId, flow.projectId);
			return await groupOutline(getPrismaClient(), {
				actorId: context.session.user.id,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	instantiateTemplate: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: instantiateUserFlowTemplatePayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.payload.projectId);
			return await instantiateUserFlowTemplate(getPrismaClient(), {
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
			return await listUserFlows(getPrismaClient(), {
				projectId: input.projectId,
				workspaceId: access.workspaceId,
			});
		}),
	listScreens: protectedProcedure
		.input(z.object({ projectId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.projectId);
			return await listScreensForProject(getPrismaClient(), input.projectId);
		}),
	listTemplates: protectedProcedure.handler(async ({ context }) => {
		const access = await requireAccess(context.session.user.id);
		return await listUserFlowTemplates(getPrismaClient(), access.workspaceId);
	}),
	moveLiveCard: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				idempotencyKey: z.string(),
				payload: moveLiveCardPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const flow = await getUserFlow(getPrismaClient(), {
				userFlowId: input.payload.userFlowId,
				workspaceId: access.workspaceId,
			});
			if (!flow) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireProject(access.workspaceId, flow.projectId);
			return await moveLiveCard(getPrismaClient(), {
				actorId: context.session.user.id,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	placeFlowNode: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				idempotencyKey: z.string(),
				payload: placeFlowNodePayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const flow = await getUserFlow(getPrismaClient(), {
				userFlowId: input.payload.userFlowId,
				workspaceId: access.workspaceId,
			});
			if (!flow) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireProject(access.workspaceId, flow.projectId);
			return await placeFlowNode(getPrismaClient(), {
				actorId: context.session.user.id,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	placeLiveCard: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				idempotencyKey: z.string(),
				payload: placeLiveCardPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const flow = await getUserFlow(getPrismaClient(), {
				userFlowId: input.payload.userFlowId,
				workspaceId: access.workspaceId,
			});
			if (!flow) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireProject(access.workspaceId, flow.projectId);
			return await placeLiveCard(getPrismaClient(), {
				actorId: context.session.user.id,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	placeScreenNode: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				idempotencyKey: z.string(),
				payload: placeScreenNodePayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const flow = await getUserFlow(getPrismaClient(), {
				userFlowId: input.payload.userFlowId,
				workspaceId: access.workspaceId,
			});
			if (!flow) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireProject(access.workspaceId, flow.projectId);
			return await placeScreenNode(getPrismaClient(), {
				actorId: context.session.user.id,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	previewConvertAndBind: protectedProcedure
		.input(previewConvertAndBindInputSchema.omit({ workspaceId: true }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await previewConvertAndBind(getPrismaClient(), {
				...input,
				workspaceId: access.workspaceId,
			});
		}),
	previewRebindOrigin: protectedProcedure
		.input(previewRebindOriginInputSchema.omit({ workspaceId: true }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await previewRebindOrigin(getPrismaClient(), {
				...input,
				workspaceId: access.workspaceId,
			});
		}),
	promoteStepToScreen: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				idempotencyKey: z.string(),
				payload: promoteStepToScreenPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const flow = await getUserFlow(getPrismaClient(), {
				userFlowId: input.payload.userFlowId,
				workspaceId: access.workspaceId,
			});
			if (!flow) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireProject(access.workspaceId, flow.projectId);
			return await promoteStepToScreen(getPrismaClient(), {
				actorId: context.session.user.id,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	rebindOrigin: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: rebindOriginPayloadSchema,
				previewAcknowledged: z.boolean(),
			})
		)
		.handler(async ({ context, input }) => {
			await requireAccess(context.session.user.id);
			return await rebindOrigin(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
				previewAcknowledged: input.previewAcknowledged,
			});
		}),
	removeLiveCard: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				idempotencyKey: z.string(),
				payload: removeLiveCardPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const flow = await getUserFlow(getPrismaClient(), {
				userFlowId: input.payload.userFlowId,
				workspaceId: access.workspaceId,
			});
			if (!flow) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireProject(access.workspaceId, flow.projectId);
			return await removeLiveCard(getPrismaClient(), {
				actorId: context.session.user.id,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	reorderOutline: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				idempotencyKey: z.string(),
				payload: reorderOutlinePayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const flow = await getUserFlow(getPrismaClient(), {
				userFlowId: input.payload.userFlowId,
				workspaceId: access.workspaceId,
			});
			if (!flow) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireProject(access.workspaceId, flow.projectId);
			return await reorderOutline(getPrismaClient(), {
				actorId: context.session.user.id,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	saveTemplate: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: saveUserFlowTemplatePayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const flow = await getUserFlow(getPrismaClient(), {
				userFlowId: input.payload.userFlowId,
				workspaceId: access.workspaceId,
			});
			if (!flow) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireProject(access.workspaceId, flow.projectId);
			return await saveUserFlowTemplate(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	saveViewport: protectedWriteProcedure
		.input(z.object({ payload: savePersonalViewportPayloadSchema }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const flow = await getUserFlow(getPrismaClient(), {
				userFlowId: input.payload.userFlowId,
				workspaceId: access.workspaceId,
			});
			if (!flow) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireProject(access.workspaceId, flow.projectId);
			return await savePersonalViewport(getPrismaClient(), {
				actorId: context.session.user.id,
				payload: input.payload,
			});
		}),
	unbindOutlineScreen: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				idempotencyKey: z.string(),
				payload: unbindOutlineScreenPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const flow = await getUserFlow(getPrismaClient(), {
				userFlowId: input.payload.userFlowId,
				workspaceId: access.workspaceId,
			});
			if (!flow) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireProject(access.workspaceId, flow.projectId);
			return await unbindOutlineScreen(getPrismaClient(), {
				actorId: context.session.user.id,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	updateNodePathText: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				idempotencyKey: z.string(),
				payload: updateNodePathTextPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const flow = await getUserFlow(getPrismaClient(), {
				userFlowId: input.payload.userFlowId,
				workspaceId: access.workspaceId,
			});
			if (!flow) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireProject(access.workspaceId, flow.projectId);
			return await updateNodePathText(getPrismaClient(), {
				actorId: context.session.user.id,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
};
