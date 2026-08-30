/**
 * Bulk Editing seam — explicit Work selection and existing-field
 * diff preview. Synthetic fixture for
 * docs/specs/22-bulk-editing/spec.md (selection, preview,
 * unselected untouched, no schema/import write).
 */
import { PrismaClient } from "@cantiara/db";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createProject } from "../../project-shell/server/project-shell";
import {
	createWork,
	getWork,
	listWork,
	previewClose,
} from "../../work-lifecycle/server/work-lifecycle";
import { previewBulkEdit } from "./bulk-editing";
import { BULK_EDITING_COPY } from "./bulk-editing-model";

const DATABASE_URL =
	process.env.DATABASE_URL ??
	"postgresql://cantiara:cantiara@127.0.0.1:5432/cantiara";

const SCHEMA_IMPORT_PATTERN =
	/schema migration|create field|import records|select all unspecified/i;

async function seedWorkspace(prisma: PrismaClient) {
	const user = await prisma.user.create({
		data: {
			email: `founder-${crypto.randomUUID()}@example.com`,
			emailVerified: true,
			id: crypto.randomUUID(),
			name: "Founder",
		},
	});
	const workspace = await prisma.workspace.create({
		data: {
			id: crypto.randomUUID(),
			name: "Workspace",
			ownerId: user.id,
		},
	});
	return { actorId: user.id, workspaceId: workspace.id };
}

async function resetSharedTables(prisma: PrismaClient) {
	await prisma.typedRelation.deleteMany();
	await prisma.mutationReceipt.deleteMany();
	await prisma.workspaceShortCodeReservation.deleteMany();
	await prisma.project.deleteMany();
	await prisma.accountPreference.deleteMany();
	await prisma.workspace.deleteMany();
	await prisma.session.deleteMany();
	await prisma.account.deleteMany();
	await prisma.verification.deleteMany();
	await prisma.user.deleteMany();
}

async function openPayments(prisma: PrismaClient) {
	const { actorId, workspaceId } = await seedWorkspace(prisma);
	const created = await createProject(prisma, {
		actorId,
		idempotencyKey: "create-payments",
		origin: "human",
		payload: {
			name: "Payments",
			starterConfiguration: "Blank Project",
		},
		workspaceId,
	});
	if (created.status !== "committed") {
		throw new Error("expected committed Project");
	}
	return { actorId, project: created.project, workspaceId };
}

async function createNamedWork(
	prisma: PrismaClient,
	actorId: string,
	projectId: string,
	title: string,
	idempotencyKey: string
) {
	const outcome = await createWork(prisma, {
		actorId,
		idempotencyKey,
		origin: "human",
		payload: { projectId, title },
	});
	if (outcome.status !== "committed") {
		throw new Error(`expected committed ${title}`);
	}
	return outcome.work;
}

describe("Bulk Editing", () => {
	let prisma: PrismaClient;
	let pool: Pool;

	beforeAll(() => {
		process.env.NODE_ENV = "test";
	});

	beforeEach(async () => {
		pool = new Pool({ connectionString: DATABASE_URL });
		prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
		await resetSharedTables(prisma);
	});

	afterEach(async () => {
		await prisma.$disconnect();
		await pool.end();
	});

	it("uses English Bulk Edit and has no schema, import, or select-all-unspecified copy", () => {
		expect(BULK_EDITING_COPY.bulkEdit).toBe("Bulk Edit");
		expect(BULK_EDITING_COPY.status).toBe("Status");
		expect(BULK_EDITING_COPY.schemaOrImportRefused).toBe(
			"Bulk Edit cannot create fields, migrate schema, or import records."
		);
		expect(BULK_EDITING_COPY.bulkEdit).not.toMatch(SCHEMA_IMPORT_PATTERN);
		expect(BULK_EDITING_COPY.selectedWork).not.toMatch(SCHEMA_IMPORT_PATTERN);
	});

	it("refuses a filter result as an implicit selection", async () => {
		const { actorId, project } = await openPayments(prisma);
		const visible = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Checkout",
			"create-checkout"
		);
		expect(
			await previewBulkEdit(prisma, {
				changes: { status: "In Progress" },
				filterWorkIds: [visible.id],
				selectedWorkIds: [],
			})
		).toEqual({
			reason: "selection-required",
			status: "rejected",
		});
		expect(await getWork(prisma, visible.id)).toMatchObject({
			id: visible.id,
			revision: visible.revision,
			status: "Not Started",
		});
	});

	it("previews existing field changes for selected Work without writing", async () => {
		const { actorId, project } = await openPayments(prisma);
		const selected = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Checkout",
			"create-checkout"
		);
		const unselected = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Refunds",
			"create-refunds"
		);
		const preview = await previewBulkEdit(prisma, {
			changes: { status: "In Progress" },
			filterWorkIds: [selected.id, unselected.id],
			selectedWorkIds: [selected.id],
		});
		expect(preview).toMatchObject({
			preview: {
				copy: { bulkEdit: "Bulk Edit" },
				records: [
					{
						fields: [
							{
								from: "Not Started",
								id: "status",
								label: "Status",
								to: "In Progress",
							},
						],
						key: "PAY-1",
						title: "Checkout",
						workId: selected.id,
					},
				],
			},
			status: "ok",
		});
		expect(preview.status === "ok" ? preview.preview.records : []).toHaveLength(
			1
		);
		expect(await listWork(prisma, project.id)).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: selected.id,
					revision: selected.revision,
					status: "Not Started",
					title: "Checkout",
				}),
				expect.objectContaining({
					id: unselected.id,
					revision: unselected.revision,
					status: "Not Started",
					title: "Refunds",
				}),
			])
		);
	});

	it("refuses new field definitions, schema migration, and import in the preview", async () => {
		const { actorId, project } = await openPayments(prisma);
		const selected = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Checkout",
			"create-checkout"
		);
		expect(
			await previewBulkEdit(prisma, {
				changes: {
					createField: { name: "Severity", type: "Text" },
					status: "In Progress",
				},
				selectedWorkIds: [selected.id],
			})
		).toEqual({
			reason: "schema-or-import-refused",
			status: "rejected",
		});
		expect(
			await previewBulkEdit(prisma, {
				changes: { importRecords: true, status: "In Progress" },
				selectedWorkIds: [selected.id],
			})
		).toEqual({
			reason: "schema-or-import-refused",
			status: "rejected",
		});
		expect(await getWork(prisma, selected.id)).toMatchObject({
			revision: selected.revision,
			status: "Not Started",
		});
	});

	it("invokes the close-result step instead of previewing Closed without it", async () => {
		const { actorId, project } = await openPayments(prisma);
		const selected = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Checkout",
			"create-checkout"
		);
		const closePreview = await previewClose(prisma, { workId: selected.id });
		expect(
			await previewBulkEdit(prisma, {
				changes: { status: "Closed" },
				selectedWorkIds: [selected.id],
			})
		).toEqual({
			closePreview,
			reason: "close-step-required",
			status: "rejected",
		});
		expect("copy" in closePreview ? closePreview.copy.closureCheck : null).toBe(
			"Closure check"
		);
		expect(await getWork(prisma, selected.id)).toMatchObject({
			closureResult: null,
			revision: selected.revision,
			status: "Not Started",
		});
	});

	it("previews Closed with a close result still without writing", async () => {
		const { actorId, project } = await openPayments(prisma);
		const selected = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Checkout",
			"create-checkout"
		);
		const closePreview = await previewClose(prisma, { workId: selected.id });
		expect(
			await previewBulkEdit(prisma, {
				changes: { closureResult: "Completed", status: "Closed" },
				selectedWorkIds: [selected.id],
			})
		).toMatchObject({
			closePreview,
			preview: {
				copy: { bulkEdit: "Bulk Edit" },
				records: [
					{
						fields: [
							{
								from: "Not Started",
								id: "status",
								label: "Status",
								to: "Closed",
							},
							{
								from: null,
								id: "closureResult",
								label: "Closure check",
								to: "Completed",
							},
						],
						workId: selected.id,
					},
				],
			},
			status: "ok",
		});
		expect(await getWork(prisma, selected.id)).toMatchObject({
			closureResult: null,
			status: "Not Started",
		});
	});
});
