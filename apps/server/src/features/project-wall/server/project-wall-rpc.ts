import { protectedProcedure, protectedWriteProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { getProject } from "../../project-shell/server/project-shell";
import {
	createProjectWall,
	createRegionSnapshot,
	getProjectWall,
	listProjectWalls,
	placeLiveCard,
	previewRegionSnapshot,
	saveFocusOrder,
	updateCardDensity,
	updateCardLayout,
} from "./project-wall";
import {
	createProjectWallPayloadSchema,
	PROJECT_WALL_SOURCE_KIND,
	placeLiveCardPayloadSchema,
	projectWallCatalog,
	regionSnapshotPayloadSchema,
	saveFocusOrderPayloadSchema,
	updateCardDensityPayloadSchema,
	updateCardLayoutPayloadSchema,
} from "./project-wall-model";

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

async function requireWall(workspaceId: string, wallId: string) {
	const wall = await getProjectWall(getPrismaClient(), wallId);
	if (!wall) {
		throw new ORPCError("NOT_FOUND");
	}
	await requireProject(workspaceId, wall.projectId);
	return wall;
}

export const projectWall = {
	catalog: protectedProcedure.handler(() => projectWallCatalog()),
	create: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: createProjectWallPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			if (input.payload.projectId) {
				await requireProject(access.workspaceId, input.payload.projectId);
			}
			return await createProjectWall(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	get: protectedProcedure
		.input(z.object({ wallId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await requireWall(access.workspaceId, input.wallId);
		}),
	list: protectedProcedure
		.input(z.object({ projectId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.projectId);
			return await listProjectWalls(getPrismaClient(), input.projectId);
		}),
	listTechnicalDiagrams: protectedProcedure
		.input(z.object({ projectId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.projectId);
			return await getPrismaClient().design.findMany({
				orderBy: { createdAt: "asc" },
				where: {
					projectId: input.projectId,
					type: PROJECT_WALL_SOURCE_KIND.technicalDiagram,
				},
			});
		}),
	placeLiveCard: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: placeLiveCardPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWall(access.workspaceId, input.payload.wallId);
			return await placeLiveCard(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	previewSnapshot: protectedProcedure
		.input(regionSnapshotPayloadSchema)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWall(access.workspaceId, input.wallId);
			const preview = await previewRegionSnapshot(getPrismaClient(), input);
			if (preview.status !== "ok") {
				return preview;
			}
			const { status, ...snapshot } = preview;
			return { ...presentSnapshot(snapshot), status };
		}),
	saveFocusOrder: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: saveFocusOrderPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWall(access.workspaceId, input.payload.wallId);
			return await saveFocusOrder(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	snapshot: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: regionSnapshotPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWall(access.workspaceId, input.payload.wallId);
			const created = await createRegionSnapshot(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
			if (created.status !== "committed") {
				return created;
			}
			return {
				snapshot: presentSnapshot(created.snapshot),
				status: created.status,
			};
		}),
	updateDensity: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: updateCardDensityPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWall(access.workspaceId, input.payload.wallId);
			return await updateCardDensity(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	updateLayout: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: updateCardLayoutPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWall(access.workspaceId, input.payload.wallId);
			return await updateCardLayout(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
};

function encodeBytes(bytes: Uint8Array): string {
	return Buffer.from(bytes).toString("base64");
}

function presentSnapshot(snapshot: {
	bytes?: Uint8Array;
	capturedAt: string;
	images?: { bytes: Uint8Array }[];
	kind: string;
	liveSourceLink: false;
	notice: string;
	opensBuildInPublic: false;
	opensLinkSharing: false;
	pages?: { title: string }[];
	shareGrant: false;
	titles: string[];
	wallLocked: false;
}) {
	return {
		capturedAt: snapshot.capturedAt,
		images: snapshot.images?.map((image) => ({
			bytes: encodeBytes(image.bytes),
		})),
		kind: snapshot.kind,
		liveSourceLink: snapshot.liveSourceLink,
		notice: snapshot.notice,
		opensBuildInPublic: snapshot.opensBuildInPublic,
		opensLinkSharing: snapshot.opensLinkSharing,
		pages: snapshot.pages,
		pdf: snapshot.bytes ? encodeBytes(snapshot.bytes) : undefined,
		shareGrant: snapshot.shareGrant,
		titles: snapshot.titles,
		wallLocked: snapshot.wallLocked,
	};
}
