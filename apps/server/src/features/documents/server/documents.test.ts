/**
 * Documents seam — Markdown Belge in the database, selectable
 * types, tables/fenced code/Mermaid/LaTeX in one body, and the
 * file-truth counterpart (no live `.md` file). Synthetic fixture
 * for docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Belge bütünlüğü: create/edit, type as classification, render
 * error keeps source).
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
	createDocument,
	getDocument,
	listDocuments,
	materializeStarterSkeletonDocuments,
	updateDocument,
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

const PERSONA_EMPTY_BODY = [
	"## Context",
	"",
	"## Goals",
	"",
	"## Behaviors",
	"",
	"## Pain Points",
	"",
	"## Constraints",
	"",
	"## Evidence",
	"",
	"## Open Questions",
].join("\n");

const RETROSPECTIVE_EMPTY_BODY = [
	"## Period",
	"",
	"## What worked?",
	"",
	"## What did not?",
	"",
	"## What did we learn?",
	"",
	"## Decisions",
	"",
	"## Next changes",
	"",
	"## Related records",
].join("\n");

const LAUNCH_PLAN_EMPTY_BODY = [
	"## Release",
	"",
	"## Audience",
	"",
	"## Scope",
	"",
	"## Readiness",
	"",
	"## Communication",
	"",
	"## Launch steps",
	"",
	"## Risks",
	"",
	"## Observation plan",
	"",
	"## Related records",
].join("\n");

const SAMPLE_SKELETON_CONTENT =
	/Alex|Jordan|example finding|sample task|we decided|lorem|TODO: fill/i;

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
			types: DOCUMENT_TYPES,
		});
		expect(DOCUMENTS_COPY.document).toBe("Document");
		expect(DOCUMENT_TYPES).toEqual([
			"General",
			"PRD",
			"Plan",
			"Spec",
			"Research Note",
			"Persona",
		]);
		expect(DOCUMENTS_COPY.persona).toBe("Persona");
		expect(DOCUMENTS_COPY.retrospective).toBe("Retrospective");
		expect(DOCUMENTS_COPY.launchPlan).toBe("Launch Plan");
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

	it("does not create living skeleton Documents when the project shell has no catalog selection", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		expect(project.selectedSkeletons).toEqual([]);
		expect(
			await listDocuments(prisma, {
				scope: { kind: "project", projectId: project.id },
				workspaceId,
			})
		).toEqual([]);
		const materialized = await materializeStarterSkeletonDocuments(prisma, {
			actorId,
			idempotencyKey: `starter-skeleton-documents:${project.id}`,
			origin: "human",
			payload: { projectId: project.id },
			workspaceId,
		});
		expect(materialized).toEqual({ documents: [], status: "committed" });
		expect(
			await listDocuments(prisma, {
				scope: { kind: "project", projectId: project.id },
				workspaceId,
			})
		).toEqual([]);
	});

	it("materializes Persona, Retrospective, and Launch Plan as empty-heading Documents after catalog selection", async () => {
		const { actorId, workspaceId } = await seedWorkspace(prisma);
		const created = await createProject(prisma, {
			actorId,
			idempotencyKey: `saas-${crypto.randomUUID()}`,
			origin: "human",
			payload: {
				name: "Billing",
				starterConfiguration: "Solo SaaS",
			},
			workspaceId,
		});
		if (created.status !== "committed") {
			throw new Error("expected committed Project");
		}
		expect(created.project).not.toHaveProperty("documents");
		expect(
			await listDocuments(prisma, {
				scope: { kind: "project", projectId: created.project.id },
				workspaceId,
			})
		).toEqual([]);
		const files = createMemoryLiveFiles();
		const materialized = await materializeStarterSkeletonDocuments(
			prisma,
			{
				actorId,
				idempotencyKey: `starter-skeleton-documents:${created.project.id}`,
				origin: "human",
				payload: { projectId: created.project.id },
				workspaceId,
			},
			{ files }
		);
		expect(materialized.status).toBe("committed");
		if (materialized.status !== "committed") {
			throw new Error("expected committed skeletons");
		}
		expect(files.writes).toEqual([]);
		expect(
			materialized.documents.map((document) => ({
				body: document.body,
				title: document.title,
				type: document.type,
			}))
		).toEqual([
			{
				body: PERSONA_EMPTY_BODY,
				title: "Persona",
				type: "Persona",
			},
			{
				body: RETROSPECTIVE_EMPTY_BODY,
				title: "Retrospective",
				type: "General",
			},
			{
				body: LAUNCH_PLAN_EMPTY_BODY,
				title: "Launch Plan",
				type: "General",
			},
		]);
		for (const document of materialized.documents) {
			expect(document.body).not.toMatch(SAMPLE_SKELETON_CONTENT);
			expect(document.liveFilePath).toBeNull();
		}
		expect(
			await Promise.all(
				materialized.documents.map((document) =>
					getDocument(prisma, document.id, workspaceId)
				)
			)
		).toEqual(materialized.documents);
		expect(
			(
				await listDocuments(prisma, {
					scope: { kind: "project", projectId: created.project.id },
					workspaceId,
				})
			).map((document) => document.title)
		).toEqual(["Persona", "Retrospective", "Launch Plan"]);
		expect(
			await prisma.work.count({ where: { projectId: created.project.id } })
		).toBe(0);
		expect(
			materialized.documents.some((document) =>
				["Sitemap", "Customer Journey"].includes(document.title)
			)
		).toBe(false);
		const replayed = await materializeStarterSkeletonDocuments(prisma, {
			actorId,
			idempotencyKey: `starter-skeleton-documents:${created.project.id}`,
			origin: "human",
			payload: { projectId: created.project.id },
			workspaceId,
		});
		expect(replayed.status).toBe("replayed");
		if (replayed.status !== "replayed") {
			throw new Error("expected replayed skeletons");
		}
		expect(replayed.documents.map((document) => document.id)).toEqual(
			materialized.documents.map((document) => document.id)
		);
		const edited = await updateDocument(prisma, {
			actorId,
			baseRevision: materialized.documents[0]?.revision ?? 0,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				body: `${PERSONA_EMPTY_BODY}\n\nFounder notes`,
				documentId: materialized.documents[0]?.id ?? "",
				title: "Primary buyer",
			},
			workspaceId,
		});
		expect(edited).toMatchObject({
			document: {
				body: `${PERSONA_EMPTY_BODY}\n\nFounder notes`,
				title: "Primary buyer",
				type: "Persona",
			},
			status: "committed",
		});
		await prisma.document.delete({
			where: { id: materialized.documents[1]?.id ?? "" },
		});
		const afterDelete = await materializeStarterSkeletonDocuments(prisma, {
			actorId,
			idempotencyKey: `starter-skeleton-documents:${created.project.id}`,
			origin: "human",
			payload: { projectId: created.project.id },
			workspaceId,
		});
		expect(afterDelete.status).toBe("replayed");
		if (afterDelete.status !== "replayed") {
			throw new Error("expected replayed skeletons");
		}
		expect(afterDelete.documents.map((document) => document.title)).toEqual([
			"Primary buyer",
			"Launch Plan",
		]);
	});
});
