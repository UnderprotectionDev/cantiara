/**
 * Tags seam — one Workspace-wide flat tag namespace, apply
 * and detach on reachable records, Project picker ranking as
 * suggestion not scope, `/` as literal text. Synthetic fixture
 * for docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Arama ve ilişki: tag identity, no Project-local dictionary,
 * no hierarchy).
 */
import { PrismaClient } from "@cantiara/db";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { MUTATION_COPY } from "../../mutation-core/server/mutation-shared";
import { createProject } from "../../project-shell/server/project-shell";
import {
	createWork,
	listWorkRelations,
} from "../../work-lifecycle/server/work-lifecycle";
import {
	applyTag,
	createTag,
	listRecords,
	listTags,
	listWorkTags,
	markdownExportTags,
	recordResolvedInlineUse,
	removeTag,
	renameTag,
	suggestTags,
	undoTagRename,
} from "./tags";
import { TAGS_COPY } from "./tags-model";

const DATABASE_URL =
	process.env.DATABASE_URL ??
	"postgresql://cantiara:cantiara@127.0.0.1:5432/cantiara";

const HIERARCHY_PATTERN = /parentId|parentTag|childTag|nestedDictionary/i;
const SCOPE_PATTERN =
	/projectId|projectLocal|folderId|smartCollection|favoriteId|evidence/i;
const PROJECT_LOCAL_PATTERN = /projectLocal/;
const MERGE_PATTERN =
	/mergeTags|tagMerge|archiveTag|usageSuggestion|tokenizeMarkdown|fencedCode/i;
const FROZEN_URGENT_NAME = /"urgent"/;

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

async function openSecondProject(
	prisma: PrismaClient,
	actorId: string,
	workspaceId: string,
	name: string
) {
	const created = await createProject(prisma, {
		actorId,
		idempotencyKey: `create-${name.toLowerCase()}`,
		origin: "human",
		payload: {
			name,
			starterConfiguration: "Blank Project",
		},
		workspaceId,
	});
	if (created.status !== "committed") {
		throw new Error("expected committed Project");
	}
	return created.project;
}

async function addWork(
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
		throw new Error("expected committed Work");
	}
	return outcome.work;
}

describe("Tags", () => {
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

	it("keeps one Workspace identity for the same visible name", async () => {
		const { actorId, workspaceId } = await openPayments(prisma);
		const first = await createTag(prisma, {
			actorId,
			idempotencyKey: "tag-billing-1",
			name: "billing",
			origin: "human",
			workspaceId,
		});
		const second = await createTag(prisma, {
			actorId,
			idempotencyKey: "tag-billing-2",
			name: "billing",
			origin: "human",
			workspaceId,
		});
		expect(first).toMatchObject({
			status: "committed",
			tag: { name: "billing", workspaceId },
		});
		expect(second.status).toBe("committed");
		if (!(first.status === "committed" && second.status === "committed")) {
			throw new Error("expected committed Tags");
		}
		expect(second.tag.id).toBe(first.tag.id);
		expect(second.tag).not.toHaveProperty("projectId");
		expect(JSON.stringify(second.tag)).not.toMatch(SCOPE_PATTERN);
		const listed = await listTags(prisma, workspaceId);
		expect(listed.map((tag) => tag.name)).toEqual(["billing"]);
	});

	it("does not mint a Project-local tag when the same name is used in two Projects", async () => {
		const { actorId, project, workspaceId } = await openPayments(prisma);
		const billing = await openSecondProject(
			prisma,
			actorId,
			workspaceId,
			"Billing"
		);
		const tag = await createTag(prisma, {
			actorId,
			idempotencyKey: "shared-name",
			name: "checkout",
			origin: "human",
			workspaceId,
		});
		if (tag.status !== "committed") {
			throw new Error("expected committed Tag");
		}
		const paymentsWork = await addWork(
			prisma,
			actorId,
			project.id,
			"Intake",
			"work-payments"
		);
		const billingWork = await addWork(
			prisma,
			actorId,
			billing.id,
			"Payout",
			"work-billing"
		);
		const appliedPayments = await applyTag(prisma, {
			actorId,
			baseRevision: paymentsWork.revision,
			idempotencyKey: "apply-payments",
			origin: "human",
			tagId: tag.tag.id,
			workId: paymentsWork.id,
		});
		const appliedBilling = await applyTag(prisma, {
			actorId,
			baseRevision: billingWork.revision,
			idempotencyKey: "apply-billing",
			origin: "human",
			tagId: tag.tag.id,
			workId: billingWork.id,
		});
		expect(appliedPayments.status).toBe("committed");
		expect(appliedBilling.status).toBe("committed");
		const records = await listRecords(prisma, {
			tagId: tag.tag.id,
			workspaceId,
		});
		expect(records.map((record) => record.id).sort()).toEqual(
			[billingWork.id, paymentsWork.id].sort()
		);
		expect(records.every((record) => record.tagIds.includes(tag.tag.id))).toBe(
			true
		);
		expect(await listTags(prisma, workspaceId)).toHaveLength(1);
	});

	it("creates, applies, and removes a tag without deleting the identity", async () => {
		const { actorId, project, workspaceId } = await openPayments(prisma);
		const work = await addWork(
			prisma,
			actorId,
			project.id,
			"Intake",
			"work-intake"
		);
		const created = await createTag(prisma, {
			actorId,
			idempotencyKey: "create-urgent",
			name: "urgent",
			origin: "human",
			workspaceId,
		});
		if (created.status !== "committed") {
			throw new Error("expected committed Tag");
		}
		const applied = await applyTag(prisma, {
			actorId,
			baseRevision: work.revision,
			idempotencyKey: "apply-urgent",
			origin: "human",
			tagId: created.tag.id,
			workId: work.id,
		});
		expect(applied.status).toBe("committed");
		if (applied.status !== "committed") {
			throw new Error("expected committed apply");
		}
		expect(
			await listRecords(prisma, { tagId: created.tag.id, workspaceId })
		).toEqual([
			{
				id: work.id,
				key: work.key,
				projectId: project.id,
				revision: applied.record.revision,
				tagIds: [created.tag.id],
				title: "Intake",
			},
		]);
		expect(await listWorkTags(prisma, project.id)).toEqual([
			{
				tagIds: [created.tag.id],
				workId: work.id,
			},
		]);
		const removed = await removeTag(prisma, {
			actorId,
			baseRevision: applied.record.revision,
			idempotencyKey: "remove-urgent",
			origin: "human",
			tagId: created.tag.id,
			workId: work.id,
		});
		expect(removed.status).toBe("committed");
		expect(
			await listRecords(prisma, { tagId: created.tag.id, workspaceId })
		).toEqual([]);
		expect(await listTags(prisma, workspaceId)).toEqual([
			{
				id: created.tag.id,
				name: "urgent",
				revision: created.tag.revision,
				workspaceId,
			},
		]);
	});

	it("keeps a slash as literal text without a parent dictionary", async () => {
		const { actorId, workspaceId } = await openPayments(prisma);
		const created = await createTag(prisma, {
			actorId,
			idempotencyKey: "slash-name",
			name: "area/billing",
			origin: "human",
			workspaceId,
		});
		expect(created).toMatchObject({
			status: "committed",
			tag: { name: "area/billing", workspaceId },
		});
		if (created.status !== "committed") {
			throw new Error("expected committed Tag");
		}
		expect(JSON.stringify(created.tag)).not.toMatch(HIERARCHY_PATTERN);
		expect(await listTags(prisma, workspaceId)).toEqual([created.tag]);
	});

	it("ranks tags used often in the Project first without changing Workspace scope", async () => {
		const { actorId, project, workspaceId } = await openPayments(prisma);
		const other = await openSecondProject(
			prisma,
			actorId,
			workspaceId,
			"Ledger"
		);
		const zebra = await createTag(prisma, {
			actorId,
			idempotencyKey: "tag-zebra",
			name: "zebra",
			origin: "human",
			workspaceId,
		});
		const alpha = await createTag(prisma, {
			actorId,
			idempotencyKey: "tag-alpha",
			name: "alpha",
			origin: "human",
			workspaceId,
		});
		const billing = await createTag(prisma, {
			actorId,
			idempotencyKey: "tag-billing",
			name: "billing",
			origin: "human",
			workspaceId,
		});
		if (
			zebra.status !== "committed" ||
			alpha.status !== "committed" ||
			billing.status !== "committed"
		) {
			throw new Error("expected committed Tags");
		}
		const first = await addWork(prisma, actorId, project.id, "One", "w1");
		const second = await addWork(prisma, actorId, project.id, "Two", "w2");
		const otherWork = await addWork(prisma, actorId, other.id, "Other", "w3");
		await applyTag(prisma, {
			actorId,
			baseRevision: first.revision,
			idempotencyKey: "a1",
			origin: "human",
			tagId: billing.tag.id,
			workId: first.id,
		});
		await applyTag(prisma, {
			actorId,
			baseRevision: second.revision,
			idempotencyKey: "a2",
			origin: "human",
			tagId: billing.tag.id,
			workId: second.id,
		});
		await applyTag(prisma, {
			actorId,
			baseRevision: first.revision + 1,
			idempotencyKey: "a3",
			origin: "human",
			tagId: alpha.tag.id,
			workId: first.id,
		});
		await applyTag(prisma, {
			actorId,
			baseRevision: otherWork.revision,
			idempotencyKey: "a4",
			origin: "human",
			tagId: zebra.tag.id,
			workId: otherWork.id,
		});
		const suggested = await suggestTags(prisma, {
			projectId: project.id,
			workspaceId,
		});
		expect(suggested.map((tag) => tag.name)).toEqual([
			"billing",
			"alpha",
			"zebra",
		]);
		expect(suggested.every((tag) => tag.workspaceId === workspaceId)).toBe(
			true
		);
		expect(JSON.stringify(suggested)).not.toMatch(PROJECT_LOCAL_PATTERN);
	});

	it("does not create a relation, folder, Smart Collection, Favorite, or evidence link", async () => {
		const { actorId, project, workspaceId } = await openPayments(prisma);
		const work = await addWork(prisma, actorId, project.id, "Intake", "work");
		const created = await createTag(prisma, {
			actorId,
			idempotencyKey: "plain",
			name: "plain",
			origin: "human",
			workspaceId,
		});
		if (created.status !== "committed") {
			throw new Error("expected committed Tag");
		}
		await applyTag(prisma, {
			actorId,
			baseRevision: work.revision,
			idempotencyKey: "apply-plain",
			origin: "human",
			tagId: created.tag.id,
			workId: work.id,
		});
		expect(await listWorkRelations(prisma, work.id)).toEqual([]);
		expect(
			await prisma.workRelatedEdge.findMany({
				where: { OR: [{ fromWorkId: work.id }, { toWorkId: work.id }] },
			})
		).toEqual([]);
		expect(JSON.stringify(created.tag)).not.toMatch(SCOPE_PATTERN);
		expect(TAGS_COPY.tags).toBe("Tags");
		expect(TAGS_COPY.renameTag).toBe("Rename Tag");
		expect(MUTATION_COPY.conflict).toBe("Conflict");
		expect(JSON.stringify(TAGS_COPY)).not.toMatch(MERGE_PATTERN);
	});

	it("renames a tag in one commit without changing identity", async () => {
		const { actorId, project, workspaceId } = await openPayments(prisma);
		const created = await createTag(prisma, {
			actorId,
			idempotencyKey: "create-billing",
			name: "billing",
			origin: "human",
			workspaceId,
		});
		if (created.status !== "committed") {
			throw new Error("expected committed Tag");
		}
		const first = await addWork(prisma, actorId, project.id, "Intake", "w1");
		const second = await addWork(prisma, actorId, project.id, "Payout", "w2");
		const appliedFirst = await applyTag(prisma, {
			actorId,
			baseRevision: first.revision,
			idempotencyKey: "apply-1",
			origin: "human",
			tagId: created.tag.id,
			workId: first.id,
		});
		const appliedSecond = await applyTag(prisma, {
			actorId,
			baseRevision: second.revision,
			idempotencyKey: "apply-2",
			origin: "human",
			tagId: created.tag.id,
			workId: second.id,
		});
		expect(appliedFirst.status).toBe("committed");
		expect(appliedSecond.status).toBe("committed");
		const renamed = await renameTag(prisma, {
			actorId,
			baseRevision: created.tag.revision,
			idempotencyKey: "rename-billing",
			name: "invoicing",
			origin: "human",
			tagId: created.tag.id,
		});
		expect(renamed).toMatchObject({
			status: "committed",
			tag: {
				id: created.tag.id,
				name: "invoicing",
				workspaceId,
			},
			undo: MUTATION_COPY.undo,
		});
		if (renamed.status !== "committed") {
			throw new Error("expected committed rename");
		}
		expect(renamed.tag.id).toBe(created.tag.id);
		expect(await listTags(prisma, workspaceId)).toEqual([renamed.tag]);
		const records = await listRecords(prisma, {
			tagId: created.tag.id,
			workspaceId,
		});
		expect(records.map((record) => record.id).sort()).toEqual(
			[first.id, second.id].sort()
		);
		expect(
			records.every((record) => record.tagIds.includes(created.tag.id))
		).toBe(true);
	});

	it("keeps the same identity filter after rename without a frozen display name", async () => {
		const { actorId, project, workspaceId } = await openPayments(prisma);
		const created = await createTag(prisma, {
			actorId,
			idempotencyKey: "create-urgent",
			name: "urgent",
			origin: "human",
			workspaceId,
		});
		if (created.status !== "committed") {
			throw new Error("expected committed Tag");
		}
		const work = await addWork(prisma, actorId, project.id, "Intake", "work");
		await applyTag(prisma, {
			actorId,
			baseRevision: work.revision,
			idempotencyKey: "apply-urgent",
			origin: "human",
			tagId: created.tag.id,
			workId: work.id,
		});
		const renamed = await renameTag(prisma, {
			actorId,
			baseRevision: created.tag.revision,
			idempotencyKey: "rename-urgent",
			name: "today",
			origin: "human",
			tagId: created.tag.id,
		});
		expect(renamed.status).toBe("committed");
		expect(
			(await listRecords(prisma, { tagId: created.tag.id, workspaceId })).map(
				(record) => record.id
			)
		).toEqual([work.id]);
		expect(
			(await listTags(prisma, workspaceId)).map((tag) => tag.name)
		).toEqual(["today"]);
		expect(JSON.stringify(await listTags(prisma, workspaceId))).not.toMatch(
			FROZEN_URGENT_NAME
		);
	});

	it("does not merge two tag identities when the new name is already taken", async () => {
		const { actorId, workspaceId } = await openPayments(prisma);
		const billing = await createTag(prisma, {
			actorId,
			idempotencyKey: "create-billing",
			name: "billing",
			origin: "human",
			workspaceId,
		});
		const urgent = await createTag(prisma, {
			actorId,
			idempotencyKey: "create-urgent",
			name: "urgent",
			origin: "human",
			workspaceId,
		});
		if (billing.status !== "committed" || urgent.status !== "committed") {
			throw new Error("expected committed Tags");
		}
		const renamed = await renameTag(prisma, {
			actorId,
			baseRevision: billing.tag.revision,
			idempotencyKey: "rename-merge",
			name: "urgent",
			origin: "human",
			tagId: billing.tag.id,
		});
		expect(renamed).toMatchObject({
			reason: "name-taken",
			status: "rejected",
		});
		expect(await listTags(prisma, workspaceId)).toEqual(
			[billing.tag, urgent.tag].sort((left, right) =>
				left.name.localeCompare(right.name)
			)
		);
	});

	it("updates resolved inline uses with the structured name and returns versioned undo", async () => {
		const { actorId, project, workspaceId } = await openPayments(prisma);
		const created = await createTag(prisma, {
			actorId,
			idempotencyKey: "create-billing",
			name: "billing",
			origin: "human",
			workspaceId,
		});
		if (created.status !== "committed") {
			throw new Error("expected committed Tag");
		}
		const work = await addWork(prisma, actorId, project.id, "Intake", "work");
		await applyTag(prisma, {
			actorId,
			baseRevision: work.revision,
			idempotencyKey: "apply-billing",
			origin: "human",
			tagId: created.tag.id,
			workId: work.id,
		});
		const bound = await recordResolvedInlineUse(prisma, {
			body: "Pay #billing today.",
			documentId: "doc-intake",
			tagId: created.tag.id,
		});
		expect(bound).toMatchObject({
			body: "Pay #billing today.",
			documentId: "doc-intake",
			status: "committed",
			tagId: created.tag.id,
		});
		if (bound.status !== "committed") {
			throw new Error("expected committed inline use");
		}
		const renamed = await renameTag(prisma, {
			actorId,
			baseRevision: created.tag.revision,
			idempotencyKey: "rename-inline",
			name: "invoicing",
			origin: "human",
			tagId: created.tag.id,
		});
		expect(renamed.status).toBe("committed");
		if (renamed.status !== "committed") {
			throw new Error("expected committed rename");
		}
		expect(renamed.tag.name).toBe("invoicing");
		expect(renamed.documentChanges).toEqual([
			{
				documentId: "doc-intake",
				nextBody: "Pay #invoicing today.",
				previousBody: "Pay #billing today.",
				revision: bound.revision + 1,
				undo: MUTATION_COPY.undo,
			},
		]);
		expect(await markdownExportTags(prisma, workspaceId)).toEqual({
			inlineByDocumentId: { "doc-intake": "Pay #invoicing today." },
			manifest: {
				identities: [{ id: created.tag.id, name: "invoicing" }],
			},
		});
		const undone = await undoTagRename(prisma, {
			actorId,
			baseRevision: renamed.tag.revision,
			historyEntryId: renamed.historyEntryId,
			idempotencyKey: "undo-rename",
			origin: "human",
			tagId: created.tag.id,
		});
		expect(undone).toMatchObject({
			status: "committed",
			tag: { id: created.tag.id, name: "billing" },
		});
		if (undone.status !== "committed") {
			throw new Error("expected committed undo");
		}
		expect(await listTags(prisma, workspaceId)).toEqual([undone.tag]);
		expect(await markdownExportTags(prisma, workspaceId)).toEqual({
			inlineByDocumentId: { "doc-intake": "Pay #billing today." },
			manifest: {
				identities: [{ id: created.tag.id, name: "billing" }],
			},
		});
	});

	it("leaves no mixed names when rename fails after the dictionary write", async () => {
		const { actorId, workspaceId } = await openPayments(prisma);
		const created = await createTag(prisma, {
			actorId,
			idempotencyKey: "create-billing",
			name: "billing",
			origin: "human",
			workspaceId,
		});
		if (created.status !== "committed") {
			throw new Error("expected committed Tag");
		}
		await recordResolvedInlineUse(prisma, {
			body: "#billing",
			documentId: "doc-one",
			tagId: created.tag.id,
		});
		const failing = prisma.$extends({
			query: {
				tagInlineUse: {
					$allOperations() {
						throw new Error("injected-failure");
					},
				},
			},
		});
		await expect(
			renameTag(failing as unknown as PrismaClient, {
				actorId,
				baseRevision: created.tag.revision,
				idempotencyKey: "rename-fail",
				name: "invoicing",
				origin: "human",
				tagId: created.tag.id,
			})
		).rejects.toThrow("injected-failure");
		expect(await listTags(prisma, workspaceId)).toEqual([created.tag]);
		expect(await markdownExportTags(prisma, workspaceId)).toEqual({
			inlineByDocumentId: { "doc-one": "#billing" },
			manifest: {
				identities: [{ id: created.tag.id, name: "billing" }],
			},
		});
	});

	it("keeps inline hash text in Markdown export and identity mapping in the manifest", async () => {
		const { actorId, workspaceId } = await openPayments(prisma);
		const created = await createTag(prisma, {
			actorId,
			idempotencyKey: "create-area",
			name: "area/billing",
			origin: "human",
			workspaceId,
		});
		if (created.status !== "committed") {
			throw new Error("expected committed Tag");
		}
		await recordResolvedInlineUse(prisma, {
			body: "See #area/billing.",
			documentId: "doc-note",
			tagId: created.tag.id,
		});
		expect(await markdownExportTags(prisma, workspaceId)).toEqual({
			inlineByDocumentId: { "doc-note": "See #area/billing." },
			manifest: {
				identities: [{ id: created.tag.id, name: "area/billing" }],
			},
		});
	});
});
