import type { Prisma, PrismaClient } from "@cantiara/db";

export type ScreenDb = PrismaClient | Prisma.TransactionClient;

export interface WireframeTemplateRow {
	document: Prisma.JsonValue;
	id: string;
	name: string;
	revision: number;
	workspaceId: string;
}

function hasTemplateDelegate(db: ScreenDb): boolean {
	const delegate = (
		db as unknown as Record<
			string,
			{ create?: unknown; findUnique?: unknown } | undefined
		>
	).wireframeTemplate;
	if (!delegate) {
		return false;
	}
	return (
		typeof delegate.findUnique === "function" &&
		typeof delegate.create === "function"
	);
}

export async function insertWireframeTemplateRow(
	db: ScreenDb,
	row: WireframeTemplateRow
): Promise<WireframeTemplateRow> {
	if (hasTemplateDelegate(db)) {
		return await db.wireframeTemplate.create({
			data: {
				document: row.document as Prisma.InputJsonValue,
				id: row.id,
				name: row.name,
				revision: row.revision,
				workspaceId: row.workspaceId,
			},
		});
	}
	const document = JSON.stringify(row.document);
	await db.$executeRaw`
		INSERT INTO "wireframe_template" (
			"id",
			"workspaceId",
			"name",
			"document",
			"revision",
			"createdAt",
			"updatedAt"
		)
		VALUES (
			${row.id},
			${row.workspaceId},
			${row.name},
			CAST(${document} AS JSONB),
			${row.revision},
			CURRENT_TIMESTAMP,
			CURRENT_TIMESTAMP
		)
	`;
	return row;
}

export async function findWireframeTemplateRow(
	db: ScreenDb,
	id: string
): Promise<WireframeTemplateRow | null> {
	if (hasTemplateDelegate(db)) {
		return await db.wireframeTemplate.findUnique({ where: { id } });
	}
	const rows = await db.$queryRaw<WireframeTemplateRow[]>`
		SELECT "document", "id", "name", "revision", "workspaceId"
		FROM "wireframe_template"
		WHERE "id" = ${id}
		LIMIT 1
	`;
	return rows[0] ?? null;
}
