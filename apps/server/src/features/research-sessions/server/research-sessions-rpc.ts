import { protectedProcedure, protectedWriteProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { getProject } from "../../project-shell/server/project-shell";
import {
	attachFileToSession,
	createResearchSession,
	getResearchSession,
	includeInShare,
	listResearchSessions,
	previewClosedWorld,
	searchResearchSessions,
	setConsent,
	setParticipant,
	setStatus,
	updateNote,
	writeAttributedQuote,
	writeFounderInterpretation,
	writeObservation,
} from "./research-sessions";
import {
	convertToNewRecord,
	previewConvert,
} from "./research-sessions-convert";
import {
	attachFilePayloadSchema,
	CONSENT_VALUES,
	convertPayloadSchema,
	createResearchSessionPayloadSchema,
	includeInSharePayloadSchema,
	previewConvertInputSchema,
	RESEARCH_SESSION_STATUSES,
	RESEARCH_SESSIONS_COPY,
	setConsentPayloadSchema,
	setParticipantPayloadSchema,
	setStatusPayloadSchema,
	updateNotePayloadSchema,
	writeNotePayloadSchema,
} from "./research-sessions-model";

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

async function requireSession(workspaceId: string, sessionId: string) {
	const session = await getResearchSession(getPrismaClient(), sessionId);
	if (!session) {
		throw new ORPCError("NOT_FOUND");
	}
	await requireProject(workspaceId, session.projectId);
	return session;
}

export const researchSessions = {
	attachFile: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				idempotencyKey: z.string(),
				payload: attachFilePayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireSession(access.workspaceId, input.payload.sessionId);
			return await attachFileToSession(getPrismaClient(), {
				actorId: context.session.user.id,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	catalog: protectedProcedure.handler(() => RESEARCH_SESSIONS_COPY),
	convert: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative().optional(),
				idempotencyKey: z.string(),
				payload: convertPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireSession(access.workspaceId, input.payload.sessionId);
			return await convertToNewRecord(getPrismaClient(), {
				actorId: context.session.user.id,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	create: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: createResearchSessionPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.payload.projectId);
			return await createResearchSession(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	get: protectedProcedure
		.input(z.object({ sessionId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await requireSession(access.workspaceId, input.sessionId);
		}),
	includeInShare: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: includeInSharePayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireSession(access.workspaceId, input.payload.sessionId);
			return await includeInShare(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	list: protectedProcedure
		.input(
			z.object({
				consent: z.enum(CONSENT_VALUES).optional(),
				projectId: z.string().min(1),
				status: z.enum(RESEARCH_SESSION_STATUSES).optional(),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.projectId);
			return await listResearchSessions(getPrismaClient(), input.projectId, {
				consent: input.consent,
				status: input.status,
			});
		}),
	previewClosedWorld: protectedProcedure
		.input(z.object({ sessionId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireSession(access.workspaceId, input.sessionId);
			return await previewClosedWorld(getPrismaClient(), input.sessionId);
		}),
	previewConvert: protectedProcedure
		.input(previewConvertInputSchema)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireSession(access.workspaceId, input.sessionId);
			return await previewConvert(getPrismaClient(), input);
		}),
	search: protectedProcedure
		.input(
			z.object({
				projectId: z.string().min(1),
				text: z.string(),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.projectId);
			return await searchResearchSessions(getPrismaClient(), {
				projectId: input.projectId,
				text: input.text,
			});
		}),
	setConsent: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				idempotencyKey: z.string(),
				payload: setConsentPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireSession(access.workspaceId, input.payload.sessionId);
			return await setConsent(getPrismaClient(), {
				actorId: context.session.user.id,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	setParticipant: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				idempotencyKey: z.string(),
				payload: setParticipantPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireSession(access.workspaceId, input.payload.sessionId);
			return await setParticipant(getPrismaClient(), {
				actorId: context.session.user.id,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	setStatus: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				idempotencyKey: z.string(),
				payload: setStatusPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireSession(access.workspaceId, input.payload.sessionId);
			return await setStatus(getPrismaClient(), {
				actorId: context.session.user.id,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	updateNote: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				idempotencyKey: z.string(),
				payload: updateNotePayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireSession(access.workspaceId, input.payload.sessionId);
			return await updateNote(getPrismaClient(), {
				actorId: context.session.user.id,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	writeFounderInterpretation: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				idempotencyKey: z.string(),
				payload: writeNotePayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireSession(access.workspaceId, input.payload.sessionId);
			return await writeFounderInterpretation(getPrismaClient(), {
				actorId: context.session.user.id,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	writeObservation: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				idempotencyKey: z.string(),
				payload: writeNotePayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireSession(access.workspaceId, input.payload.sessionId);
			return await writeObservation(getPrismaClient(), {
				actorId: context.session.user.id,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	writeQuote: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				idempotencyKey: z.string(),
				payload: writeNotePayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireSession(access.workspaceId, input.payload.sessionId);
			return await writeAttributedQuote(getPrismaClient(), {
				actorId: context.session.user.id,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
};
