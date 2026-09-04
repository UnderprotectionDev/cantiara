import { protectedProcedure, protectedWriteProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import {
	bindEvidence,
	convertToNewRecordAndBind,
	getEvidencePin,
	listEvidenceOnSource,
	listEvidenceOnTarget,
	listEvidenceOnTargetSurface,
	presentEvidenceShare,
	previewBindEvidence,
	previewConvertEvidence,
	previewRebindEvidence,
	rebindEvidence,
	redactEvidenceContent,
	setEvidenceFounderInterpretation,
	setEvidenceRole,
} from "./evidence";
import {
	bindEvidenceCommandSchema,
	CONVERT_RECORD_KINDS,
	convertEvidenceCommandSchema,
	EVIDENCE_COPY,
	EVIDENCE_ROLES,
	previewBindEvidenceInputSchema,
	previewConvertEvidenceInputSchema,
	previewRebindEvidenceInputSchema,
	rebindEvidenceCommandSchema,
	redactEvidenceCommandSchema,
	setEvidenceFounderInterpretationCommandSchema,
	setEvidenceRoleCommandSchema,
} from "./evidence-model";

async function requireAccess(userId: string) {
	const access = await getAccountAccessForUser(getPrismaClient(), userId);
	if (!access) {
		throw new ORPCError("UNAUTHORIZED");
	}
	return access;
}

export const evidence = {
	bind: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string().min(1),
				payload: bindEvidenceCommandSchema.shape.payload,
				previewAcknowledged: z.boolean().optional(),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await bindEvidence(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
				previewAcknowledged: input.previewAcknowledged,
				workspaceId: access.workspaceId,
			});
		}),
	catalog: protectedProcedure.handler(() => ({
		convertRecordKinds: CONVERT_RECORD_KINDS,
		copy: EVIDENCE_COPY,
		roles: EVIDENCE_ROLES,
	})),
	convert: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string().min(1),
				payload: convertEvidenceCommandSchema.shape.payload,
				previewAcknowledged: z.boolean().optional(),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await convertToNewRecordAndBind(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
				previewAcknowledged: input.previewAcknowledged,
				workspaceId: access.workspaceId,
			});
		}),
	get: protectedProcedure
		.input(z.object({ pinId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const pin = await getEvidencePin(
				getPrismaClient(),
				input.pinId,
				access.workspaceId
			);
			if (!pin) {
				throw new ORPCError("NOT_FOUND");
			}
			return pin;
		}),
	listOnSource: protectedProcedure
		.input(
			z.object({
				sourceId: z.string().min(1),
				sourceKind: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			await requireAccess(context.session.user.id);
			return await listEvidenceOnSource(
				getPrismaClient(),
				input.sourceKind,
				input.sourceId
			);
		}),
	listOnTarget: protectedProcedure
		.input(
			z.object({
				targetId: z.string().min(1),
				targetKind: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			await requireAccess(context.session.user.id);
			return await listEvidenceOnTarget(
				getPrismaClient(),
				input.targetKind,
				input.targetId
			);
		}),
	previewBind: protectedProcedure
		.input(previewBindEvidenceInputSchema.omit({ workspaceId: true }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await previewBindEvidence(getPrismaClient(), {
				...input,
				workspaceId: access.workspaceId,
			});
		}),
	previewConvert: protectedProcedure
		.input(previewConvertEvidenceInputSchema.omit({ workspaceId: true }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await previewConvertEvidence(getPrismaClient(), {
				...input,
				workspaceId: access.workspaceId,
			});
		}),
	previewRebind: protectedProcedure
		.input(previewRebindEvidenceInputSchema.omit({ workspaceId: true }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await previewRebindEvidence(getPrismaClient(), {
				...input,
				workspaceId: access.workspaceId,
			});
		}),
	rebind: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string().min(1),
				payload: rebindEvidenceCommandSchema.shape.payload,
				previewAcknowledged: z.boolean().optional(),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await rebindEvidence(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
				previewAcknowledged: input.previewAcknowledged,
				workspaceId: access.workspaceId,
			});
		}),
	redact: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string().min(1),
				payload: redactEvidenceCommandSchema.shape.payload,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await redactEvidenceContent(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
				workspaceId: access.workspaceId,
			});
		}),
	setFounderInterpretation: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string().min(1),
				payload: setEvidenceFounderInterpretationCommandSchema.shape.payload,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await setEvidenceFounderInterpretation(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
				workspaceId: access.workspaceId,
			});
		}),
	setRole: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string().min(1),
				payload: setEvidenceRoleCommandSchema.shape.payload,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await setEvidenceRole(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
				workspaceId: access.workspaceId,
			});
		}),
	share: protectedProcedure
		.input(
			z.object({
				audience: z.enum(["inaccessible", "owner"]),
				pinId: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const pin = await getEvidencePin(
				getPrismaClient(),
				input.pinId,
				access.workspaceId
			);
			if (!pin) {
				throw new ORPCError("NOT_FOUND");
			}
			return presentEvidenceShare(pin, { audience: input.audience });
		}),
	surfaceOnTarget: protectedProcedure
		.input(
			z.object({
				targetId: z.string().min(1),
				targetKind: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			await requireAccess(context.session.user.id);
			return await listEvidenceOnTargetSurface(
				getPrismaClient(),
				input.targetKind,
				input.targetId
			);
		}),
};
