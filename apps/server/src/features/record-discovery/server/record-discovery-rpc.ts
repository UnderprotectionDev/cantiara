import { protectedProcedure, protectedWriteProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { FILE_LIFECYCLE } from "../../file-attachments/server/file-attachments-model";
import { getProject } from "../../project-shell/server/project-shell";
import {
	browsePreparedIndex,
	loadSearchIndexFromRows,
	PREPARED_INDEX_LABELS,
	SEARCH_SCOPES,
	searchRecords,
} from "./record-discovery";
import { RECORD_DISCOVERY_COPY } from "./record-discovery-copy";
import {
	OWN_SURFACE_KINDS,
	previewTablePaste,
	recordSurface,
	SEARCH_WITHOUT_TABLE_OR_COLLECTION_KINDS,
	STRUCTURED_METADATA_COLLECTION_KINDS,
	saveTableAsSmartCollection,
	TABLE_AND_CELL_KINDS,
} from "./record-discovery-table";
import {
	applyTypeTableCell,
	loadTypeTable,
	persistTablePaste,
} from "./record-discovery-table-store";

async function requireAccess(userId: string) {
	const access = await getAccountAccessForUser(getPrismaClient(), userId);
	if (!access) {
		throw new ORPCError("UNAUTHORIZED");
	}
	return access;
}

async function loadWorkspaceIndex(workspaceId: string) {
	const prisma = getPrismaClient();
	const [works, fileAttachments, decisions, researchSessions] =
		await Promise.all([
			prisma.work.findMany({
				select: {
					archived: true,
					closureResult: true,
					description: true,
					id: true,
					key: true,
					projectId: true,
					status: true,
					title: true,
					trashedAt: true,
					updatedAt: true,
				},
				where: { project: { workspaceId } },
			}),
			prisma.fileAttachment.findMany({
				select: {
					id: true,
					lifecycle: true,
					projectId: true,
					scopeKind: true,
					title: true,
					updatedAt: true,
					versions: {
						orderBy: { versionNumber: "asc" },
						select: { filename: true },
					},
				},
				where: {
					lifecycle: { not: FILE_LIFECYCLE.trash },
					workspaceId,
				},
			}),
			prisma.decision.findMany({
				select: {
					decisionText: true,
					id: true,
					life: true,
					projectId: true,
					rationale: true,
					title: true,
					updatedAt: true,
				},
				where: { project: { workspaceId } },
			}),
			prisma.researchSession.findMany({
				select: {
					id: true,
					projectId: true,
					purpose: true,
					status: true,
					title: true,
					updatedAt: true,
				},
				where: { project: { workspaceId } },
			}),
		]);
	return loadSearchIndexFromRows({
		decisions,
		fileAttachments,
		researchSessions,
		works,
	});
}

const searchInput = z.object({
	includeArchived: z.boolean().optional(),
	openProjectId: z.string().nullable().optional(),
	query: z.string(),
});

const browseIndexInput = z.object({
	folder: z.string().nullable().optional(),
	includeArchived: z.boolean().optional(),
	index: z.enum(PREPARED_INDEX_LABELS),
	metadata: z.string().nullable().optional(),
	recordType: z.string().nullable().optional(),
	scope: z.enum(SEARCH_SCOPES).nullable().optional(),
	status: z.string().nullable().optional(),
});

const tableQueryInput = z.object({
	filterText: z.string().optional(),
	kind: z.string(),
	sortDirection: z.enum(["asc", "desc"]).optional(),
	sortField: z.enum(["title", "key", "status"]).optional(),
});

const pasteMappingSchema = z.object({
	key: z.number().int().nonnegative().nullable(),
	title: z.number().int().nonnegative(),
});

const pasteInput = z.object({
	excludedIndexes: z.array(z.number().int().nonnegative()).optional(),
	headers: z.array(z.string()),
	kind: z.string(),
	mapping: pasteMappingSchema,
	projectId: z.string().nullable().optional(),
	rows: z.array(z.array(z.string())),
});

function matrixSurfaces() {
	const kinds = [
		...TABLE_AND_CELL_KINDS,
		...STRUCTURED_METADATA_COLLECTION_KINDS,
		...SEARCH_WITHOUT_TABLE_OR_COLLECTION_KINDS,
		...OWN_SURFACE_KINDS,
	];
	return kinds.map((kind) => ({
		kind,
		...recordSurface(kind),
	}));
}

export const recordDiscovery = {
	browseIndex: protectedProcedure
		.input(browseIndexInput)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const index = await loadWorkspaceIndex(access.workspaceId);
			return browsePreparedIndex(index, {
				folder: input.folder ?? null,
				includeArchived: input.includeArchived ?? false,
				index: input.index,
				metadata: input.metadata ?? null,
				recordType: input.recordType ?? null,
				scope: input.scope ?? null,
				status: input.status ?? null,
			});
		}),
	catalog: protectedProcedure.handler(() => ({
		copy: RECORD_DISCOVERY_COPY,
		indexes: PREPARED_INDEX_LABELS,
		surface: RECORD_DISCOVERY_COPY.search,
		tableKinds: TABLE_AND_CELL_KINDS,
		tableSurface: RECORD_DISCOVERY_COPY.table,
		typeSurfaces: matrixSurfaces(),
	})),
	saveTableAsSmartCollection: protectedWriteProcedure
		.input(z.object({ kind: z.string() }))
		.handler(({ input }) => saveTableAsSmartCollection(input.kind)),
	search: protectedProcedure
		.input(searchInput)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const index = await loadWorkspaceIndex(access.workspaceId);
			return searchRecords(index, {
				includeArchived: input.includeArchived ?? false,
				openProjectId: input.openProjectId ?? null,
				text: input.query,
			});
		}),
	tableApplyCell: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				field: z.string(),
				idempotencyKey: z.string(),
				kind: z.string(),
				recordId: z.string().min(1),
				value: z.string(),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await applyTypeTableCell(getPrismaClient(), {
				actorId: access.accountId,
				baseRevision: input.baseRevision,
				field: input.field,
				idempotencyKey: input.idempotencyKey,
				kind: input.kind,
				recordId: input.recordId,
				value: input.value,
				workspaceId: access.workspaceId,
			});
		}),
	tableApplyPaste: protectedWriteProcedure
		.input(pasteInput.extend({ idempotencyKey: z.string() }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			if (input.projectId) {
				const project = await getProject(getPrismaClient(), input.projectId);
				if (!project || project.workspaceId !== access.workspaceId) {
					throw new ORPCError("NOT_FOUND");
				}
			}
			return await persistTablePaste(getPrismaClient(), {
				actorId: access.accountId,
				excludedIndexes: input.excludedIndexes ?? [],
				headers: input.headers,
				idempotencyKey: input.idempotencyKey,
				kind: input.kind,
				mapping: input.mapping,
				projectId: input.projectId ?? null,
				rows: input.rows,
				workspaceId: access.workspaceId,
			});
		}),
	tablePreviewPaste: protectedProcedure
		.input(pasteInput)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const loaded = await loadTypeTable(getPrismaClient(), {
				filterText: "",
				kind: input.kind,
				sortDirection: "asc",
				sortField: "title",
				workspaceId: access.workspaceId,
			});
			if (loaded.opened.status !== "ok") {
				throw new ORPCError("BAD_REQUEST", {
					message: RECORD_DISCOVERY_COPY.tableUnavailable,
				});
			}
			return previewTablePaste({
				existing: loaded.view?.rows ?? [],
				headers: input.headers,
				kind: input.kind,
				mapping: input.mapping,
				projectId: input.projectId ?? null,
				rows: input.rows,
			});
		}),
	tableQuery: protectedProcedure
		.input(tableQueryInput)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const loaded = await loadTypeTable(getPrismaClient(), {
				filterText: input.filterText ?? "",
				kind: input.kind,
				sortDirection: input.sortDirection ?? "asc",
				sortField: input.sortField ?? "title",
				workspaceId: access.workspaceId,
			});
			if (loaded.opened.status !== "ok" || !loaded.view) {
				throw new ORPCError("BAD_REQUEST", {
					message: RECORD_DISCOVERY_COPY.tableUnavailable,
				});
			}
			return loaded.view;
		}),
};
