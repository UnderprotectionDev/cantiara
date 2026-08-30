/**
 * Bulk Editing seam — explicit Work selection, existing-field
 * diff preview, progress, per-record results, stale row, and
 * cancel-before-barrier. Synthetic fixture for
 * docs/specs/22-bulk-editing/spec.md and
 * docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Mutasyon sözleşmesi).
 */
import { PrismaClient } from "@cantiara/db";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	MUTATION_ACTOR,
	MUTATION_COPY,
} from "../../mutation-core/server/mutation-shared";
import { createProject } from "../../project-shell/server/project-shell";
import {
	createWork,
	getWork,
	listWork,
	previewClose,
	updateWorkTitle,
} from "../../work-lifecycle/server/work-lifecycle";
import {
	cancelBulkEdit,
	previewBulkEdit,
	processBulkEdit,
	readBulkEdit,
	startBulkEdit,
	undoBulkEdit,
} from "./bulk-editing";
import { BULK_EDITING_COPY } from "./bulk-editing-model";

const DATABASE_URL =
	process.env.DATABASE_URL ??
	"postgresql://cantiara:cantiara@127.0.0.1:5432/cantiara";

const SCHEMA_IMPORT_PATTERN =
	/schema migration|create field|import records|select all unspecified/i;
const SUPPORT_REFERENCE_PATTERN = /^CANT-[0-9A-F]{8}$/;
const RECORD_ACTION_PATTERN =
	/record action|combined action|select all unspecified/i;

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
	await prisma.mutationStagingOperation.deleteMany();
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

	it("returns first progress inside the bulk budget without writing selected Work", async () => {
		const { actorId, project } = await openPayments(prisma);
		const first = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Checkout",
			"create-checkout"
		);
		const second = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Refunds",
			"create-refunds"
		);
		const startedAt = Date.now();
		const started = await startBulkEdit(prisma, {
			actorId,
			changes: { status: "In Progress" },
			idempotencyKey: "bulk-status",
			records: [
				{
					baseRevision: first.revision,
					idempotencyKey: "bulk-checkout",
					workId: first.id,
				},
				{
					baseRevision: second.revision,
					idempotencyKey: "bulk-refunds",
					workId: second.id,
				},
			],
			selectedWorkIds: [first.id, second.id],
		});
		expect(Date.now() - startedAt).toBeLessThan(1000);
		expect(started).toMatchObject({
			job: {
				actor: MUTATION_ACTOR.user,
				copy: {
					apply: "Apply",
					bulkEdit: "Bulk Edit",
					failed: "Failed",
					progress: "Progress",
					succeeded: "Succeeded",
				},
				progress: { completed: 0, total: 2 },
				status: "staged",
				ui: { cancelAvailable: true, label: MUTATION_COPY.cancel },
			},
			status: "ok",
		});
		expect(started.status === "ok" ? started.job.records : []).toHaveLength(2);
		expect(await getWork(prisma, first.id)).toMatchObject({
			revision: first.revision,
			status: "Not Started",
		});
		expect(await getWork(prisma, second.id)).toMatchObject({
			revision: second.revision,
			status: "Not Started",
		});
	});

	it("shows per-record success and failure so a stale row cannot hide the other", async () => {
		const { actorId, project } = await openPayments(prisma);
		const fresh = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Checkout",
			"create-checkout"
		);
		const stale = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Refunds",
			"create-refunds"
		);
		await updateWorkTitle(prisma, {
			actorId,
			baseRevision: stale.revision,
			idempotencyKey: "rename-refunds",
			origin: "human",
			title: "Refunds later",
			workId: stale.id,
		});
		const unselected = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Invoices",
			"create-invoices"
		);
		const started = await startBulkEdit(prisma, {
			actorId,
			changes: { status: "In Progress" },
			idempotencyKey: "bulk-mixed",
			records: [
				{
					baseRevision: fresh.revision,
					idempotencyKey: "bulk-checkout",
					workId: fresh.id,
				},
				{
					baseRevision: stale.revision,
					idempotencyKey: "bulk-refunds",
					workId: stale.id,
				},
			],
			selectedWorkIds: [fresh.id, stale.id],
		});
		if (started.status !== "ok") {
			throw new Error("expected staged bulk edit");
		}
		const processed = await processBulkEdit(prisma, started.job.jobId);
		expect(processed).toMatchObject({
			job: {
				actor: MUTATION_ACTOR.user,
				progress: { completed: 2, total: 2 },
				records: [
					{
						actor: MUTATION_ACTOR.user,
						result: "succeeded",
						undo: MUTATION_COPY.undo,
						workId: fresh.id,
					},
					{
						actor: MUTATION_ACTOR.user,
						conflict: MUTATION_COPY.conflict,
						currentValueLabel: MUTATION_COPY.currentValue,
						result: "failed",
						undo: null,
						workId: stale.id,
					},
				],
				status: "committed",
				ui: { cancelAvailable: false, label: MUTATION_COPY.finalizing },
			},
			status: "ok",
		});
		expect(
			processed.status === "ok"
				? processed.job.records.find((row) => row.workId === stale.id)
						?.supportReference
				: null
		).toMatch(SUPPORT_REFERENCE_PATTERN);
		expect(await getWork(prisma, fresh.id)).toMatchObject({
			status: "In Progress",
		});
		expect(await getWork(prisma, stale.id)).toMatchObject({
			status: "Not Started",
			title: "Refunds later",
		});
		expect(await getWork(prisma, unselected.id)).toMatchObject({
			revision: unselected.revision,
			status: "Not Started",
		});
	});

	it("cancels only before the commit barrier and then shows Finalizing", async () => {
		const { actorId, project } = await openPayments(prisma);
		const first = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Checkout",
			"create-checkout"
		);
		const second = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Refunds",
			"create-refunds"
		);
		const started = await startBulkEdit(prisma, {
			actorId,
			changes: { title: "Bulk title" },
			idempotencyKey: "bulk-cancel",
			records: [
				{
					baseRevision: first.revision,
					idempotencyKey: "bulk-checkout",
					workId: first.id,
				},
				{
					baseRevision: second.revision,
					idempotencyKey: "bulk-refunds",
					workId: second.id,
				},
			],
			selectedWorkIds: [first.id, second.id],
		});
		if (started.status !== "ok") {
			throw new Error("expected staged bulk edit");
		}
		expect(await cancelBulkEdit(prisma, started.job.jobId)).toMatchObject({
			job: {
				status: "cancelled",
				ui: { cancelAvailable: false, label: MUTATION_COPY.cancel },
			},
			status: "cancelled",
		});
		expect(await getWork(prisma, first.id)).toMatchObject({
			revision: first.revision,
			title: "Checkout",
		});
		const barrier = await startBulkEdit(prisma, {
			actorId,
			changes: { title: "Bulk title" },
			idempotencyKey: "bulk-finalizing",
			records: [
				{
					baseRevision: first.revision,
					idempotencyKey: "bulk-checkout-2",
					workId: first.id,
				},
				{
					baseRevision: second.revision,
					idempotencyKey: "bulk-refunds-2",
					workId: second.id,
				},
			],
			selectedWorkIds: [first.id, second.id],
		});
		if (barrier.status !== "ok") {
			throw new Error("expected staged bulk edit");
		}
		await processBulkEdit(prisma, barrier.job.jobId);
		expect(await cancelBulkEdit(prisma, barrier.job.jobId)).toEqual({
			status: "refused",
			ui: {
				cancelAvailable: false,
				label: MUTATION_COPY.finalizing,
			},
		});
		expect(await readBulkEdit(prisma, barrier.job.jobId)).toMatchObject({
			job: {
				records: [
					{ result: "succeeded", workId: first.id },
					{ result: "succeeded", workId: second.id },
				],
				ui: { label: MUTATION_COPY.finalizing },
			},
			status: "ok",
		});
	});

	it("undoes a reversible field without deleting a later unrelated edit", async () => {
		const { actorId, project } = await openPayments(prisma);
		const selected = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Checkout",
			"create-checkout"
		);
		const started = await startBulkEdit(prisma, {
			actorId,
			changes: { status: "In Progress" },
			idempotencyKey: "bulk-undo",
			records: [
				{
					baseRevision: selected.revision,
					idempotencyKey: "bulk-checkout",
					workId: selected.id,
				},
			],
			selectedWorkIds: [selected.id],
		});
		if (started.status !== "ok") {
			throw new Error("expected staged bulk edit");
		}
		const processed = await processBulkEdit(prisma, started.job.jobId);
		const historyEntryId =
			processed.status === "ok"
				? processed.job.records[0]?.historyEntryId
				: null;
		if (!historyEntryId) {
			throw new Error("expected undo history");
		}
		const progressed = await getWork(prisma, selected.id);
		if (!progressed) {
			throw new Error("expected Work");
		}
		await updateWorkTitle(prisma, {
			actorId,
			baseRevision: progressed.revision,
			idempotencyKey: "later-title",
			origin: "human",
			title: "Checkout later",
			workId: selected.id,
		});
		const afterTitle = await getWork(prisma, selected.id);
		if (!afterTitle) {
			throw new Error("expected Work");
		}
		expect(
			await undoBulkEdit(prisma, {
				actorId,
				baseRevision: afterTitle.revision,
				historyEntryId,
				idempotencyKey: "undo-status",
				jobId: started.job.jobId,
				workId: selected.id,
			})
		).toMatchObject({
			actor: MUTATION_ACTOR.user,
			status: "committed",
			undo: MUTATION_COPY.undo,
		});
		expect(await getWork(prisma, selected.id)).toMatchObject({
			status: "Not Started",
			title: "Checkout later",
		});
	});

	it("refuses undo when a later write touched the same field", async () => {
		const { actorId, project } = await openPayments(prisma);
		const selected = await createNamedWork(
			prisma,
			actorId,
			project.id,
			"Checkout",
			"create-checkout"
		);
		const started = await startBulkEdit(prisma, {
			actorId,
			changes: { title: "Bulk title" },
			idempotencyKey: "bulk-same-field",
			records: [
				{
					baseRevision: selected.revision,
					idempotencyKey: "bulk-checkout",
					workId: selected.id,
				},
			],
			selectedWorkIds: [selected.id],
		});
		if (started.status !== "ok") {
			throw new Error("expected staged bulk edit");
		}
		const processed = await processBulkEdit(prisma, started.job.jobId);
		const historyEntryId =
			processed.status === "ok"
				? processed.job.records[0]?.historyEntryId
				: null;
		if (!historyEntryId) {
			throw new Error("expected undo history");
		}
		const renamed = await getWork(prisma, selected.id);
		if (!renamed) {
			throw new Error("expected Work");
		}
		await updateWorkTitle(prisma, {
			actorId,
			baseRevision: renamed.revision,
			idempotencyKey: "later-same-title",
			origin: "human",
			title: "Even later",
			workId: selected.id,
		});
		const after = await getWork(prisma, selected.id);
		if (!after) {
			throw new Error("expected Work");
		}
		expect(
			await undoBulkEdit(prisma, {
				actorId,
				baseRevision: after.revision,
				historyEntryId,
				idempotencyKey: "undo-title",
				jobId: started.job.jobId,
				workId: selected.id,
			})
		).toMatchObject({
			conflict: MUTATION_COPY.conflict,
			currentValueLabel: MUTATION_COPY.currentValue,
			status: "conflict",
		});
		expect(await getWork(prisma, selected.id)).toMatchObject({
			title: "Even later",
		});
	});

	it("keeps Bulk Edit copy free of Record Action catalog and combined-action buttons", () => {
		expect(BULK_EDITING_COPY.bulkEdit).toBe("Bulk Edit");
		expect(JSON.stringify(BULK_EDITING_COPY)).not.toMatch(
			RECORD_ACTION_PATTERN
		);
	});
});
