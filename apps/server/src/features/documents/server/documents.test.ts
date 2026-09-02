/**
 * Documents seam — Markdown Belge in the database, selectable
 * types, tables/fenced code/Mermaid/LaTeX in one body, Document
 * Template independence, Personal Review headings, and the
 * file-truth counterpart (no live `.md` file). Synthetic fixture
 * for docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Belge bütünlüğü and Belge şablonları).
 */
import { PrismaClient } from "@cantiara/db";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createProject } from "../../project-shell/server/project-shell";
import {
	createRelation,
	listRelations,
} from "../../relations/server/relations";
import { RELATIONS_COPY } from "../../relations/server/relations-catalog";
import { createWork } from "../../work-lifecycle/server/work-lifecycle";
import {
	convertDocumentToTemplate,
	createDocument,
	createDocumentTemplate,
	getDocument,
	getDocumentTemplate,
	instantiateDocumentFromTemplate,
	listDocuments,
	listDocumentTemplates,
	previewConvertDocumentToTemplate,
	updateDocument,
	updateDocumentTemplate,
} from "./documents";
import {
	createMemoryLiveFiles,
	DOCUMENT_TYPES,
	DOCUMENTS_COPY,
	documentsCatalog,
	presentDocumentBody,
} from "./documents-model";

const DATABASE_URL =
	process.env.DATABASE_URL ??
	"postgresql://cantiara:cantiara@127.0.0.1:5432/cantiara";

const MARKETPLACE_COPY = /marketplace|licensed pack|meeting type/i;

const FULL_BODY = [
	"| Col | Value |",
	"| --- | ----- |",
	"| A | 1 |",
	"",
	"```ts",
	"export const n = 1;",
	"```",
	"",
	"```mermaid",
	"graph TD",
	"  A-->B",
	"```",
	"",
	"$$E = mc^2$$",
	"",
	"Inline $e=mc^2$.",
].join("\n");

const BROKEN_MERMAID = ["```mermaid", "not a diagram", "```"].join("\n");
const BROKEN_LATEX = ["```latex", "", "```"].join("\n");

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

async function openProject(prisma: PrismaClient) {
	const { actorId, workspaceId } = await seedWorkspace(prisma);
	const created = await createProject(prisma, {
		actorId,
		idempotencyKey: `create-${crypto.randomUUID()}`,
		origin: "human",
		payload: {
			name: "Atlas",
			starterConfiguration: "Blank Project",
		},
		workspaceId,
	});
	if (created.status !== "committed") {
		throw new Error("expected committed Project");
	}
	return { actorId, project: created.project, workspaceId };
}

describe("Documents catalog", () => {
	it("exposes English Document and the six first-product types", () => {
		expect(documentsCatalog()).toEqual({
			copy: DOCUMENTS_COPY,
			personalReview: {
				headings: [
					"Period",
					"What changed?",
					"What worked?",
					"What was difficult?",
					"Decisions and learnings",
					"What will I change next?",
					"Related records",
				],
				kind: "personal-review",
				name: "Personal Review",
				skeleton: [
					"## Period",
					"",
					"## What changed?",
					"",
					"## What worked?",
					"",
					"## What was difficult?",
					"",
					"## Decisions and learnings",
					"",
					"## What will I change next?",
					"",
					"## Related records",
					"",
				].join("\n"),
			},
			types: DOCUMENT_TYPES,
		});
		expect(DOCUMENTS_COPY.document).toBe("Document");
		expect(DOCUMENTS_COPY.documentTemplate).toBe("Document Template");
		expect(DOCUMENTS_COPY.convertToTemplate).toBe("Convert to template");
		expect(DOCUMENTS_COPY.createFromTemplate).toBe("Create from template");
		expect(DOCUMENTS_COPY.personalReview).toBe("Personal Review");
		expect(DOCUMENT_TYPES).toEqual([
			"General",
			"PRD",
			"Plan",
			"Spec",
			"Research Note",
			"Persona",
		]);
	});
});

describe("Documents", () => {
	let prisma: PrismaClient;
	let pool: Pool;

	beforeAll(() => {
		process.env.NODE_ENV = "test";
	});

	beforeEach(() => {
		pool = new Pool({ connectionString: DATABASE_URL });
		prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
	});

	afterEach(async () => {
		await prisma.mutationReceipt.deleteMany();
		await prisma.workspace.deleteMany();
		await prisma.user.deleteMany();
		await prisma.$disconnect();
		await pool.end();
	});

	it("creates a Document with title, Markdown body, and type only in the database", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const files = createMemoryLiveFiles();
		const created = await createDocument(
			prisma,
			{
				actorId,
				idempotencyKey: crypto.randomUUID(),
				origin: "human",
				payload: {
					body: "# Spec\n\nHello",
					scope: { kind: "project", projectId: project.id },
					title: "Payments spec",
					type: "Spec",
				},
				workspaceId,
			},
			{ files }
		);
		expect(created).toMatchObject({
			document: {
				body: "# Spec\n\nHello",
				liveFilePath: null,
				title: "Payments spec",
				type: "Spec",
			},
			status: "committed",
		});
		if (created.status !== "committed") {
			throw new Error("expected committed Document");
		}
		expect(files.writes).toEqual([]);
		expect(await getDocument(prisma, created.document.id)).toEqual(
			created.document
		);
		expect(
			await listDocuments(prisma, {
				scope: { kind: "project", projectId: project.id },
				workspaceId,
			})
		).toEqual([created.document]);
	});

	it("edits Markdown body in the database without writing a live file", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const files = createMemoryLiveFiles();
		const created = await createDocument(
			prisma,
			{
				actorId,
				idempotencyKey: crypto.randomUUID(),
				origin: "human",
				payload: {
					body: "First draft",
					scope: { kind: "project", projectId: project.id },
					title: "Payments spec",
					type: "Spec",
				},
				workspaceId,
			},
			{ files }
		);
		if (created.status !== "committed") {
			throw new Error("expected committed Document");
		}
		const updated = await updateDocument(
			prisma,
			{
				actorId,
				baseRevision: created.document.revision,
				idempotencyKey: crypto.randomUUID(),
				origin: "human",
				payload: {
					body: "Second draft",
					documentId: created.document.id,
					title: "Payments spec",
				},
				workspaceId,
			},
			{ files }
		);
		expect(updated).toMatchObject({
			document: {
				body: "Second draft",
				id: created.document.id,
				liveFilePath: null,
				title: "Payments spec",
				type: "Spec",
			},
			status: "committed",
		});
		expect(files.writes).toEqual([]);
		expect(await getDocument(prisma, created.document.id)).toMatchObject({
			body: "Second draft",
			id: created.document.id,
		});
	});

	it("keeps identity, body, and relations when type changes", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const created = await createDocument(prisma, {
			actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				body: "Stable body",
				scope: { kind: "project", projectId: project.id },
				title: "Research dump",
				type: "Research Note",
			},
			workspaceId,
		});
		if (created.status !== "committed") {
			throw new Error("expected committed Document");
		}
		const work = await createWork(prisma, {
			actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: { projectId: project.id, title: "Related work" },
		});
		if (work.status !== "committed") {
			throw new Error("expected committed Work");
		}
		const related = await createRelation(prisma, {
			actorId,
			from: { id: work.work.id, kind: "Work" },
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			previewAcknowledged: true,
			to: { id: created.document.id, kind: "Document" },
			type: RELATIONS_COPY.related,
			viewerWorkspaceId: workspaceId,
		});
		expect(related.status).toBe("committed");
		const before = await listRelations(prisma, {
			record: { id: created.document.id, kind: "Document" },
			viewerWorkspaceId: workspaceId,
		});
		const updated = await updateDocument(prisma, {
			actorId,
			baseRevision: created.document.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				documentId: created.document.id,
				type: "PRD",
			},
			workspaceId,
		});
		expect(updated).toMatchObject({
			document: {
				body: "Stable body",
				id: created.document.id,
				title: "Research dump",
				type: "PRD",
			},
			status: "committed",
		});
		expect(
			await listRelations(prisma, {
				record: { id: created.document.id, kind: "Document" },
				viewerWorkspaceId: workspaceId,
			})
		).toEqual(before);
	});

	it("stores table, fenced code, Mermaid, and LaTeX in the same Document body", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const created = await createDocument(prisma, {
			actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				body: FULL_BODY,
				scope: { kind: "project", projectId: project.id },
				title: "Long spec",
				type: "Spec",
			},
			workspaceId,
		});
		if (created.status !== "committed") {
			throw new Error("expected committed Document");
		}
		const loaded = await getDocument(prisma, created.document.id);
		expect(loaded?.body).toBe(FULL_BODY);
		expect(loaded?.body).toContain("| Col | Value |");
		expect(loaded?.body).toContain("```ts");
		expect(loaded?.body).toContain("```mermaid");
		expect(loaded?.body).toContain("$$E = mc^2$$");
		expect(loaded?.body).toContain("$e=mc^2$");
		const presented = presentDocumentBody(created.document.body);
		expect(presented.source).toBe(FULL_BODY);
		expect(presented.blocks).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ kind: "fenced-code", language: "ts" }),
				expect.objectContaining({ kind: "mermaid", status: "ok" }),
				expect.objectContaining({
					kind: "latex",
					source: "E = mc^2",
					status: "ok",
				}),
				expect.objectContaining({
					kind: "latex",
					source: "e=mc^2",
					status: "ok",
				}),
			])
		);
	});

	it("keeps an error and editable source when Mermaid or LaTeX processing fails", () => {
		const mermaid = presentDocumentBody(BROKEN_MERMAID, {
			latex: () => ({ ok: true }),
			mermaid: () => ({ error: DOCUMENTS_COPY.couldNotRender, ok: false }),
		});
		expect(mermaid.source).toBe(BROKEN_MERMAID);
		expect(mermaid.blocks).toContainEqual({
			error: DOCUMENTS_COPY.couldNotRender,
			kind: "mermaid",
			source: "not a diagram",
			status: "error",
		});
		expect(
			mermaid.blocks.some(
				(block) =>
					"status" in block && block.status === "error" && block.source === ""
			)
		).toBe(false);
		const latex = presentDocumentBody(BROKEN_LATEX, {
			latex: () => ({ error: DOCUMENTS_COPY.couldNotRender, ok: false }),
			mermaid: () => ({ ok: true }),
		});
		expect(latex.source).toBe(BROKEN_LATEX);
		expect(
			latex.blocks.some(
				(block) =>
					block.kind === "latex" &&
					block.status === "error" &&
					block.error === DOCUMENTS_COPY.couldNotRender
			)
		).toBe(true);
	});

	it("creates a Personal Wiki Document without a live file", async () => {
		const { actorId, workspaceId } = await seedWorkspace(prisma);
		const files = createMemoryLiveFiles();
		const created = await createDocument(
			prisma,
			{
				actorId,
				idempotencyKey: crypto.randomUUID(),
				origin: "human",
				payload: {
					body: "Wiki note",
					scope: { kind: "personal-wiki" },
					title: "Founder notes",
					type: "General",
				},
				workspaceId,
			},
			{ files }
		);
		expect(created).toMatchObject({
			document: {
				body: "Wiki note",
				liveFilePath: null,
				scope: { kind: "personal-wiki" },
				title: "Founder notes",
				type: "General",
			},
			status: "committed",
		});
		expect(files.writes).toEqual([]);
	});
});

describe("Document templates", () => {
	let prisma: PrismaClient;
	let pool: Pool;

	beforeAll(() => {
		process.env.NODE_ENV = "test";
	});

	beforeEach(() => {
		pool = new Pool({ connectionString: DATABASE_URL });
		prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
	});

	afterEach(async () => {
		await prisma.mutationReceipt.deleteMany();
		await prisma.workspace.deleteMany();
		await prisma.user.deleteMany();
		await prisma.$disconnect();
		await pool.end();
	});

	it("stores a Project-scoped Document Template without a Work Template or marketplace", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const created = await createDocumentTemplate(prisma, {
			actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				documentType: "Spec",
				name: "Spec start",
				scope: { kind: "project", projectId: project.id },
				skeleton: "## Context\n\n{{audience}}\n",
			},
			workspaceId,
		});
		expect(created).toMatchObject({
			status: "committed",
			template: {
				documentType: "Spec",
				liveBound: false,
				name: "Spec start",
				placeholders: ["audience"],
				skeleton: "## Context\n\n{{audience}}\n",
			},
		});
		if (created.status !== "committed") {
			throw new Error("expected committed Document Template");
		}
		expect(await prisma.workTemplate.count()).toBe(0);
		expect(
			await listDocumentTemplates(prisma, {
				scope: { kind: "project", projectId: project.id },
				workspaceId,
			})
		).toEqual([created.template]);
	});

	it("refuses Work Template fields and does not open a template marketplace", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const created = await createDocumentTemplate(prisma, {
			actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				name: "Bad",
				scope: { kind: "project", projectId: project.id },
				workType: "Feature",
			},
			workspaceId,
		});
		expect(created).toEqual({
			reason: "forbidden-payload",
			status: "rejected",
		});
		expect(JSON.stringify(documentsCatalog())).not.toMatch(MARKETPLACE_COPY);
	});

	it("Convert to template copies the skeleton and leaves the source Document unchanged", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const source = await createDocument(prisma, {
			actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				body: "## Notes\n\nHello {{period}}\n",
				scope: { kind: "project", projectId: project.id },
				title: "Weekly notes",
				type: "General",
			},
			workspaceId,
		});
		if (source.status !== "committed") {
			throw new Error("expected committed Document");
		}
		const work = await createWork(prisma, {
			actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: { projectId: project.id, title: "Linked work" },
		});
		if (work.status !== "committed") {
			throw new Error("expected committed Work");
		}
		const related = await createRelation(prisma, {
			actorId,
			from: { id: work.work.id, kind: "Work" },
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			previewAcknowledged: true,
			to: { id: source.document.id, kind: "Document" },
			type: RELATIONS_COPY.related,
			viewerWorkspaceId: workspaceId,
		});
		expect(related.status).toBe("committed");
		const preview = await previewConvertDocumentToTemplate(
			prisma,
			source.document.id,
			workspaceId
		);
		expect(preview).toEqual({
			preview: {
				name: "Weekly notes",
				placeholders: ["period"],
				skeleton: "## Notes\n\nHello {{period}}\n",
				sourceDocumentId: source.document.id,
				sourceRevision: source.document.revision,
				sourceTitle: "Weekly notes",
			},
			status: "ok",
		});
		const converted = await convertDocumentToTemplate(prisma, {
			actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: { documentId: source.document.id },
			workspaceId,
		});
		expect(converted).toMatchObject({
			status: "committed",
			template: {
				liveBound: false,
				name: "Weekly notes",
				placeholders: ["period"],
				skeleton: "## Notes\n\nHello {{period}}\n",
			},
		});
		expect(await getDocument(prisma, source.document.id)).toEqual(
			source.document
		);
		expect(
			await listRelations(prisma, {
				record: { id: source.document.id, kind: "Document" },
				viewerWorkspaceId: workspaceId,
			})
		).toHaveLength(1);
	});

	it("Create from template opens an independent Document that later template edits do not update", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const template = await createDocumentTemplate(prisma, {
			actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				name: "Review start",
				scope: { kind: "project", projectId: project.id },
				skeleton: "## Period\n\n{{period}}\n",
			},
			workspaceId,
		});
		if (template.status !== "committed") {
			throw new Error("expected committed Document Template");
		}
		const created = await instantiateDocumentFromTemplate(prisma, {
			actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				placeholderValues: { period: "2026-W36" },
				templateId: template.template.id,
				title: "Week 36 review",
			},
			workspaceId,
		});
		expect(created).toMatchObject({
			document: {
				body: "## Period\n\n2026-W36\n",
				liveFilePath: null,
				title: "Week 36 review",
				type: "General",
			},
			status: "committed",
		});
		if (created.status !== "committed") {
			throw new Error("expected committed Document");
		}
		expect(created.document.id).not.toBe(template.template.id);
		const edited = await updateDocumentTemplate(prisma, {
			actorId,
			baseRevision: template.template.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				skeleton: "## Period\n\nCHANGED\n",
				templateId: template.template.id,
			},
			workspaceId,
		});
		expect(edited.status).toBe("committed");
		expect(await getDocument(prisma, created.document.id)).toMatchObject({
			body: "## Period\n\n2026-W36\n",
			id: created.document.id,
		});
		expect(
			await getDocumentTemplate(prisma, template.template.id)
		).toMatchObject({
			skeleton: "## Period\n\nCHANGED\n",
		});
	});

	it("Personal Review lays down the golden headings and can be ignored or edited on the Document", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const created = await instantiateDocumentFromTemplate(prisma, {
			actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				preparedKind: "personal-review",
				scope: { kind: "project", projectId: project.id },
				title: "September review",
			},
			workspaceId,
		});
		expect(created.status).toBe("committed");
		if (created.status !== "committed") {
			throw new Error("expected committed Document");
		}
		expect(created.document.type).toBe("General");
		expect(created.document.body).toBe(
			[
				"## Period",
				"",
				"## What changed?",
				"",
				"## What worked?",
				"",
				"## What was difficult?",
				"",
				"## Decisions and learnings",
				"",
				"## What will I change next?",
				"",
				"## Related records",
				"",
			].join("\n")
		);
		expect(created.document).not.toHaveProperty("meetingType");
		expect(created.document).not.toHaveProperty("cadence");
		const withoutTemplate = await createDocument(prisma, {
			actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				body: "Free note",
				scope: { kind: "project", projectId: project.id },
				title: "Ignored review",
				type: "General",
			},
			workspaceId,
		});
		expect(withoutTemplate).toMatchObject({
			document: { body: "Free note", title: "Ignored review" },
			status: "committed",
		});
		const trimmed = await updateDocument(prisma, {
			actorId,
			baseRevision: created.document.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				body: "## Period\n\nOnly this heading remains.\n",
				documentId: created.document.id,
			},
			workspaceId,
		});
		expect(trimmed).toMatchObject({
			document: {
				body: "## Period\n\nOnly this heading remains.\n",
				id: created.document.id,
			},
			status: "committed",
		});
	});

	it("creates a Personal Wiki Document Template and instantiates in that scope", async () => {
		const { actorId, workspaceId } = await seedWorkspace(prisma);
		const template = await createDocumentTemplate(prisma, {
			actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				name: "Wiki start",
				scope: { kind: "personal-wiki" },
				skeleton: "## Note\n",
			},
			workspaceId,
		});
		if (template.status !== "committed") {
			throw new Error("expected committed Document Template");
		}
		const created = await instantiateDocumentFromTemplate(prisma, {
			actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				templateId: template.template.id,
				title: "Wiki instance",
			},
			workspaceId,
		});
		expect(created).toMatchObject({
			document: {
				body: "## Note\n",
				scope: { kind: "personal-wiki" },
				title: "Wiki instance",
			},
			status: "committed",
		});
	});
});
