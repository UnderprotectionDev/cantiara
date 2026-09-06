import { protectedProcedure, protectedWriteProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { getProject } from "../../project-shell/server/project-shell";
import {
	applyAutoLayout,
	createGroup,
	createPersistentRelation,
	createProjectWall,
	createRegionSnapshot,
	drawVisualLine,
	getPersonalViewport,
	getProjectWall,
	listProjectWalls,
	materializeStarterSkeletonWalls,
	placeLiveCard,
	previewPersistentRelation,
	previewRegionSnapshot,
	removeVisualLine,
	reorderOutline,
	saveFocusOrder,
	savePersonalViewport,
	setLockPosition,
	updateCardDensity,
	updateCardLayout,
} from "./project-wall";
import {
	applyAutoLayoutPayloadSchema,
	createGroupPayloadSchema,
	createPersistentRelationPayloadSchema,
	createProjectWallPayloadSchema,
	drawVisualLinePayloadSchema,
	materializeStarterSkeletonWallsPayloadSchema,
	PROJECT_WALL_SOURCE_KIND,
	placeLiveCardPayloadSchema,
	previewPersistentRelationInputSchema,
	projectWallCatalog,
	regionSnapshotPayloadSchema,
	removeVisualLinePayloadSchema,
	reorderOutlinePayloadSchema,
	saveFocusOrderPayloadSchema,
	savePersonalViewportPayloadSchema,
	setLockPositionPayloadSchema,
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
	applyAutoLayout: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: applyAutoLayoutPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWall(access.workspaceId, input.payload.wallId);
			return await applyAutoLayout(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
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
	createGroup: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: createGroupPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWall(access.workspaceId, input.payload.wallId);
			return await createGroup(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	createPersistentRelation: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: createPersistentRelationPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWall(access.workspaceId, input.payload.wallId);
			return await createPersistentRelation(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
				viewerWorkspaceId: access.workspaceId,
			});
		}),
	drawVisualLine: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: drawVisualLinePayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWall(access.workspaceId, input.payload.wallId);
			return await drawVisualLine(getPrismaClient(), {
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
	getViewport: protectedProcedure
		.input(z.object({ wallId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWall(access.workspaceId, input.wallId);
			return await getPersonalViewport(getPrismaClient(), {
				actorId: context.session.user.id,
				wallId: input.wallId,
			});
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
	materializeStarterSkeletons: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: materializeStarterSkeletonWallsPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.payload.projectId);
			return await materializeStarterSkeletonWalls(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
				workspaceId: access.workspaceId,
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
	previewPersistentRelation: protectedProcedure
		.input(
			previewPersistentRelationInputSchema.omit({
				viewerWorkspaceId: true,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWall(access.workspaceId, input.wallId);
			return await previewPersistentRelation(getPrismaClient(), {
				...input,
				viewerWorkspaceId: access.workspaceId,
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
	removeVisualLine: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: removeVisualLinePayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWall(access.workspaceId, input.payload.wallId);
			return await removeVisualLine(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	reorderOutline: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: reorderOutlinePayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWall(access.workspaceId, input.payload.wallId);
			return await reorderOutline(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
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
	saveViewport: protectedWriteProcedure
		.input(z.object({ payload: savePersonalViewportPayloadSchema }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWall(access.workspaceId, input.payload.wallId);
			return await savePersonalViewport(getPrismaClient(), {
				actorId: context.session.user.id,
				payload: input.payload,
			});
		}),
	setLockPosition: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: setLockPositionPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWall(access.workspaceId, input.payload.wallId);
			return await setLockPosition(getPrismaClient(), {
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
