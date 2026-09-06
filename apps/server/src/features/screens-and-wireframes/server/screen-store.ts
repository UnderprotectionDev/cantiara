import type { Prisma, PrismaClient } from "@cantiara/db";

export type ScreenDb = PrismaClient | Prisma.TransactionClient;

export interface ScreenRow {
	archivedAt: Date | null;
	id: string;
	projectId: string;
	revision: number;
	title: string;
	trashedAt: Date | null;
}

export interface ScreenEventRow {
	kind: string;
	occurredAt: Date;
}

export interface WireframeVersionRow {
	createdAt: Date;
	document?: unknown;
	id: string;
	screenId: string;
	versionNumber: number;
}

export function hasScreenDelegate(db: ScreenDb): boolean {
	const delegate = (
		db as unknown as Record<
			string,
			{ create?: unknown; findMany?: unknown } | undefined
		>
	).screen;
	if (!delegate) {
		return false;
	}
	return (
		typeof delegate.findMany === "function" &&
		typeof delegate.create === "function"
	);
}

export async function findScreenRow(
	db: ScreenDb,
	id: string
): Promise<ScreenRow | null> {
	if (hasScreenDelegate(db)) {
		return await db.screen.findUnique({ where: { id } });
	}
	const rows = await db.$queryRaw<ScreenRow[]>`
		SELECT
			"archivedAt",
			"id",
			"projectId",
			"revision",
			"title",
			"trashedAt"
		FROM "screen"
		WHERE "id" = ${id}
		LIMIT 1
	`;
	const [found] = rows;
	return found ?? null;
}

export async function listScreenRows(
	db: ScreenDb,
	input: {
		includeArchived?: boolean;
		projectId: string;
		trash?: boolean;
	}
): Promise<ScreenRow[]> {
	if (hasScreenDelegate(db)) {
		return await db.screen.findMany({
			orderBy: { createdAt: "asc" },
			where: input.trash
				? { projectId: input.projectId, trashedAt: { not: null } }
				: {
						archivedAt: input.includeArchived ? undefined : null,
						projectId: input.projectId,
						trashedAt: null,
					},
		});
	}
	if (input.trash) {
		return await db.$queryRaw<ScreenRow[]>`
			SELECT
				"archivedAt",
				"id",
				"projectId",
				"revision",
				"title",
				"trashedAt"
			FROM "screen"
			WHERE "projectId" = ${input.projectId}
				AND "trashedAt" IS NOT NULL
			ORDER BY "createdAt" ASC
		`;
	}
	if (input.includeArchived) {
		return await db.$queryRaw<ScreenRow[]>`
			SELECT
				"archivedAt",
				"id",
				"projectId",
				"revision",
				"title",
				"trashedAt"
			FROM "screen"
			WHERE "projectId" = ${input.projectId}
				AND "trashedAt" IS NULL
			ORDER BY "createdAt" ASC
		`;
	}
	return await db.$queryRaw<ScreenRow[]>`
		SELECT
			"archivedAt",
			"id",
			"projectId",
			"revision",
			"title",
			"trashedAt"
		FROM "screen"
		WHERE "projectId" = ${input.projectId}
			AND "trashedAt" IS NULL
			AND "archivedAt" IS NULL
		ORDER BY "createdAt" ASC
	`;
}

export async function insertScreenRow(
	db: ScreenDb,
	row: { id: string; projectId: string; revision: number; title: string }
): Promise<ScreenRow> {
	if (hasScreenDelegate(db)) {
		return await db.screen.create({
			data: {
				id: row.id,
				projectId: row.projectId,
				revision: row.revision,
				title: row.title,
			},
		});
	}
	const rows = await db.$queryRaw<ScreenRow[]>`
		INSERT INTO "screen" (
			"id",
			"projectId",
			"title",
			"revision",
			"createdAt",
			"updatedAt"
		)
		VALUES (
			${row.id},
			${row.projectId},
			${row.title},
			${row.revision},
			CURRENT_TIMESTAMP,
			CURRENT_TIMESTAMP
		)
		RETURNING
			"archivedAt",
			"id",
			"projectId",
			"revision",
			"title",
			"trashedAt"
	`;
	const [created] = rows;
	if (!created) {
		throw new Error("Screen insert returned no row");
	}
	return created;
}

export async function updateScreenRow(
	db: ScreenDb,
	row: ScreenRow
): Promise<ScreenRow> {
	if (hasScreenDelegate(db)) {
		return await db.screen.update({
			data: {
				archivedAt: row.archivedAt,
				revision: row.revision,
				trashedAt: row.trashedAt,
			},
			where: { id: row.id },
		});
	}
	const rows = await db.$queryRaw<ScreenRow[]>`
		UPDATE "screen"
		SET
			"archivedAt" = ${row.archivedAt},
			"revision" = ${row.revision},
			"trashedAt" = ${row.trashedAt},
			"updatedAt" = CURRENT_TIMESTAMP
		WHERE "id" = ${row.id}
		RETURNING
			"archivedAt",
			"id",
			"projectId",
			"revision",
			"title",
			"trashedAt"
	`;
	const [updated] = rows;
	if (!updated) {
		throw new Error("Screen update returned no row");
	}
	return updated;
}

export async function deleteScreenRow(db: ScreenDb, id: string): Promise<void> {
	if (hasScreenDelegate(db)) {
		await db.screen.delete({ where: { id } });
		return;
	}
	await db.$executeRaw`DELETE FROM "screen" WHERE "id" = ${id}`;
}

export async function insertScreenEvent(
	db: ScreenDb,
	row: { actorId: string; id: string; kind: string; screenId: string }
): Promise<void> {
	if (hasScreenDelegate(db)) {
		await db.screenEvent.create({
			data: {
				actorId: row.actorId,
				id: row.id,
				kind: row.kind,
				screenId: row.screenId,
			},
		});
		return;
	}
	await db.$executeRaw`
		INSERT INTO "screen_event" ("id", "screenId", "kind", "actorId", "occurredAt")
		VALUES (${row.id}, ${row.screenId}, ${row.kind}, ${row.actorId}, CURRENT_TIMESTAMP)
	`;
}

export async function listScreenEvents(
	db: ScreenDb,
	screenId: string
): Promise<ScreenEventRow[]> {
	if (hasScreenDelegate(db)) {
		return await db.screenEvent.findMany({
			orderBy: { occurredAt: "asc" },
			where: { screenId },
		});
	}
	return await db.$queryRaw<ScreenEventRow[]>`
		SELECT "kind", "occurredAt"
		FROM "screen_event"
		WHERE "screenId" = ${screenId}
		ORDER BY "occurredAt" ASC
	`;
}

export async function listWireframeVersions(
	db: ScreenDb,
	screenId: string
): Promise<WireframeVersionRow[]> {
	if (hasScreenDelegate(db)) {
		return await db.wireframeVersion.findMany({
			orderBy: { versionNumber: "asc" },
			where: { screenId },
		});
	}
	return await db.$queryRaw<WireframeVersionRow[]>`
		SELECT "createdAt", "document", "id", "screenId", "versionNumber"
		FROM "wireframe_version"
		WHERE "screenId" = ${screenId}
		ORDER BY "versionNumber" ASC
	`;
}

export async function findWireframeVersionRow(
	db: ScreenDb,
	input: { screenId: string; versionNumber: number }
): Promise<WireframeVersionRow | null> {
	if (hasScreenDelegate(db)) {
		return await db.wireframeVersion.findUnique({
			where: {
				screenId_versionNumber: {
					screenId: input.screenId,
					versionNumber: input.versionNumber,
				},
			},
		});
	}
	const rows = await db.$queryRaw<WireframeVersionRow[]>`
		SELECT "createdAt", "document", "id", "screenId", "versionNumber"
		FROM "wireframe_version"
		WHERE "screenId" = ${input.screenId}
			AND "versionNumber" = ${input.versionNumber}
		LIMIT 1
	`;
	const [found] = rows;
	return found ?? null;
}

export async function findLatestWireframeVersionRow(
	db: ScreenDb,
	screenId: string
): Promise<WireframeVersionRow | null> {
	if (hasScreenDelegate(db)) {
		return await db.wireframeVersion.findFirst({
			orderBy: { versionNumber: "desc" },
			where: { screenId },
		});
	}
	const rows = await db.$queryRaw<WireframeVersionRow[]>`
		SELECT "createdAt", "document", "id", "screenId", "versionNumber"
		FROM "wireframe_version"
		WHERE "screenId" = ${screenId}
		ORDER BY "versionNumber" DESC
		LIMIT 1
	`;
	const [latest] = rows;
	return latest ?? null;
}

export async function latestWireframeVersionNumber(
	db: ScreenDb,
	screenId: string
): Promise<number> {
	if (hasScreenDelegate(db)) {
		const latest = await db.wireframeVersion.findFirst({
			orderBy: { versionNumber: "desc" },
			where: { screenId },
		});
		return latest?.versionNumber ?? 0;
	}
	const rows = await db.$queryRaw<{ versionNumber: number }[]>`
		SELECT "versionNumber"
		FROM "wireframe_version"
		WHERE "screenId" = ${screenId}
		ORDER BY "versionNumber" DESC
		LIMIT 1
	`;
	const [latest] = rows;
	return latest?.versionNumber ?? 0;
}

export async function updateWireframeVersionDocument(
	db: ScreenDb,
	input: { document: unknown; id: string }
): Promise<void> {
	if (hasScreenDelegate(db)) {
		await db.wireframeVersion.update({
			data: { document: input.document as Prisma.InputJsonValue },
			where: { id: input.id },
		});
		return;
	}
	const document = JSON.stringify(input.document);
	await db.$executeRaw`
		UPDATE "wireframe_version"
		SET "document" = CAST(${document} AS JSONB)
		WHERE "id" = ${input.id}
	`;
}

export async function insertWireframeVersion(
	db: ScreenDb,
	row: {
		document: unknown;
		id: string;
		screenId: string;
		versionNumber: number;
	}
): Promise<void> {
	if (hasScreenDelegate(db)) {
		await db.wireframeVersion.create({
			data: {
				document: row.document as Prisma.InputJsonValue,
				id: row.id,
				screenId: row.screenId,
				versionNumber: row.versionNumber,
			},
		});
		return;
	}
	const document = JSON.stringify(row.document);
	await db.$executeRaw`
		INSERT INTO "wireframe_version" (
			"id",
			"screenId",
			"versionNumber",
			"document",
			"createdAt"
		)
		VALUES (
			${row.id},
			${row.screenId},
			${row.versionNumber},
			CAST(${document} AS JSONB),
			CURRENT_TIMESTAMP
		)
	`;
}
