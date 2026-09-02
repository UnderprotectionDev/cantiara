/**
 * Documents seam — Markdown Belge in the database, selectable
 * types, tables/fenced code/Mermaid/LaTeX in one body, Document
 * Template independence, Personal Review headings, version
 * compare/restore as product versions (not Git), and the
 * file-truth counterpart (no live `.md` file). Synthetic fixture
 * for docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Belge bütünlüğü and Belge şablonları: create/edit, type as
 * classification, render error keeps source, version compare
 * and restore).
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
import {
	createTag,
	listTaggedDocuments,
	listTags,
} from "../../tags/server/tags";
import { createWork } from "../../work-lifecycle/server/work-lifecycle";
import {
	applyConflictDraft,
	archiveDocument,
	compareConflictDraft,
	compareDocumentVersions,
	convertDocumentToTemplate,
	createDocument,
	createDocumentFolder,
	createDocumentFromConflictDraft,
	createDocumentTemplate,
	deleteConflictDraft,
	getConflictDraft,
	getDocument,
	getDocumentTemplate,
	instantiateDocumentFromTemplate,
	listDocumentFolders,
	listDocuments,
	listDocumentTemplates,
	listDocumentVersions,
	materializeStarterSkeletonDocuments,
	placeDocument,
	previewConvertDocumentToTemplate,
	previewDocumentArchive,
	previewDocumentPlacement,
	restoreDocumentVersion,
	unarchiveDocument,
	updateDocument,
	updateDocumentTemplate,
} from "./documents";
import {
	createMemoryLiveFiles,
	DOCUMENT_TYPES,
	DOCUMENTS_COPY,
	documentsCatalog,
	presentDocumentBody,
	presentDocumentChildCard,
	presentDocumentVersionDiff,
	resolveInDocTags,
} from "./documents-model";

const DATABASE_URL =
	process.env.DATABASE_URL ??
	"postgresql://cantiara:cantiara@127.0.0.1:5432/cantiara";

const MARKETPLACE_COPY = /marketplace|licensed pack|meeting type/i;
const TRASH_PATTERN = /Trash|trash|Çöp/i;
const DISCOVERY_COPY_PATTERN =
	/All Documents|Smart Collection|Trash|Unpublish/i;
const SMART_COLLECTION_PATTERN = /Smart Collection/i;
const CARD_COVER_PATTERN = /cover|thumbnail|designer/i;
const BILLING = { id: "tag-billing", name: "billing" };
const SECTION_ID = "\\{#sec-[^}]+\\}";
const SPEC_HEADING_BODY = new RegExp(`^# Spec ${SECTION_ID}\\n\\nHello$`);
const PERIOD_FILLED_BODY = new RegExp(
	`^## Period ${SECTION_ID}\\n\\n2026-W36\\n$`
);
const NOTE_HEADING_BODY = new RegExp(`^## Note ${SECTION_ID}\\n$`);
const PERIOD_TRIMMED_BODY = new RegExp(
	`^## Period ${SECTION_ID}\\n\\nOnly this heading remains\\.\\n$`
);
const PERSONAL_REVIEW_BODY = new RegExp(
	`^${[
		"Period",
		"What changed\\?",
		"What worked\\?",
		"What was difficult\\?",
		"Decisions and learnings",
		"What will I change next\\?",
		"Related records",
	]
		.map((heading) => `## ${heading} ${SECTION_ID}`)
		.join("\\n\\n")}\\n$`
);

const PERSONA_HEADINGS = [
	"Context",
	"Goals",
	"Behaviors",
	"Pain Points",
	"Constraints",
	"Evidence",
	"Open Questions",
] as const;
const RETROSPECTIVE_HEADINGS = [
	"Period",
	"What worked?",
	"What did not?",
	"What did we learn?",
	"Decisions",
	"Next changes",
	"Related records",
] as const;
const LAUNCH_PLAN_HEADINGS = [
	"Release",
	"Audience",
	"Scope",
	"Readiness",
	"Communication",
	"Launch steps",
	"Risks",
	"Observation plan",
	"Related records",
] as const;
const SAMPLE_SKELETON_CONTENT =
	/Alex|Jordan|example finding|sample task|we decided|lorem|TODO: fill/i;

function markdownHeadingTitles(body: string): string[] {
	return [...body.matchAll(/^## (.+?)(?: \{#sec-[^}]+\})?$/gm)].map(
		(match) => match[1] ?? ""
	);
}

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
		expect(DOCUMENTS_COPY.archive).toBe("Archive");
		expect(DOCUMENTS_COPY.archived).toBe("Archived");
		expect(DOCUMENTS_COPY.unarchive).toBe("Unarchive");
		expect(DOCUMENTS_COPY.folder).toBe("Folder");
		expect(DOCUMENTS_COPY.card).toBe("Card");
		expect(DOCUMENTS_COPY.parentDocument).toBe("Parent Document");
		expect(JSON.stringify(DOCUMENTS_COPY)).not.toMatch(DISCOVERY_COPY_PATTERN);
		expect(DOCUMENTS_COPY.documentTemplate).toBe("Document Template");
		expect(DOCUMENTS_COPY.convertToTemplate).toBe("Convert to template");
		expect(DOCUMENTS_COPY.createFromTemplate).toBe("Create from template");
		expect(DOCUMENTS_COPY.personalReview).toBe("Personal Review");
		expect(DOCUMENTS_COPY.versions).toBe("Versions");
		expect(DOCUMENTS_COPY.compare).toBe("Compare");
		expect(DOCUMENTS_COPY.restore).toBe("Restore");
		expect(DOCUMENTS_COPY.conflictDraft).toBe("Conflict Draft");
		expect(DOCUMENTS_COPY.copy).toBe("Copy");
		expect(DOCUMENTS_COPY.download).toBe("Download");
		expect(DOCUMENTS_COPY.version).toBe("Version");
		expect(DOCUMENTS_COPY.persona).toBe("Persona");
		expect(DOCUMENTS_COPY.retrospective).toBe("Retrospective");
		expect(DOCUMENTS_COPY.launchPlan).toBe("Launch Plan");
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
		await prisma.usageLink.deleteMany();
		await prisma.usageHostEmbed.deleteMany();
		await prisma.typedRelation.deleteMany();
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
		expect(created.status).toBe("committed");
		if (created.status !== "committed") {
			throw new Error("expected committed Document");
		}
		expect(created.document.body).toMatch(SPEC_HEADING_BODY);
		expect(created.document).toMatchObject({
			liveFilePath: null,
			title: "Payments spec",
			type: "Spec",
		});
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
				headings: markdownHeadingTitles(document.body),
				title: document.title,
				type: document.type,
			}))
		).toEqual([
			{
				headings: [...PERSONA_HEADINGS],
				title: "Persona",
				type: "Persona",
			},
			{
				headings: [...RETROSPECTIVE_HEADINGS],
				title: "Retrospective",
				type: "General",
			},
			{
				headings: [...LAUNCH_PLAN_HEADINGS],
				title: "Launch Plan",
				type: "General",
			},
		]);
		for (const document of materialized.documents) {
			expect(document.body).not.toMatch(SAMPLE_SKELETON_CONTENT);
			expect(document.liveFilePath).toBeNull();
			expect(document.body.replace(/^## .+$/gm, "").trim()).toBe("");
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
				body: `${materialized.documents[0]?.body ?? ""}\n\nFounder notes`,
				documentId: materialized.documents[0]?.id ?? "",
				title: "Primary buyer",
			},
			workspaceId,
		});
		expect(edited).toMatchObject({
			document: {
				title: "Primary buyer",
				type: "Persona",
			},
			status: "committed",
		});
		if (edited.status !== "committed") {
			throw new Error("expected committed Document");
		}
		expect(edited.document.body).toContain("Founder notes");
		expect(markdownHeadingTitles(edited.document.body)).toEqual([
			...PERSONA_HEADINGS,
		]);
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

	it("lists application versions after create and keeps earlier ones after edit", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const created = await createDocument(prisma, {
			actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				body: "alpha",
				scope: { kind: "project", projectId: project.id },
				title: "Payments spec",
				type: "Spec",
			},
			workspaceId,
		});
		if (created.status !== "committed") {
			throw new Error("expected committed Document");
		}
		const afterCreate = await listDocumentVersions(prisma, {
			documentId: created.document.id,
			workspaceId,
		});
		expect(afterCreate).toEqual([
			expect.objectContaining({
				body: "alpha",
				documentId: created.document.id,
				revision: 1,
				title: "Payments spec",
				type: "Spec",
			}),
		]);
		const updated = await updateDocument(prisma, {
			actorId,
			baseRevision: created.document.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				body: "beta",
				documentId: created.document.id,
			},
			workspaceId,
		});
		if (updated.status !== "committed") {
			throw new Error("expected committed Document");
		}
		const afterEdit = await listDocumentVersions(prisma, {
			documentId: created.document.id,
			workspaceId,
		});
		expect(afterEdit).toEqual([
			expect.objectContaining({ body: "alpha", revision: 1 }),
			expect.objectContaining({ body: "beta", revision: 2 }),
		]);
	});

	it("compares two Document versions as body hunks, not a Git commit", async () => {
		expect(presentDocumentVersionDiff("alpha\n", "beta\n")).toEqual([
			{ kind: "removed", text: "alpha\n" },
			{ kind: "added", text: "beta\n" },
		]);
		const { actorId, project, workspaceId } = await openProject(prisma);
		const created = await createDocument(prisma, {
			actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				body: "alpha\n",
				scope: { kind: "project", projectId: project.id },
				title: "Payments spec",
				type: "Spec",
			},
			workspaceId,
		});
		if (created.status !== "committed") {
			throw new Error("expected committed Document");
		}
		const updated = await updateDocument(prisma, {
			actorId,
			baseRevision: created.document.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				body: "beta\n",
				documentId: created.document.id,
			},
			workspaceId,
		});
		if (updated.status !== "committed") {
			throw new Error("expected committed Document");
		}
		const compared = await compareDocumentVersions(prisma, {
			documentId: created.document.id,
			leftRevision: 1,
			rightRevision: 2,
			workspaceId,
		});
		expect(compared).toMatchObject({
			hunks: [
				{ kind: "removed", text: "alpha\n" },
				{ kind: "added", text: "beta\n" },
			],
			left: { body: "alpha\n", revision: 1 },
			right: { body: "beta\n", revision: 2 },
		});
	});

	it("restores a selected version as a new tip without deleting history or writing a live file", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const files = createMemoryLiveFiles();
		const created = await createDocument(
			prisma,
			{
				actorId,
				idempotencyKey: crypto.randomUUID(),
				origin: "human",
				payload: {
					body: "alpha",
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
					body: "beta",
					documentId: created.document.id,
					title: "Payments spec v2",
				},
				workspaceId,
			},
			{ files }
		);
		if (updated.status !== "committed") {
			throw new Error("expected committed Document");
		}
		const restored = await restoreDocumentVersion(
			prisma,
			{
				actorId,
				baseRevision: updated.document.revision,
				idempotencyKey: crypto.randomUUID(),
				origin: "human",
				payload: {
					documentId: created.document.id,
					versionRevision: 1,
				},
				workspaceId,
			},
			{ files }
		);
		expect(restored).toMatchObject({
			document: {
				body: "alpha",
				id: created.document.id,
				liveFilePath: null,
				revision: 3,
				title: "Payments spec",
				type: "Spec",
			},
			status: "committed",
		});
		expect(files.writes).toEqual([]);
		expect(await getDocument(prisma, created.document.id)).toMatchObject({
			body: "alpha",
			liveFilePath: null,
			revision: 3,
			title: "Payments spec",
		});
		const history = await listDocumentVersions(prisma, {
			documentId: created.document.id,
			workspaceId,
		});
		expect(history).toEqual([
			expect.objectContaining({
				body: "alpha",
				revision: 1,
				title: "Payments spec",
			}),
			expect.objectContaining({
				body: "beta",
				revision: 2,
				title: "Payments spec v2",
			}),
			expect.objectContaining({
				body: "alpha",
				revision: 3,
				title: "Payments spec",
			}),
		]);
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
				liveFilePath: null,
				title: "Week 36 review",
				type: "General",
			},
			status: "committed",
		});
		if (created.status !== "committed") {
			throw new Error("expected committed Document");
		}
		expect(created.document.body).toMatch(PERIOD_FILLED_BODY);
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
			id: created.document.id,
		});
		expect((await getDocument(prisma, created.document.id))?.body).toMatch(
			PERIOD_FILLED_BODY
		);
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
		expect(created.document.body).toMatch(PERSONAL_REVIEW_BODY);
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
				id: created.document.id,
			},
			status: "committed",
		});
		if (trimmed.status !== "committed") {
			throw new Error("expected committed Document");
		}
		expect(trimmed.document.body).toMatch(PERIOD_TRIMMED_BODY);
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
				scope: { kind: "personal-wiki" },
				title: "Wiki instance",
			},
			status: "committed",
		});
		if (created.status !== "committed") {
			throw new Error("expected committed Document");
		}
		expect(created.document.body).toMatch(NOTE_HEADING_BODY);
	});
});

describe("In-doc tags", () => {
	it("binds #tag in prose to the Workspace tag identity and ignores code, URLs, and escapes", () => {
		const body = [
			"Ship #billing today.",
			"",
			"```ts",
			"const token = '#billing';",
			"```",
			"",
			"Inline `#billing` stays code.",
			"See https://example.com/#billing and [docs](https://example.com/path#billing).",
			"Escaped \\#billing is text.",
			"# Heading is not a tag",
			"Unknown #notATag stays unbound.",
		].join("\n");
		expect(resolveInDocTags(body, [BILLING])).toEqual({
			ignored: ["notATag"],
			resolved: [BILLING],
		});
	});

	it("derives a child Card from the child body without a cover record", () => {
		expect(
			presentDocumentChildCard({
				body: [
					"# Heading",
					"",
					"![skip](https://example.com/file.svg)",
					"![shot](https://cdn.example.com/hero.png)",
					"Opening paragraph for the child.",
					"```ts",
					"not preview",
					"```",
				].join("\n"),
				documentId: "doc-child",
				title: "Child",
				type: "Spec",
			})
		).toEqual({
			documentId: "doc-child",
			imageUrl: "https://cdn.example.com/hero.png",
			preview: "Opening paragraph for the child.",
			title: "Child",
			type: "Spec",
		});
		expect(
			presentDocumentChildCard({
				body: "",
				documentId: "doc-empty",
				title: "Empty",
				type: "General",
			})
		).toEqual({
			documentId: "doc-empty",
			imageUrl: null,
			preview: "Empty · General",
			title: "Empty",
			type: "General",
		});
		expect(JSON.stringify(DOCUMENTS_COPY.card)).not.toMatch(CARD_COVER_PATTERN);
	});
});

describe("Documents tags, hierarchy, and archive", () => {
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

	it("saves resolved in-doc tags without minting unknown tokens", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const createdTag = await createTag(prisma, {
			actorId,
			idempotencyKey: crypto.randomUUID(),
			name: "billing",
			origin: "human",
			workspaceId,
		});
		if (createdTag.status !== "committed") {
			throw new Error("expected committed Tag");
		}
		const before = await listTags(prisma, workspaceId);
		const created = await createDocument(prisma, {
			actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				body: [
					"Pay #billing now.",
					"```ts",
					"#billing",
					"```",
					"Visit https://example.com/#billing",
					"Also #ghost",
				].join("\n"),
				scope: { kind: "project", projectId: project.id },
				title: "Intake",
				type: "Spec",
			},
			workspaceId,
		});
		expect(created).toMatchObject({
			document: {
				inDocTags: [{ id: createdTag.tag.id, name: "billing" }],
			},
			status: "committed",
		});
		if (created.status !== "committed") {
			throw new Error("expected committed Document");
		}
		expect(await listTags(prisma, workspaceId)).toEqual(before);
		expect(
			await listTaggedDocuments(prisma, {
				tagId: createdTag.tag.id,
				workspaceId,
			})
		).toEqual([{ documentId: created.document.id, tagId: createdTag.tag.id }]);
	});

	it("blocks a fourth Document level in preview and does not flatten", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const root = await addDocument(
			prisma,
			actorId,
			workspaceId,
			project.id,
			"Root"
		);
		const child = await addDocument(
			prisma,
			actorId,
			workspaceId,
			project.id,
			"Child"
		);
		const grandchild = await addDocument(
			prisma,
			actorId,
			workspaceId,
			project.id,
			"Grandchild"
		);
		const extra = await addDocument(
			prisma,
			actorId,
			workspaceId,
			project.id,
			"Too deep"
		);
		const nestChild = await placeDocument(prisma, {
			actorId,
			baseRevision: child.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				documentId: child.id,
				folderId: null,
				parentId: root.id,
			},
			workspaceId,
		});
		if (nestChild.status !== "committed") {
			throw new Error("expected nested child");
		}
		const nestGrand = await placeDocument(prisma, {
			actorId,
			baseRevision: grandchild.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				documentId: grandchild.id,
				folderId: null,
				parentId: child.id,
			},
			workspaceId,
		});
		if (nestGrand.status !== "committed") {
			throw new Error("expected nested grandchild");
		}
		expect(
			await previewDocumentPlacement(prisma, {
				documentId: extra.id,
				folderId: null,
				parentId: grandchild.id,
				workspaceId,
			})
		).toEqual({ reason: "depth-exceeded", status: "blocked" });
		const placed = await placeDocument(prisma, {
			actorId,
			baseRevision: extra.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				documentId: extra.id,
				folderId: null,
				parentId: grandchild.id,
			},
			workspaceId,
		});
		expect(placed).toEqual({
			reason: "depth-exceeded",
			status: "rejected",
		});
		expect(await getDocument(prisma, extra.id)).toMatchObject({
			id: extra.id,
			parentId: null,
		});
		expect(await getDocument(prisma, grandchild.id)).toMatchObject({
			id: grandchild.id,
			parentId: child.id,
		});
	});

	it("keeps identity, scope, and archive state when placing under a parent in the same scope", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const folder = await createDocumentFolder(prisma, {
			actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				name: "Specs",
				scope: { kind: "project", projectId: project.id },
			},
			workspaceId,
		});
		expect(folder).toMatchObject({
			folder: { name: "Specs" },
			status: "committed",
		});
		if (folder.status !== "committed") {
			throw new Error("expected folder");
		}
		expect(JSON.stringify(folder.folder)).not.toMatch(SMART_COLLECTION_PATTERN);
		const parent = await addDocument(
			prisma,
			actorId,
			workspaceId,
			project.id,
			"Parent"
		);
		const child = await addDocument(
			prisma,
			actorId,
			workspaceId,
			project.id,
			"Child"
		);
		const placed = await placeDocument(prisma, {
			actorId,
			baseRevision: child.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				documentId: child.id,
				folderId: folder.folder.id,
				parentId: parent.id,
			},
			workspaceId,
		});
		expect(placed).toMatchObject({
			document: {
				archived: false,
				folderId: folder.folder.id,
				id: child.id,
				parentId: parent.id,
				revision: child.revision,
				scope: { kind: "project", projectId: project.id },
				title: "Child",
			},
			status: "committed",
		});
		expect(await getDocument(prisma, parent.id)).toMatchObject({
			childCards: [
				{
					documentId: child.id,
					imageUrl: null,
					preview: "Child",
					title: "Child",
					type: "General",
				},
			],
			id: parent.id,
		});
		const archivedChild = await archiveDocument(prisma, {
			actorId,
			baseRevision: placed.document.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: { documentId: child.id },
			workspaceId,
		});
		expect(archivedChild).toMatchObject({
			document: { archived: true, id: child.id, parentId: parent.id },
			status: "committed",
		});
		if (archivedChild.status !== "committed") {
			throw new Error("expected archived child");
		}
		expect(await getDocument(prisma, parent.id)).toMatchObject({
			childCards: [],
			id: parent.id,
		});
		const moved = await placeDocument(prisma, {
			actorId,
			baseRevision: archivedChild.document.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				documentId: child.id,
				folderId: folder.folder.id,
				parentId: parent.id,
			},
			workspaceId,
		});
		expect(moved).toMatchObject({
			document: {
				archived: true,
				folderId: folder.folder.id,
				id: child.id,
				parentId: parent.id,
			},
			status: "committed",
		});
		const wiki = await addDocument(
			prisma,
			actorId,
			workspaceId,
			null,
			"Wiki note"
		);
		expect(
			await previewDocumentPlacement(prisma, {
				documentId: wiki.id,
				folderId: null,
				parentId: parent.id,
				workspaceId,
			})
		).toEqual({ reason: "cross-scope-parent", status: "blocked" });
		expect(
			await listDocumentFolders(prisma, {
				scope: { kind: "project", projectId: project.id },
				workspaceId,
			})
		).toEqual([folder.folder]);
	});

	it("archives a Document out of default navigation without deleting identity, relations, or children", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const parent = await addDocument(
			prisma,
			actorId,
			workspaceId,
			project.id,
			"Parent"
		);
		const child = await addDocument(
			prisma,
			actorId,
			workspaceId,
			project.id,
			"Child"
		);
		const nested = await placeDocument(prisma, {
			actorId,
			baseRevision: child.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				documentId: child.id,
				folderId: null,
				parentId: parent.id,
			},
			workspaceId,
		});
		if (nested.status !== "committed") {
			throw new Error("expected nested child");
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
			to: { id: parent.id, kind: "Document" },
			type: RELATIONS_COPY.related,
			viewerWorkspaceId: workspaceId,
		});
		expect(related.status).toBe("committed");
		const before = await listRelations(prisma, {
			record: { id: parent.id, kind: "Document" },
			viewerWorkspaceId: workspaceId,
		});
		expect(
			await previewDocumentArchive(prisma, {
				documentId: parent.id,
				workspaceId,
			})
		).toEqual({
			childTitles: ["Child"],
			documentId: parent.id,
			status: "ok",
		});
		const archived = await archiveDocument(prisma, {
			actorId,
			baseRevision: parent.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: { documentId: parent.id },
			workspaceId,
		});
		expect(archived).toMatchObject({
			document: {
				archived: true,
				id: parent.id,
				title: "Parent",
			},
			status: "committed",
		});
		if (archived.status !== "committed") {
			throw new Error("expected archived Document");
		}
		expect(JSON.stringify(archived.document)).not.toMatch(TRASH_PATTERN);
		expect(
			await listDocuments(prisma, {
				scope: { kind: "project", projectId: project.id },
				workspaceId,
			})
		).toEqual([await getDocument(prisma, child.id)]);
		expect(
			await listDocuments(prisma, {
				archived: true,
				scope: { kind: "project", projectId: project.id },
				workspaceId,
			})
		).toEqual([archived.document]);
		expect(await getDocument(prisma, parent.id)).toEqual(archived.document);
		expect(await getDocument(prisma, child.id)).toMatchObject({
			parentId: parent.id,
		});
		expect(
			await listRelations(prisma, {
				record: { id: parent.id, kind: "Document" },
				viewerWorkspaceId: workspaceId,
			})
		).toEqual(before);
		const restored = await unarchiveDocument(prisma, {
			actorId,
			baseRevision: archived.document.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: { documentId: parent.id },
			workspaceId,
		});
		expect(restored).toMatchObject({
			document: { archived: false, id: parent.id },
			status: "committed",
		});
		if (restored.status !== "committed") {
			throw new Error("expected unarchived Document");
		}
		expect(
			await listDocuments(prisma, {
				scope: { kind: "project", projectId: project.id },
				workspaceId,
			})
		).toEqual(
			expect.arrayContaining([
				restored.document,
				await getDocument(prisma, child.id),
			])
		);
	});
});

async function addDocument(
	prisma: PrismaClient,
	actorId: string,
	workspaceId: string,
	projectId: string | null,
	title: string
) {
	const created = await createDocument(prisma, {
		actorId,
		idempotencyKey: crypto.randomUUID(),
		origin: "human",
		payload: {
			body: title,
			scope: projectId
				? { kind: "project", projectId }
				: { kind: "personal-wiki" },
			title,
			type: "General",
		},
		workspaceId,
	});
	if (created.status !== "committed") {
		throw new Error("expected committed Document");
	}
	return created.document;
}

async function staleConflictDraft(
	prisma: PrismaClient,
	input: {
		actorId: string;
		currentBody: string;
		projectId: string;
		rejectedBody: string;
		title: string;
		workspaceId: string;
	}
) {
	const created = await createDocument(prisma, {
		actorId: input.actorId,
		idempotencyKey: crypto.randomUUID(),
		origin: "human",
		payload: {
			body: input.currentBody,
			scope: { kind: "project", projectId: input.projectId },
			title: input.title,
			type: "Spec",
		},
		workspaceId: input.workspaceId,
	});
	if (created.status !== "committed") {
		throw new Error("expected committed Document");
	}
	const current = await updateDocument(prisma, {
		actorId: input.actorId,
		baseRevision: created.document.revision,
		idempotencyKey: crypto.randomUUID(),
		origin: "human",
		payload: {
			body: input.currentBody,
			documentId: created.document.id,
			title: `${input.title} live`,
		},
		workspaceId: input.workspaceId,
	});
	if (current.status !== "committed") {
		throw new Error("expected current Document save");
	}
	const stale = await updateDocument(prisma, {
		actorId: input.actorId,
		baseRevision: created.document.revision,
		idempotencyKey: crypto.randomUUID(),
		origin: "human",
		payload: {
			body: input.rejectedBody,
			documentId: created.document.id,
			title: input.title,
		},
		workspaceId: input.workspaceId,
	});
	return { created: created.document, current: current.document, stale };
}

describe("Conflict Draft", () => {
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
		await prisma.usageLink.deleteMany();
		await prisma.usageHostEmbed.deleteMany();
		await prisma.typedRelation.deleteMany();
		await prisma.mutationReceipt.deleteMany();
		await prisma.workspace.deleteMany();
		await prisma.user.deleteMany();
		await prisma.$disconnect();
		await pool.end();
	});

	it("keeps the current Document and stores rejected text as a Conflict Draft", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const { current, stale } = await staleConflictDraft(prisma, {
			actorId,
			currentBody: "live body",
			projectId: project.id,
			rejectedBody: "rejected body",
			title: "Payments spec",
			workspaceId,
		});
		expect(stale).toMatchObject({
			conflict: DOCUMENTS_COPY.conflictDraft,
			document: {
				body: "live body",
				id: current.id,
				revision: current.revision,
				title: "Payments spec live",
			},
			draft: {
				body: "rejected body",
				documentId: current.id,
				documentRevision: current.revision,
				rejectedBaseRevision: 1,
				title: "Payments spec",
			},
			status: "conflict",
		});
		expect(await getDocument(prisma, current.id)).toMatchObject({
			body: "live body",
			revision: current.revision,
			title: "Payments spec live",
		});
		expect(await getConflictDraft(prisma, current.id, workspaceId)).toEqual(
			stale.status === "conflict" && "draft" in stale ? stale.draft : null
		);
	});

	it("keeps one Conflict Draft per Document and replaces it with later rejected text", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const { current } = await staleConflictDraft(prisma, {
			actorId,
			currentBody: "live body",
			projectId: project.id,
			rejectedBody: "first rejected",
			title: "Payments spec",
			workspaceId,
		});
		const later = await updateDocument(prisma, {
			actorId,
			baseRevision: 1,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				body: "second rejected",
				documentId: current.id,
				title: "Payments spec later",
			},
			workspaceId,
		});
		expect(later).toMatchObject({
			conflict: DOCUMENTS_COPY.conflictDraft,
			document: { body: "live body", id: current.id },
			draft: {
				body: "second rejected",
				documentId: current.id,
				title: "Payments spec later",
			},
			status: "conflict",
		});
		expect(await getDocument(prisma, current.id)).toMatchObject({
			body: "live body",
		});
		expect(
			await getConflictDraft(prisma, current.id, workspaceId)
		).toMatchObject({
			body: "second rejected",
		});
	});

	it("keeps an unresolved Conflict Draft out of Document list and version history", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const { current, stale } = await staleConflictDraft(prisma, {
			actorId,
			currentBody: "listed body",
			projectId: project.id,
			rejectedBody: "hidden rejected",
			title: "Payments spec",
			workspaceId,
		});
		expect(stale.status).toBe("conflict");
		const listed = await listDocuments(prisma, {
			scope: { kind: "project", projectId: project.id },
			workspaceId,
		});
		expect(listed).toHaveLength(1);
		expect(listed[0]?.id).toBe(current.id);
		expect(listed[0]?.body).toBe("listed body");
		expect(JSON.stringify(listed)).not.toContain("hidden rejected");
		const history = await listDocumentVersions(prisma, {
			documentId: current.id,
			workspaceId,
		});
		expect(history?.map((version) => version.body)).toEqual([
			"listed body",
			"listed body",
		]);
		expect(JSON.stringify(history)).not.toContain("hidden rejected");
	});

	it("applies chosen Conflict Draft parts as a new Document version and resolves the draft", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const { current } = await staleConflictDraft(prisma, {
			actorId,
			currentBody: "keep\nchange-me\n",
			projectId: project.id,
			rejectedBody: "keep\nchanged\n",
			title: "Payments spec",
			workspaceId,
		});
		const compared = await compareConflictDraft(prisma, {
			documentId: current.id,
			workspaceId,
		});
		expect(compared?.hunks).toEqual(
			presentDocumentVersionDiff("keep\nchange-me\n", "keep\nchanged\n")
		);
		const applied = await applyConflictDraft(prisma, {
			actorId,
			baseRevision: current.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				documentId: current.id,
				hunkChoices: ["current", "draft", "draft"],
			},
			workspaceId,
		});
		expect(applied).toMatchObject({
			document: {
				body: "keep\nchanged\n",
				id: current.id,
			},
			status: "committed",
		});
		expect(await getConflictDraft(prisma, current.id, workspaceId)).toBeNull();
		expect(
			await listDocumentVersions(prisma, {
				documentId: current.id,
				workspaceId,
			})
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ body: "keep\nchanged\n" }),
			])
		);
	});

	it("creates an independent Document from the draft with Origin and resolves the draft", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const { current } = await staleConflictDraft(prisma, {
			actorId,
			currentBody: "live body",
			projectId: project.id,
			rejectedBody: "created body",
			title: "Payments spec",
			workspaceId,
		});
		const createdFromDraft = await createDocumentFromConflictDraft(prisma, {
			actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				documentId: current.id,
				title: "Created spec",
			},
			workspaceId,
		});
		expect(createdFromDraft).toMatchObject({
			document: {
				body: "created body",
				title: "Created spec",
				type: "Spec",
			},
			status: "committed",
		});
		if (createdFromDraft.status !== "committed") {
			throw new Error("expected created Document");
		}
		expect(createdFromDraft.document.id).not.toBe(current.id);
		expect(await getDocument(prisma, current.id)).toMatchObject({
			body: "live body",
			id: current.id,
		});
		expect(await getConflictDraft(prisma, current.id, workspaceId)).toBeNull();
		const listed = await listDocuments(prisma, {
			scope: { kind: "project", projectId: project.id },
			workspaceId,
		});
		expect(listed.map((row) => row.id).sort()).toEqual(
			[current.id, createdFromDraft.document.id].sort()
		);
		const relations = await listRelations(prisma, {
			record: { id: createdFromDraft.document.id, kind: "Document" },
			viewerWorkspaceId: workspaceId,
		});
		expect(relations).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					from: expect.objectContaining({
						id: createdFromDraft.document.id,
						kind: "Document",
					}),
					to: expect.objectContaining({
						id: current.id,
						kind: "Document",
					}),
					type: RELATIONS_COPY.origin,
				}),
			])
		);
	});

	it("deletes a Conflict Draft without changing the current Document", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const { current } = await staleConflictDraft(prisma, {
			actorId,
			currentBody: "live body",
			projectId: project.id,
			rejectedBody: "rejected body",
			title: "Payments spec",
			workspaceId,
		});
		const deleted = await deleteConflictDraft(prisma, {
			actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: { documentId: current.id },
			workspaceId,
		});
		expect(deleted).toMatchObject({
			document: { body: "live body", id: current.id },
			status: "committed",
		});
		expect(await getConflictDraft(prisma, current.id, workspaceId)).toBeNull();
		expect(await getDocument(prisma, current.id)).toMatchObject({
			body: "live body",
			revision: current.revision,
		});
	});

	it("saves against the last base revision as reconnect does and does not overwrite live text", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const { created, current, stale } = await staleConflictDraft(prisma, {
			actorId,
			currentBody: "server body",
			projectId: project.id,
			rejectedBody: "reconnect buffer",
			title: "Payments spec",
			workspaceId,
		});
		expect(stale.status).toBe("conflict");
		expect(created.revision).toBe(1);
		expect(current.revision).toBe(2);
		expect(await getDocument(prisma, current.id)).toMatchObject({
			body: "server body",
			revision: 2,
		});
		expect(
			await getConflictDraft(prisma, current.id, workspaceId)
		).toMatchObject({
			body: "reconnect buffer",
			rejectedBaseRevision: 1,
		});
	});
});
