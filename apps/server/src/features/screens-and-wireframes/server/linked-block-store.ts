import type { Prisma, PrismaClient } from "@cantiara/db";

export type ScreenDb = PrismaClient | Prisma.TransactionClient;

export interface LinkedBlockRow {
	createdAt: Date;
	definition: Prisma.JsonValue;
	id: string;
	name: string;
	projectId: string;
	revision: number;
	updatedAt: Date;
}

export function hasLinkedBlockDelegate(db: ScreenDb): boolean {
	const delegate = (
		db as unknown as Record<
			string,
			{ create?: unknown; findMany?: unknown } | undefined
		>
	).wireframeLinkedBlock;
	if (!delegate) {
		return false;
	}
	return (
		typeof delegate.findMany === "function" &&
		typeof delegate.create === "function"
	);
}

export async function findLinkedBlockRow(
	db: ScreenDb,
	id: string
): Promise<LinkedBlockRow | null> {
	if (hasLinkedBlockDelegate(db)) {
		return await db.wireframeLinkedBlock.findUnique({ where: { id } });
	}
	const rows = await db.$queryRaw<LinkedBlockRow[]>`
		SELECT
			"createdAt",
			"definition",
			"id",
			"name",
			"projectId",
			"revision",
			"updatedAt"
		FROM "wireframe_linked_block"
		WHERE "id" = ${id}
		LIMIT 1
	`;
	const [found] = rows;
	return found ?? null;
}

export async function listLinkedBlockRows(
	db: ScreenDb,
	projectId: string
): Promise<LinkedBlockRow[]> {
	if (hasLinkedBlockDelegate(db)) {
		return await db.wireframeLinkedBlock.findMany({
			orderBy: { createdAt: "asc" },
			where: { projectId },
		});
	}
	return await db.$queryRaw<LinkedBlockRow[]>`
		SELECT
			"createdAt",
			"definition",
			"id",
			"name",
			"projectId",
			"revision",
			"updatedAt"
		FROM "wireframe_linked_block"
		WHERE "projectId" = ${projectId}
		ORDER BY "createdAt" ASC
	`;
}

export async function insertLinkedBlockRow(
	db: ScreenDb,
	row: {
		definition: Prisma.InputJsonValue;
		id: string;
		name: string;
		projectId: string;
		revision: number;
	}
): Promise<LinkedBlockRow> {
	if (hasLinkedBlockDelegate(db)) {
		return await db.wireframeLinkedBlock.create({
			data: {
				definition: row.definition,
				id: row.id,
				name: row.name,
				projectId: row.projectId,
				revision: row.revision,
			},
		});
	}
	const definition = JSON.stringify(row.definition);
	const rows = await db.$queryRaw<LinkedBlockRow[]>`
		INSERT INTO "wireframe_linked_block" (
			"id",
			"projectId",
			"name",
			"definition",
			"revision",
			"createdAt",
			"updatedAt"
		)
		VALUES (
			${row.id},
			${row.projectId},
			${row.name},
			CAST(${definition} AS JSONB),
			${row.revision},
			CURRENT_TIMESTAMP,
			CURRENT_TIMESTAMP
		)
		RETURNING
			"createdAt",
			"definition",
			"id",
			"name",
			"projectId",
			"revision",
			"updatedAt"
	`;
	const [created] = rows;
	if (!created) {
		throw new Error("Linked block insert returned no row");
	}
	return created;
}

export async function updateLinkedBlockRow(
	db: ScreenDb,
	row: LinkedBlockRow
): Promise<LinkedBlockRow> {
	if (hasLinkedBlockDelegate(db)) {
		return await db.wireframeLinkedBlock.update({
			data: {
				definition: row.definition as Prisma.InputJsonValue,
				name: row.name,
				revision: row.revision,
			},
			where: { id: row.id },
		});
	}
	const definition = JSON.stringify(row.definition);
	const rows = await db.$queryRaw<LinkedBlockRow[]>`
		UPDATE "wireframe_linked_block"
		SET
			"definition" = CAST(${definition} AS JSONB),
			"name" = ${row.name},
			"revision" = ${row.revision},
			"updatedAt" = CURRENT_TIMESTAMP
		WHERE "id" = ${row.id}
		RETURNING
			"createdAt",
			"definition",
			"id",
			"name",
			"projectId",
			"revision",
			"updatedAt"
	`;
	const [updated] = rows;
	if (!updated) {
		throw new Error("Linked block update returned no row");
	}
	return updated;
}
