import { protectedProcedure, protectedWriteProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { getProject } from "../../project-shell/server/project-shell";
import { createRisk, getRisk, listRisks, setRiskStatus } from "./risks";
import {
	createRiskPayloadSchema,
	RISK_STATUSES,
	RISKS_COPY,
	setRiskStatusPayloadSchema,
} from "./risks-model";

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

export const risks = {
	catalog: protectedProcedure.handler(() => RISKS_COPY),
	create: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: createRiskPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.payload.projectId);
			return await createRisk(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	get: protectedProcedure
		.input(z.object({ riskId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const risk = await getRisk(getPrismaClient(), input.riskId);
			if (!risk) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireProject(access.workspaceId, risk.projectId);
			return risk;
		}),
	list: protectedProcedure
		.input(
			z.object({
				projectId: z.string().min(1),
				status: z.enum(RISK_STATUSES).optional(),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.projectId);
			return await listRisks(getPrismaClient(), input.projectId, {
				status: input.status,
			});
		}),
	setStatus: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				idempotencyKey: z.string(),
				payload: setRiskStatusPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const risk = await getRisk(getPrismaClient(), input.payload.riskId);
			if (!risk) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireProject(access.workspaceId, risk.projectId);
			return await setRiskStatus(getPrismaClient(), {
				actorId: context.session.user.id,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
};
