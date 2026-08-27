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
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createProject } from "../../project-shell/server/project-shell";
import { createCustomField, listCustomFields } from "./custom-fields";
import {
	BINDABLE_RECORD_TYPES,
	CUSTOM_FIELD_COPY,
	CUSTOM_FIELD_TYPES,
	customFieldCatalog,
} from "./custom-fields-model";

const DATABASE_URL =
	process.env.DATABASE_URL ??
	"postgresql://cantiara:cantiara@127.0.0.1:5432/cantiara";

const LOOKUP_FORMULA_PATTERN = /lookup|formula/i;
const TAG_MAINTENANCE_PATTERN =
	/parentTag|tagHierarchy|renameTag|mergeTags|tagMerge/i;
const MARKDOWN_FORM_PATTERN = /markdownBody|convertDocument|rawAttachment/i;

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
});
