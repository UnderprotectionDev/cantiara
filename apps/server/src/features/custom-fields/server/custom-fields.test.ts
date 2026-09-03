/**
 * Project Custom Fields seam — Project-local definitions of Text,
 * Number, Boolean, Date, Single select, and Multi select bound to the
 * closed record-type list. Lookup/Formula, Session Test, Test
 * assessment, Markdown body, and tag hierarchy/rename/merge are
 * absent. Synthetic fixture for
 * docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Arama ve ilişki: custom field type matrix; not Lookup/Formula).
 */
import { PrismaClient } from "@cantiara/db";
import { localTestDatabaseUrl } from "@cantiara/db/local-test-database-url";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
	copyProjectStructure,
	createProject,
} from "../../project-shell/server/project-shell";
import { createWork } from "../../work-lifecycle/server/work-lifecycle";
import {
	createCustomField,
	filterCustomFieldRecords,
	listCustomFields,
	listSearchFilterFields,
	listSurfaceFields,
	setCustomFieldValue,
} from "./custom-fields";
import {
	BINDABLE_RECORD_TYPES,
	CUSTOM_FIELD_COPY,
	CUSTOM_FIELD_TYPES,
	customFieldCatalog,
	UNSET_CUSTOM_FIELD_VALUE,
} from "./custom-fields-model";

const DATABASE_URL = localTestDatabaseUrl();

const LOOKUP_FORMULA_PATTERN = /lookup|formula/i;
const TAG_MAINTENANCE_PATTERN =
	/parentTag|tagHierarchy|renameTag|mergeTags|tagMerge/i;
const MARKDOWN_FORM_PATTERN = /markdownBody|convertDocument|rawAttachment/i;
const WORKSPACE_FIELD_ID_PATTERN = /workspaceFieldId/i;

const ENGLISH_FIELD_TYPES = [
	"Text",
	"Number",
	"Boolean",
	"Date",
	"Single select",
	"Multi select",
] as const;

const ENGLISH_BINDABLE_TYPES = [
	"Work",
	"Feedback",
	"User Research Session",
	"Risk",
	"Assumption",
	"Decision",
	"Test Handoff",
	"Test Session",
	"Planned Test Scenario",
	"Test Gap",
	"Production Incident",
	"Milestone",
	"Project Release",
] as const;

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

function createCommand(
	input: {
		boundRecordTypes?: readonly string[];
		idempotencyKey?: string;
		name?: string;
		options?: readonly string[];
		projectId: string;
		type?: string;
	},
	actorId: string
) {
	return {
		actorId,
		idempotencyKey: input.idempotencyKey,
		origin: "human" as const,
		payload: {
			boundRecordTypes: input.boundRecordTypes,
			name: input.name,
			options: input.options,
			projectId: input.projectId,
			type: input.type,
		},
	};
}

async function createTypedField(
	prisma: PrismaClient,
	actorId: string,
	projectId: string,
	type: string,
	idempotencyKey: string,
	options?: readonly string[]
) {
	const outcome = await createCustomField(
		prisma,
		createCommand(
			{
				boundRecordTypes: ["Work", "Risk"],
				idempotencyKey,
				name: type,
				options,
				projectId,
				type,
			},
			actorId
		)
	);
	expect(outcome).toMatchObject({
		definition: {
			boundRecordTypes: ["Work", "Risk"],
			name: type,
			projectId,
			type,
		},
		status: "committed",
	});
	if (outcome.status !== "committed") {
		throw new Error("expected committed Custom field");
	}
	expect(outcome.definition.id).not.toBe(type);
	expect(outcome.definition.options).toEqual(
		options === undefined ? [] : ["High", "Low"]
	);
	return outcome.definition;
}

describe("Project Custom Fields", () => {
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

	it("offers the closed six types and bindable record types without Lookup or Formula", () => {
		const catalog = customFieldCatalog();
		expect(catalog.types).toEqual([...ENGLISH_FIELD_TYPES]);
		expect(catalog.bindableRecordTypes).toEqual([...ENGLISH_BINDABLE_TYPES]);
		expect(CUSTOM_FIELD_TYPES).toEqual(catalog.types);
		expect(BINDABLE_RECORD_TYPES).toEqual(catalog.bindableRecordTypes);
		expect(CUSTOM_FIELD_COPY.customField).toBe("Custom field");
		expect(CUSTOM_FIELD_COPY.text).toBe("Text");
		expect(CUSTOM_FIELD_COPY.number).toBe("Number");
		expect(CUSTOM_FIELD_COPY.boolean).toBe("Boolean");
		expect(CUSTOM_FIELD_COPY.date).toBe("Date");
		expect(CUSTOM_FIELD_COPY.singleSelect).toBe("Single select");
		expect(CUSTOM_FIELD_COPY.multiSelect).toBe("Multi select");
		expect(CUSTOM_FIELD_COPY.notEvaluated).toBe("Not evaluated");
		expect(CUSTOM_FIELD_COPY.filter).toBe("Filter");
		expect(CUSTOM_FIELD_COPY.search).toBe("Search");
		expect(JSON.stringify(catalog)).not.toMatch(LOOKUP_FORMULA_PATTERN);
		expect(JSON.stringify(CUSTOM_FIELD_COPY)).not.toMatch(
			LOOKUP_FORMULA_PATTERN
		);
		expect(JSON.stringify(catalog)).not.toMatch(TAG_MAINTENANCE_PATTERN);
		expect(JSON.stringify(CUSTOM_FIELD_COPY)).not.toMatch(
			TAG_MAINTENANCE_PATTERN
		);
		expect(JSON.stringify(catalog)).not.toMatch(MARKDOWN_FORM_PATTERN);
	});

	it("creates each of the six types bound to Work and a second supported type", async () => {
		const { actorId, project } = await openPayments(prisma);
		const text = await createTypedField(
			prisma,
			actorId,
			project.id,
			"Text",
			"create-0"
		);
		const number = await createTypedField(
			prisma,
			actorId,
			project.id,
			"Number",
			"create-1"
		);
		const boolean = await createTypedField(
			prisma,
			actorId,
			project.id,
			"Boolean",
			"create-2"
		);
		const date = await createTypedField(
			prisma,
			actorId,
			project.id,
			"Date",
			"create-3"
		);
		const single = await createTypedField(
			prisma,
			actorId,
			project.id,
			"Single select",
			"create-4",
			["High", "Low"]
		);
		const multi = await createTypedField(
			prisma,
			actorId,
			project.id,
			"Multi select",
			"create-5",
			["High", "Low"]
		);
		expect([
			text.type,
			number.type,
			boolean.type,
			date.type,
			single.type,
			multi.type,
		]).toEqual([...ENGLISH_FIELD_TYPES]);
		const listed = await listCustomFields(prisma, project.id);
		expect(listed.map((field) => field.id)).toEqual([
			text.id,
			number.id,
			boolean.id,
			date.id,
			single.id,
			multi.id,
		]);
		expect(JSON.stringify(listed)).not.toMatch(LOOKUP_FORMULA_PATTERN);
		expect(JSON.stringify(listed)).not.toMatch(TAG_MAINTENANCE_PATTERN);
		expect(JSON.stringify(listed)).not.toMatch(MARKDOWN_FORM_PATTERN);
	});

	it("rejects Lookup, Formula, Session Test, Test assessment, and Document bindings", async () => {
		const { actorId, project } = await openPayments(prisma);
		expect(
			await createCustomField(
				prisma,
				createCommand(
					{
						boundRecordTypes: ["Work"],
						idempotencyKey: "lookup",
						name: "Related",
						projectId: project.id,
						type: "Lookup",
					},
					actorId
				)
			)
		).toEqual({
			reason: "unknown-field-type",
			status: "rejected",
		});
		expect(
			await createCustomField(
				prisma,
				createCommand(
					{
						boundRecordTypes: ["Work"],
						idempotencyKey: "formula",
						name: "Score",
						projectId: project.id,
						type: "Formula",
					},
					actorId
				)
			)
		).toEqual({
			reason: "unknown-field-type",
			status: "rejected",
		});
		expect(
			await createCustomField(
				prisma,
				createCommand(
					{
						boundRecordTypes: ["Session Test"],
						idempotencyKey: "session-test",
						name: "Outcome",
						projectId: project.id,
						type: "Text",
					},
					actorId
				)
			)
		).toEqual({
			reason: "unsupported-record-type",
			status: "rejected",
		});
		expect(
			await createCustomField(
				prisma,
				createCommand(
					{
						boundRecordTypes: ["Test assessment"],
						idempotencyKey: "test-assessment",
						name: "Score",
						projectId: project.id,
						type: "Number",
					},
					actorId
				)
			)
		).toEqual({
			reason: "unsupported-record-type",
			status: "rejected",
		});
		expect(
			await createCustomField(
				prisma,
				createCommand(
					{
						boundRecordTypes: ["Document"],
						idempotencyKey: "document",
						name: "Summary",
						projectId: project.id,
						type: "Text",
					},
					actorId
				)
			)
		).toEqual({
			reason: "unsupported-record-type",
			status: "rejected",
		});
		expect(await listCustomFields(prisma, project.id)).toEqual([]);
	});

	it("keeps the same name independent across Projects", async () => {
		const { actorId, project, workspaceId } = await openPayments(prisma);
		const billing = await createProject(prisma, {
			actorId,
			idempotencyKey: "create-billing",
			origin: "human",
			payload: {
				name: "Billing",
				starterConfiguration: "Blank Project",
			},
			workspaceId,
		});
		if (billing.status !== "committed") {
			throw new Error("expected committed Project");
		}
		const paymentsField = await createCustomField(
			prisma,
			createCommand(
				{
					boundRecordTypes: ["Work"],
					idempotencyKey: "severity-payments",
					name: "Severity",
					projectId: project.id,
					type: "Text",
				},
				actorId
			)
		);
		const billingField = await createCustomField(
			prisma,
			createCommand(
				{
					boundRecordTypes: ["Feedback"],
					idempotencyKey: "severity-billing",
					name: "Severity",
					projectId: billing.project.id,
					type: "Boolean",
				},
				actorId
			)
		);
		expect(paymentsField).toMatchObject({
			definition: {
				name: "Severity",
				projectId: project.id,
				type: "Text",
			},
			status: "committed",
		});
		expect(billingField).toMatchObject({
			definition: {
				name: "Severity",
				projectId: billing.project.id,
				type: "Boolean",
			},
			status: "committed",
		});
		if (
			paymentsField.status !== "committed" ||
			billingField.status !== "committed"
		) {
			throw new Error("expected committed Custom field");
		}
		expect(paymentsField.definition.id).not.toBe(billingField.definition.id);
		expect(await listCustomFields(prisma, project.id)).toEqual([
			paymentsField.definition,
		]);
		expect(await listCustomFields(prisma, billing.project.id)).toEqual([
			billingField.definition,
		]);
	});

	it("shows bound fields on Work and Feedback create/edit and hides them on unbound Risk", async () => {
		const { actorId, project } = await openPayments(prisma);
		const field = await createCustomField(
			prisma,
			createCommand(
				{
					boundRecordTypes: ["Work", "Feedback"],
					idempotencyKey: "severity",
					name: "Severity",
					options: ["High", "Low"],
					projectId: project.id,
					type: "Single select",
				},
				actorId
			)
		);
		if (field.status !== "committed") {
			throw new Error("expected committed Custom field");
		}
		const work = await createWork(prisma, {
			actorId,
			idempotencyKey: "work-1",
			origin: "human",
			payload: {
				projectId: project.id,
				title: "Charge retry",
				type: "Task",
			},
		});
		if (work.status !== "committed") {
			throw new Error("expected committed Work");
		}
		const workCreate = await listSurfaceFields(prisma, project.id, "Work");
		const feedbackCreate = await listSurfaceFields(
			prisma,
			project.id,
			"Feedback"
		);
		const riskCreate = await listSurfaceFields(prisma, project.id, "Risk");
		expect(workCreate.map((item) => item.definitionId)).toEqual([
			field.definition.id,
		]);
		expect(feedbackCreate.map((item) => item.definitionId)).toEqual([
			field.definition.id,
		]);
		expect(riskCreate).toEqual([]);
		expect(workCreate[0]?.notEvaluated).toBe(true);
		expect(workCreate[0]?.value).toEqual(UNSET_CUSTOM_FIELD_VALUE);
		const workEdit = await listSurfaceFields(
			prisma,
			project.id,
			"Work",
			work.work.id
		);
		expect(workEdit).toEqual([
			{
				definitionId: field.definition.id,
				name: "Severity",
				notEvaluated: true,
				options: ["High", "Low"],
				recordId: work.work.id,
				recordType: "Work",
				revision: 0,
				type: "Single select",
				value: UNSET_CUSTOM_FIELD_VALUE,
			},
		]);
		expect(
			JSON.stringify({ feedbackCreate, riskCreate, workCreate, workEdit })
		).not.toMatch(MARKDOWN_FORM_PATTERN);
	});

	it("round-trips values, keeps unset distinct from Boolean false and select, and offers search/filter", async () => {
		const { actorId, project } = await openPayments(prisma);
		const booleanField = await createCustomField(
			prisma,
			createCommand(
				{
					boundRecordTypes: ["Work", "Feedback"],
					idempotencyKey: "reviewed",
					name: "Reviewed",
					projectId: project.id,
					type: "Boolean",
				},
				actorId
			)
		);
		const selectField = await createCustomField(
			prisma,
			createCommand(
				{
					boundRecordTypes: ["Work", "Feedback"],
					idempotencyKey: "severity",
					name: "Severity",
					options: ["High", "Low"],
					projectId: project.id,
					type: "Single select",
				},
				actorId
			)
		);
		const textField = await createCustomField(
			prisma,
			createCommand(
				{
					boundRecordTypes: ["Work"],
					idempotencyKey: "note",
					name: "Note",
					projectId: project.id,
					type: "Text",
				},
				actorId
			)
		);
		if (
			booleanField.status !== "committed" ||
			selectField.status !== "committed" ||
			textField.status !== "committed"
		) {
			throw new Error("expected committed Custom field");
		}
		const work = await createWork(prisma, {
			actorId,
			idempotencyKey: "work-round-trip",
			origin: "human",
			payload: {
				projectId: project.id,
				title: "Invoice",
				type: "Task",
			},
		});
		if (work.status !== "committed") {
			throw new Error("expected committed Work");
		}
		const feedbackId = crypto.randomUUID();
		expect(
			await setCustomFieldValue(prisma, {
				actorId,
				baseRevision: 0,
				idempotencyKey: "bool-false",
				origin: "human",
				payload: {
					definitionId: booleanField.definition.id,
					recordId: work.work.id,
					recordType: "Work",
					value: { boolean: false, kind: "boolean" },
				},
			})
		).toMatchObject({
			status: "committed",
			value: {
				notEvaluated: false,
				value: { boolean: false, kind: "boolean" },
			},
		});
		expect(
			await setCustomFieldValue(prisma, {
				actorId,
				baseRevision: 0,
				idempotencyKey: "select-high",
				origin: "human",
				payload: {
					definitionId: selectField.definition.id,
					recordId: work.work.id,
					recordType: "Work",
					value: { kind: "single-select", option: "High" },
				},
			})
		).toMatchObject({
			status: "committed",
			value: {
				notEvaluated: false,
				value: { kind: "single-select", option: "High" },
			},
		});
		expect(
			await setCustomFieldValue(prisma, {
				actorId,
				baseRevision: 0,
				idempotencyKey: "text-body",
				origin: "human",
				payload: {
					definitionId: textField.definition.id,
					recordId: work.work.id,
					recordType: "Work",
					value: { kind: "text", text: "Retry window" },
				},
			})
		).toMatchObject({
			status: "committed",
			value: { value: { kind: "text", text: "Retry window" } },
		});
		expect(
			await setCustomFieldValue(prisma, {
				actorId,
				baseRevision: 0,
				idempotencyKey: "feedback-unset",
				origin: "human",
				payload: {
					definitionId: booleanField.definition.id,
					recordId: feedbackId,
					recordType: "Feedback",
					value: UNSET_CUSTOM_FIELD_VALUE,
				},
			})
		).toMatchObject({
			status: "committed",
			value: {
				notEvaluated: true,
				value: UNSET_CUSTOM_FIELD_VALUE,
			},
		});
		const surface = await listSurfaceFields(
			prisma,
			project.id,
			"Work",
			work.work.id
		);
		expect(surface.find((item) => item.name === "Reviewed")?.value).toEqual({
			boolean: false,
			kind: "boolean",
		});
		expect(surface.find((item) => item.name === "Reviewed")?.notEvaluated).toBe(
			false
		);
		expect(surface.find((item) => item.name === "Severity")?.value).toEqual({
			kind: "single-select",
			option: "High",
		});
		const feedbackSurface = await listSurfaceFields(
			prisma,
			project.id,
			"Feedback",
			feedbackId
		);
		expect(
			feedbackSurface.find((item) => item.name === "Reviewed")
		).toMatchObject({
			notEvaluated: true,
			value: UNSET_CUSTOM_FIELD_VALUE,
		});
		expect(CUSTOM_FIELD_COPY.notEvaluated).toBe("Not evaluated");
		expect(
			await setCustomFieldValue(prisma, {
				actorId,
				baseRevision: 0,
				idempotencyKey: "risk-unbound",
				origin: "human",
				payload: {
					definitionId: booleanField.definition.id,
					recordId: work.work.id,
					recordType: "Risk",
					value: { boolean: false, kind: "boolean" },
				},
			})
		).toEqual({
			reason: "unbound-record-type",
			status: "rejected",
		});
		expect(
			await setCustomFieldValue(prisma, {
				actorId,
				baseRevision: 0,
				idempotencyKey: "markdown",
				origin: "human",
				payload: {
					definitionId: textField.definition.id,
					recordId: work.work.id,
					recordType: "Document",
					value: { kind: "text", text: "# body" },
				},
			})
		).toEqual({
			reason: "unsupported-record-type",
			status: "rejected",
		});
		const searchWork = await listSearchFilterFields(prisma, project.id, "Work");
		const searchFeedback = await listSearchFilterFields(
			prisma,
			project.id,
			"Feedback"
		);
		const searchRisk = await listSearchFilterFields(prisma, project.id, "Risk");
		expect(searchWork.map((field) => field.name).sort()).toEqual([
			"Note",
			"Reviewed",
			"Severity",
		]);
		expect(searchFeedback.map((field) => field.name).sort()).toEqual([
			"Reviewed",
			"Severity",
		]);
		expect(searchRisk).toEqual([]);
		expect(JSON.stringify(searchWork)).not.toMatch(MARKDOWN_FORM_PATTERN);
		expect(
			await filterCustomFieldRecords(prisma, {
				definitionId: booleanField.definition.id,
				projectId: project.id,
				recordType: "Work",
				value: { boolean: false, kind: "boolean" },
			})
		).toEqual([work.work.id]);
		expect(
			await filterCustomFieldRecords(prisma, {
				definitionId: booleanField.definition.id,
				projectId: project.id,
				recordType: "Feedback",
				value: UNSET_CUSTOM_FIELD_VALUE,
			})
		).toEqual([feedbackId]);
		expect(
			await filterCustomFieldRecords(prisma, {
				definitionId: booleanField.definition.id,
				projectId: project.id,
				recordType: "Work",
				value: UNSET_CUSTOM_FIELD_VALUE,
			})
		).toEqual([]);
	});

	it("copies definitions as independent clones without Workspace identity or values", async () => {
		const { actorId, project, workspaceId } = await openPayments(prisma);
		const field = await createCustomField(
			prisma,
			createCommand(
				{
					boundRecordTypes: ["Work"],
					idempotencyKey: "severity",
					name: "Severity",
					projectId: project.id,
					type: "Text",
				},
				actorId
			)
		);
		if (field.status !== "committed") {
			throw new Error("expected committed Custom field");
		}
		const work = await createWork(prisma, {
			actorId,
			idempotencyKey: "work-copy",
			origin: "human",
			payload: {
				projectId: project.id,
				title: "Keep values here",
				type: "Task",
			},
		});
		if (work.status !== "committed") {
			throw new Error("expected committed Work");
		}
		await setCustomFieldValue(prisma, {
			actorId,
			baseRevision: 0,
			idempotencyKey: "keep-text",
			origin: "human",
			payload: {
				definitionId: field.definition.id,
				recordId: work.work.id,
				recordType: "Work",
				value: { kind: "text", text: "source only" },
			},
		});
		const copied = await copyProjectStructure(prisma, {
			actorId,
			idempotencyKey: "copy-north",
			origin: "human",
			payload: {
				name: "North",
				sourceProjectId: project.id,
			},
			workspaceId,
		});
		if (copied.status !== "committed") {
			throw new Error("expected committed copy");
		}
		const cloned = await listCustomFields(prisma, copied.project.id);
		expect(cloned).toHaveLength(1);
		expect(cloned[0]?.name).toBe("Severity");
		expect(cloned[0]?.id).not.toBe(field.definition.id);
		expect(cloned[0]?.projectId).toBe(copied.project.id);
		expect(copied.project.customFieldDefinitions).toEqual([
			{
				id: cloned[0]?.id,
				name: "Severity",
				type: "Text",
			},
		]);
		expect(copied.project.customFieldDefinitions[0]?.id).not.toBe(
			field.definition.id
		);
		expect(
			await listSurfaceFields(prisma, copied.project.id, "Work", work.work.id)
		).toEqual([
			{
				definitionId: cloned[0]?.id,
				name: "Severity",
				notEvaluated: true,
				options: [],
				recordId: work.work.id,
				recordType: "Work",
				revision: 0,
				type: "Text",
				value: UNSET_CUSTOM_FIELD_VALUE,
			},
		]);
		expect(JSON.stringify(copied.project)).not.toMatch(
			WORKSPACE_FIELD_ID_PATTERN
		);
	});
});
