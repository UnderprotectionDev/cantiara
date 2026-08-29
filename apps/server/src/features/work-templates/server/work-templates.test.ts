/**
 * Work Templates seam — Project-scoped Work Template definition,
 * relative date preview from the create day, and refusal of living
 * payload (history, relations, close outcome, status, absolute dates).
 * Instantiation is this ticket; one-off copy is later. Synthetic fixture
 * for docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (İş yaşam döngüsü start-context package).
 */
import { PrismaClient } from "@cantiara/db";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createCustomField } from "../../custom-fields/server/custom-fields";
import { createProject } from "../../project-shell/server/project-shell";
import { STRUCTURE_COPY_EXCLUDED } from "../../project-shell/server/project-shell-model";
import {
	createWork,
	getWork,
} from "../../work-lifecycle/server/work-lifecycle";
import {
	createWorkTemplate,
	getWorkTemplate,
	instantiateWorkFromTemplate,
	listWorkTemplates,
	previewWorkTemplateDates,
	trashWorkTemplate,
	updateWorkTemplate,
} from "./work-templates";
import {
	FORBIDDEN_TEMPLATE_PAYLOAD_KEYS,
	previewRelativeDateRules,
	WORK_TEMPLATE_COPY,
	workTemplatesCatalog,
} from "./work-templates-model";

const DATABASE_URL =
	process.env.DATABASE_URL ??
	"postgresql://cantiara:cantiara@127.0.0.1:5432/cantiara";

const OTHER_TEMPLATE_SURFACES =
	/personal review|starter configuration|bug capture|feedback capture|research fragment|\{\{field\}\}|marketplace|licensed pack/i;

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

describe("Work Templates", () => {
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

	it("uses English Work Template copy and stays off Document, Starter, and capture surfaces", () => {
		const catalog = workTemplatesCatalog();
		expect(catalog.copy.workTemplate).toBe("Work Template");
		expect(WORK_TEMPLATE_COPY.workTemplate).toBe("Work Template");
		expect(catalog.workTypes).toEqual([
			"Feature",
			"Bug",
			"Task",
			"Research",
			"Improvement",
		]);
		expect(JSON.stringify(catalog)).not.toMatch(OTHER_TEMPLATE_SURFACES);
		expect(catalog.copy.createFromTemplate).toBe("Create from template");
		expect(catalog.copy).not.toHaveProperty("duplicateWork");
		expect(STRUCTURE_COPY_EXCLUDED.workTemplates).toBe(true);
		expect(FORBIDDEN_TEMPLATE_PAYLOAD_KEYS).toEqual(
			expect.arrayContaining([
				"history",
				"relations",
				"closureResult",
				"status",
				"plannedStart",
				"targetDate",
			])
		);
	});

	it("stores a Project-scoped template with type, description skeleton, selected field defaults, and a light checklist", async () => {
		const { actorId, project } = await openPayments(prisma);
		const severity = await createCustomField(prisma, {
			actorId,
			idempotencyKey: "severity",
			origin: "human",
			payload: {
				boundRecordTypes: ["Work"],
				name: "Severity",
				options: ["High", "Low"],
				projectId: project.id,
				type: "Single select",
			},
		});
		expect(severity.status).toBe("committed");
		if (severity.status !== "committed") {
			throw new Error("expected committed Custom field");
		}
		const outcome = await createWorkTemplate(prisma, {
			actorId,
			idempotencyKey: "bug-intake",
			origin: "human",
			payload: {
				descriptionSkeleton: "Observed:\nExpected:",
				lightChecklist: [
					{ id: "check-repro", title: "Confirm reproduction" },
					{ id: "check-log", title: "Attach log" },
				],
				name: "Bug intake",
				plannedStartRule: { offsetDays: 0 },
				projectId: project.id,
				selectedFieldDefaults: [
					{
						definitionId: severity.definition.id,
						value: { kind: "single-select", option: "High" },
					},
				],
				targetDateRule: { offsetDays: 7 },
				workType: "Bug",
			},
		});
		expect(outcome).toMatchObject({
			status: "committed",
			template: {
				descriptionSkeleton: "Observed:\nExpected:",
				lightChecklist: [
					{ id: "check-repro", title: "Confirm reproduction" },
					{ id: "check-log", title: "Attach log" },
				],
				name: "Bug intake",
				plannedStartRule: { offsetDays: 0 },
				projectId: project.id,
				selectedFieldDefaults: [
					{
						definitionId: severity.definition.id,
						name: "Severity",
						type: "Single select",
						value: { kind: "single-select", option: "High" },
					},
				],
				targetDateRule: { offsetDays: 7 },
				workType: "Bug",
			},
		});
		if (outcome.status !== "committed") {
			throw new Error("expected committed Work Template");
		}
		expect(outcome.template).not.toHaveProperty("history");
		expect(outcome.template).not.toHaveProperty("relations");
		expect(outcome.template).not.toHaveProperty("status");
		expect(outcome.template).not.toHaveProperty("closureResult");
		expect(JSON.stringify(outcome.template)).not.toMatch(
			OTHER_TEMPLATE_SURFACES
		);
		const listed = await listWorkTemplates(prisma, project.id);
		expect(listed).toHaveLength(1);
		expect(listed[0]?.id).toBe(outcome.template.id);
	});

	it("resolves relative planned start and target dates from the create day before apply", async () => {
		expect(
			previewRelativeDateRules({
				createDay: "2026-08-28",
				plannedStartRule: { offsetDays: 0 },
				targetDateRule: { offsetDays: 7 },
			})
		).toEqual({
			preview: {
				createDay: "2026-08-28",
				plannedStart: "2026-08-28",
				targetDate: "2026-09-04",
			},
			status: "ok",
		});
		const { actorId, project } = await openPayments(prisma);
		const created = await createWorkTemplate(prisma, {
			actorId,
			idempotencyKey: "dates",
			origin: "human",
			payload: {
				name: "Sprint start",
				plannedStartRule: { offsetDays: 1 },
				projectId: project.id,
				targetDateRule: { offsetDays: 14 },
				workType: "Task",
			},
		});
		expect(created.status).toBe("committed");
		if (created.status !== "committed") {
			throw new Error("expected committed Work Template");
		}
		const preview = await previewWorkTemplateDates(prisma, {
			createDay: "2026-01-31",
			templateId: created.template.id,
		});
		expect(preview).toEqual({
			preview: {
				createDay: "2026-01-31",
				plannedStart: "2026-02-01",
				targetDate: "2026-02-14",
			},
			status: "ok",
		});
	});

	it("fails closed when a relative date cannot resolve", () => {
		expect(
			previewRelativeDateRules({
				createDay: "2026-02-31",
				plannedStartRule: { offsetDays: 0 },
			})
		).toEqual({
			reason: "relative-date-unresolved",
			status: "rejected",
		});
		expect(
			previewRelativeDateRules({
				createDay: "not-a-day",
				targetDateRule: { offsetDays: 3 },
			})
		).toEqual({
			reason: "relative-date-unresolved",
			status: "rejected",
		});
	});

	it("refuses history, relations, close outcome, current status, and absolute dates", async () => {
		const { actorId, project } = await openPayments(prisma);
		const history = await createWorkTemplate(prisma, {
			actorId,
			idempotencyKey: "history",
			origin: "human",
			payload: {
				history: [{ kind: "created" }],
				name: "With history",
				projectId: project.id,
				workType: "Task",
			},
		});
		expect(history).toEqual({
			reason: "forbidden-payload",
			status: "rejected",
		});
		const relations = await createWorkTemplate(prisma, {
			actorId,
			idempotencyKey: "relations",
			origin: "human",
			payload: {
				name: "With relations",
				projectId: project.id,
				relations: [{ toId: "other" }],
				workType: "Task",
			},
		});
		expect(relations).toEqual({
			reason: "forbidden-payload",
			status: "rejected",
		});
		const closed = await createWorkTemplate(prisma, {
			actorId,
			idempotencyKey: "closed",
			origin: "human",
			payload: {
				closureResult: "Completed",
				name: "Closed",
				projectId: project.id,
				status: "Closed",
				workType: "Task",
			},
		});
		expect(closed).toEqual({
			reason: "forbidden-payload",
			status: "rejected",
		});
		const absolute = await createWorkTemplate(prisma, {
			actorId,
			idempotencyKey: "absolute",
			origin: "human",
			payload: {
				name: "Absolute dates",
				plannedStart: "2026-08-28",
				projectId: project.id,
				targetDate: "2026-09-04",
				workType: "Task",
			},
		});
		expect(absolute).toEqual({
			reason: "absolute-date",
			status: "rejected",
		});
	});

	it("refuses Date custom-field defaults and Document placeholder syntax", async () => {
		const { actorId, project } = await openPayments(prisma);
		const due = await createCustomField(prisma, {
			actorId,
			idempotencyKey: "due-field",
			origin: "human",
			payload: {
				boundRecordTypes: ["Work"],
				name: "Customer due",
				projectId: project.id,
				type: "Date",
			},
		});
		expect(due.status).toBe("committed");
		if (due.status !== "committed") {
			throw new Error("expected committed Custom field");
		}
		const dateDefault = await createWorkTemplate(prisma, {
			actorId,
			idempotencyKey: "date-default",
			origin: "human",
			payload: {
				name: "With date field",
				projectId: project.id,
				selectedFieldDefaults: [
					{
						definitionId: due.definition.id,
						value: { date: "2026-08-28", kind: "date" },
					},
				],
				workType: "Task",
			},
		});
		expect(dateDefault).toEqual({
			reason: "date-field-default",
			status: "rejected",
		});
		const placeholder = await createWorkTemplate(prisma, {
			actorId,
			idempotencyKey: "placeholder",
			origin: "human",
			payload: {
				descriptionSkeleton: "Hello {{field}}",
				name: "Document-like",
				projectId: project.id,
				workType: "Task",
			},
		});
		expect(placeholder).toEqual({
			reason: "document-placeholder",
			status: "rejected",
		});
	});

	it("keeps a trashed template from the effective list and from date preview", async () => {
		const { actorId, project } = await openPayments(prisma);
		const created = await createWorkTemplate(prisma, {
			actorId,
			idempotencyKey: "to-trash",
			origin: "human",
			payload: {
				name: "Old intake",
				plannedStartRule: { offsetDays: 0 },
				projectId: project.id,
				workType: "Bug",
			},
		});
		expect(created.status).toBe("committed");
		if (created.status !== "committed") {
			throw new Error("expected committed Work Template");
		}
		const trashed = await trashWorkTemplate(prisma, {
			actorId,
			baseRevision: created.template.revision,
			idempotencyKey: "trash",
			origin: "human",
			payload: { templateId: created.template.id },
		});
		expect(trashed.status).toBe("committed");
		expect(await listWorkTemplates(prisma, project.id)).toEqual([]);
		expect(await getWorkTemplate(prisma, created.template.id)).toBeNull();
		expect(
			await previewWorkTemplateDates(prisma, {
				createDay: "2026-08-28",
				templateId: created.template.id,
			})
		).toEqual({
			reason: "trashed-not-effective",
			status: "rejected",
		});
		const edited = await updateWorkTemplate(prisma, {
			actorId,
			baseRevision: created.template.revision + 1,
			idempotencyKey: "edit-trashed",
			origin: "human",
			payload: {
				name: "Still old",
				projectId: project.id,
				templateId: created.template.id,
				workType: "Bug",
			},
		});
		expect(edited).toEqual({
			reason: "trashed-not-effective",
			status: "rejected",
		});
	});

	it("edits a live template without opening other template products", async () => {
		const { actorId, project } = await openPayments(prisma);
		const created = await createWorkTemplate(prisma, {
			actorId,
			idempotencyKey: "edit-source",
			origin: "human",
			payload: {
				descriptionSkeleton: "First",
				name: "Intake",
				projectId: project.id,
				workType: "Task",
			},
		});
		expect(created.status).toBe("committed");
		if (created.status !== "committed") {
			throw new Error("expected committed Work Template");
		}
		const updated = await updateWorkTemplate(prisma, {
			actorId,
			baseRevision: created.template.revision,
			idempotencyKey: "edit",
			origin: "human",
			payload: {
				descriptionSkeleton: "Second",
				name: "Intake v2",
				projectId: project.id,
				templateId: created.template.id,
				workType: "Improvement",
			},
		});
		expect(updated).toMatchObject({
			status: "committed",
			template: {
				descriptionSkeleton: "Second",
				id: created.template.id,
				name: "Intake v2",
				workType: "Improvement",
			},
		});
		const replayed = await updateWorkTemplate(prisma, {
			actorId,
			baseRevision: created.template.revision,
			idempotencyKey: "edit",
			origin: "human",
			payload: {
				descriptionSkeleton: "Second",
				name: "Intake v2",
				projectId: project.id,
				templateId: created.template.id,
				workType: "Improvement",
			},
		});
		expect(replayed.status).toBe("replayed");
	});

	it("Create from template opens independent Work with a new key and Project default start status", async () => {
		const { actorId, project } = await openPayments(prisma);
		const severity = await createCustomField(prisma, {
			actorId,
			idempotencyKey: "severity-instantiate",
			origin: "human",
			payload: {
				boundRecordTypes: ["Work"],
				name: "Severity",
				options: ["High", "Low"],
				projectId: project.id,
				type: "Single select",
			},
		});
		expect(severity.status).toBe("committed");
		if (severity.status !== "committed") {
			throw new Error("expected committed Custom field");
		}
		const created = await createWorkTemplate(prisma, {
			actorId,
			idempotencyKey: "bug-intake",
			origin: "human",
			payload: {
				descriptionSkeleton: "Observed:\nExpected:",
				lightChecklist: [{ id: "tpl-check-1", title: "Reproduce" }],
				name: "Bug intake",
				projectId: project.id,
				selectedFieldDefaults: [
					{
						definitionId: severity.definition.id,
						value: { kind: "single-select", option: "High" },
					},
				],
				workType: "Bug",
			},
		});
		expect(created.status).toBe("committed");
		if (created.status !== "committed") {
			throw new Error("expected committed Work Template");
		}
		const first = await instantiateWorkFromTemplate(prisma, {
			actorId,
			baseRevision: created.template.revision,
			idempotencyKey: "from-template-1",
			origin: "human",
			payload: {
				createDay: "2026-08-28",
				templateId: created.template.id,
			},
		});
		expect(first).toMatchObject({
			selectedFieldDefaults: [
				{
					definitionId: severity.definition.id,
					name: "Severity",
					type: "Single select",
					value: { kind: "single-select", option: "High" },
				},
			],
			status: "committed",
			work: {
				closureResult: null,
				description: "Observed:\nExpected:",
				key: "PAY-1",
				origin: null,
				projectId: project.id,
				status: "Not Started",
				title: "Bug intake",
				type: "Bug",
			},
		});
		if (first.status !== "committed") {
			throw new Error("expected committed instantiate");
		}
		expect(first.work.id).not.toBe(created.template.id);
		expect(first.work.id).not.toBe(first.work.key);
		expect(first.work).not.toHaveProperty("templateId");
		expect(first.work.lightChecklist).toHaveLength(1);
		expect(first.work.lightChecklist[0]).toMatchObject({
			completed: false,
			title: "Reproduce",
		});
		expect(first.work.lightChecklist[0]?.id).not.toBe("tpl-check-1");
		expect(JSON.stringify(first.work)).not.toContain(created.template.id);
		expect(await getWork(prisma, first.work.id)).toEqual(first.work);

		const replayed = await instantiateWorkFromTemplate(prisma, {
			actorId,
			baseRevision: created.template.revision,
			idempotencyKey: "from-template-1",
			origin: "human",
			payload: {
				createDay: "2026-08-28",
				templateId: created.template.id,
			},
		});
		expect(replayed.status).toBe("replayed");
		if (replayed.status !== "replayed") {
			throw new Error("expected replayed instantiate");
		}
		expect(replayed.work).toEqual(first.work);

		const second = await instantiateWorkFromTemplate(prisma, {
			actorId,
			baseRevision: created.template.revision,
			idempotencyKey: "from-template-2",
			origin: "human",
			payload: {
				createDay: "2026-08-28",
				templateId: created.template.id,
			},
		});
		expect(second).toMatchObject({
			status: "committed",
			work: { key: "PAY-2", title: "Bug intake", type: "Bug" },
		});
		if (second.status !== "committed") {
			throw new Error("expected second committed instantiate");
		}
		expect(second.work.id).not.toBe(first.work.id);
		expect(second.work.key).not.toBe(first.work.key);

		const edited = await updateWorkTemplate(prisma, {
			actorId,
			baseRevision: created.template.revision,
			idempotencyKey: "rewrite-template",
			origin: "human",
			payload: {
				descriptionSkeleton: "Changed after instantiate",
				name: "Bug intake v2",
				projectId: project.id,
				templateId: created.template.id,
				workType: "Task",
			},
		});
		expect(edited.status).toBe("committed");
		expect(await getWork(prisma, first.work.id)).toMatchObject({
			description: "Observed:\nExpected:",
			title: "Bug intake",
			type: "Bug",
		});

		const withoutTemplate = await createWork(prisma, {
			actorId,
			idempotencyKey: "blank-work",
			origin: "human",
			payload: {
				projectId: project.id,
				title: "Ad hoc Work",
			},
		});
		expect(withoutTemplate).toMatchObject({
			status: "committed",
			work: {
				key: "PAY-3",
				status: "Not Started",
				title: "Ad hoc Work",
			},
		});
	});

	it("refuses instantiate that would write current status or close outcome, and ignores a trashed template", async () => {
		const { actorId, project } = await openPayments(prisma);
		const created = await createWorkTemplate(prisma, {
			actorId,
			idempotencyKey: "status-source",
			origin: "human",
			payload: {
				name: "Closed looking",
				projectId: project.id,
				workType: "Task",
			},
		});
		expect(created.status).toBe("committed");
		if (created.status !== "committed") {
			throw new Error("expected committed Work Template");
		}
		expect(
			await instantiateWorkFromTemplate(prisma, {
				actorId,
				baseRevision: created.template.revision,
				idempotencyKey: "write-status",
				origin: "human",
				payload: {
					status: "Closed",
					templateId: created.template.id,
				},
			})
		).toEqual({
			reason: "forbidden-payload",
			status: "rejected",
		});
		expect(
			await instantiateWorkFromTemplate(prisma, {
				actorId,
				baseRevision: created.template.revision,
				idempotencyKey: "write-close",
				origin: "human",
				payload: {
					closeOutcome: "Completed",
					templateId: created.template.id,
				},
			})
		).toEqual({
			reason: "forbidden-payload",
			status: "rejected",
		});
		expect(
			await instantiateWorkFromTemplate(prisma, {
				actorId,
				baseRevision: created.template.revision + 1,
				idempotencyKey: "stale-revision",
				origin: "human",
				payload: { templateId: created.template.id },
			})
		).toEqual({
			conflict: "Conflict",
			status: "conflict",
		});
		const trashed = await trashWorkTemplate(prisma, {
			actorId,
			baseRevision: created.template.revision,
			idempotencyKey: "trash-for-instantiate",
			origin: "human",
			payload: { templateId: created.template.id },
		});
		expect(trashed.status).toBe("committed");
		expect(
			await instantiateWorkFromTemplate(prisma, {
				actorId,
				baseRevision: created.template.revision + 1,
				idempotencyKey: "from-trash",
				origin: "human",
				payload: { templateId: created.template.id },
			})
		).toEqual({
			reason: "trashed-not-effective",
			status: "rejected",
		});
	});

	it("fails closed when relative dates cannot resolve on instantiate", async () => {
		const { actorId, project } = await openPayments(prisma);
		const created = await createWorkTemplate(prisma, {
			actorId,
			idempotencyKey: "dated-template",
			origin: "human",
			payload: {
				name: "Dated",
				plannedStartRule: { offsetDays: 0 },
				projectId: project.id,
				workType: "Task",
			},
		});
		expect(created.status).toBe("committed");
		if (created.status !== "committed") {
			throw new Error("expected committed Work Template");
		}
		expect(
			await instantiateWorkFromTemplate(prisma, {
				actorId,
				baseRevision: created.template.revision,
				idempotencyKey: "bad-day",
				origin: "human",
				payload: {
					createDay: "not-a-day",
					templateId: created.template.id,
				},
			})
		).toEqual({
			reason: "relative-date-unresolved",
			status: "rejected",
		});
	});
});
