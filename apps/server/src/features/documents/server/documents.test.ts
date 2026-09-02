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

import {
	listFileAttachments,
	relateFileAttachment,
} from "../../file-attachments/server/file-attachments";
import {
	FILE_KIND,
	FILE_LIFECYCLE,
} from "../../file-attachments/server/file-attachments-model";
import { createProject } from "../../project-shell/server/project-shell";
import { PROJECT_LIFECYCLE } from "../../project-shell/server/project-shell-model";
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
import {
	createWork,
	getWork,
} from "../../work-lifecycle/server/work-lifecycle";
import {
	archiveDocument,
	compareDocumentVersions,
	convertDocumentToTemplate,
	copyDocument,
	createDocument,
	createDocumentFolder,
	createDocumentTemplate,
	exportDocument,
	getDocument,
	getDocumentTemplate,
	instantiateDocumentFromTemplate,
	listDocumentFolders,
	listDocuments,
	listDocumentTemplates,
	listDocumentVersions,
	materializeStarterSkeletonDocuments,
	moveDocument,
	placeDocument,
	previewConvertDocumentToTemplate,
	previewDocumentArchive,
	previewDocumentMove,
	previewDocumentPlacement,
	restoreDocumentVersion,
	unarchiveDocument,
	updateDocument,
	updateDocumentTemplate,
} from "./documents";
import { liveWorkFence } from "./documents-live";
import {
	createMemoryExternalSurfaces,
	createMemoryLiveFiles,
	DOCUMENT_OWNED_FILE_KIND,
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
const WORD_EXPORT_PATTERN = /Word|docx/i;
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
			exportFormats: ["Markdown", "PDF"],
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
		expect(DOCUMENTS_COPY.move).toBe("Move");
		expect(DOCUMENTS_COPY.copy).toBe("Copy");
		expect(DOCUMENTS_COPY.export).toBe("Export");
		expect(DOCUMENTS_COPY.markdown).toBe("Markdown");
		expect(DOCUMENTS_COPY.pdf).toBe("PDF");
		expect(JSON.stringify(documentsCatalog())).not.toMatch(WORD_EXPORT_PATTERN);
		expect(JSON.stringify(DOCUMENTS_COPY)).not.toMatch(DISCOVERY_COPY_PATTERN);
		expect(DOCUMENTS_COPY.documentTemplate).toBe("Document Template");
		expect(DOCUMENTS_COPY.convertToTemplate).toBe("Convert to template");
		expect(DOCUMENTS_COPY.createFromTemplate).toBe("Create from template");
		expect(DOCUMENTS_COPY.personalReview).toBe("Personal Review");
		expect(DOCUMENTS_COPY.versions).toBe("Versions");
		expect(DOCUMENTS_COPY.compare).toBe("Compare");
		expect(DOCUMENTS_COPY.restore).toBe("Restore");
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

	it("previews Move with target, selection, broken refs, and publish effect, then keeps identity", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const wikiTarget = { kind: "personal-wiki" as const };
		const root = await addDocument(
			prisma,
			actorId,
			workspaceId,
			project.id,
			"Root spec"
		);
		const child = await addDocument(
			prisma,
			actorId,
			workspaceId,
			project.id,
			"Child spec"
		);
		const skipped = await addDocument(
			prisma,
			actorId,
			workspaceId,
			project.id,
			"Skipped child"
		);
		await placeDocument(prisma, {
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
		await placeDocument(prisma, {
			actorId,
			baseRevision: skipped.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				documentId: skipped.id,
				folderId: null,
				parentId: root.id,
			},
			workspaceId,
		});
		const work = await createWork(prisma, {
			actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: { projectId: project.id, title: "Stay in project" },
		});
		if (work.status !== "committed") {
			throw new Error("expected committed Work");
		}
		const withWork = await updateDocument(prisma, {
			actorId,
			baseRevision: (await getDocument(prisma, root.id))?.revision ?? 0,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				body: liveWorkFence(work.work.id),
				documentId: root.id,
			},
			workspaceId,
		});
		if (withWork.status !== "committed") {
			throw new Error("expected committed Document");
		}
		const owned = await seedOwnedFile(
			prisma,
			workspaceId,
			project.id,
			root.id,
			"Owned note"
		);
		const stray = await seedOwnedFile(
			prisma,
			workspaceId,
			project.id,
			crypto.randomUUID(),
			"Stray file"
		);
		const surfaces = createMemoryExternalSurfaces();
		const preview = await previewDocumentMove(
			prisma,
			{
				childDocumentIds: [child.id],
				documentId: root.id,
				target: wikiTarget,
				workspaceId,
			},
			{ surfaces }
		);
		expect(preview).toMatchObject({
			detachedChildIds: [skipped.id],
			movedAttachmentIds: [owned],
			selectedDocumentIds: [root.id, child.id],
			status: "ok",
			target: wikiTarget,
			workIds: [work.work.id],
		});
		if (preview.status !== "ok") {
			throw new Error("expected Move preview");
		}
		expect(preview.brokenReferences).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					kind: "child-detached",
					sourceId: skipped.id,
				}),
				expect.objectContaining({
					kind: "unowned-attachment",
					sourceId: stray,
				}),
			])
		);
		const moved = await moveDocument(
			prisma,
			{
				actorId,
				baseRevision: withWork.document.revision,
				idempotencyKey: crypto.randomUUID(),
				origin: "human",
				payload: {
					childDocumentIds: [child.id],
					documentId: root.id,
					target: wikiTarget,
				},
				workspaceId,
			},
			{ surfaces }
		);
		expect(moved.status).toBe("committed");
		if (moved.status !== "committed") {
			throw new Error("expected committed Move");
		}
		expect(moved.document.id).toBe(root.id);
		expect(moved.document.scope).toEqual(wikiTarget);
		expect(await getDocument(prisma, root.id)).toMatchObject({
			id: root.id,
			scope: wikiTarget,
		});
		expect(await getDocument(prisma, child.id)).toMatchObject({
			parentId: root.id,
			scope: wikiTarget,
		});
		expect(await getDocument(prisma, skipped.id)).toMatchObject({
			parentId: null,
			scope: { kind: "project", projectId: project.id },
		});
		expect(
			await listFileAttachments(prisma, {
				scope: wikiTarget,
				workspaceId,
			})
		).toEqual([expect.objectContaining({ id: owned })]);
		expect(
			await listFileAttachments(prisma, {
				scope: { kind: "project", projectId: project.id },
				workspaceId,
			})
		).toEqual([expect.objectContaining({ id: stray })]);
		expect(await getWork(prisma, work.work.id)).toMatchObject({
			projectId: project.id,
		});
	});

	it("cancels an active External Surface before Move and keeps the old surface in the source scope", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const root = await addDocument(
			prisma,
			actorId,
			workspaceId,
			project.id,
			"Shared spec"
		);
		const surfaces = createMemoryExternalSurfaces();
		const surfaceId = surfaces.activate(root.id, {
			kind: "project",
			projectId: project.id,
		});
		const blocked = await moveDocument(
			prisma,
			{
				actorId,
				baseRevision: root.revision,
				idempotencyKey: crypto.randomUUID(),
				origin: "human",
				payload: {
					childDocumentIds: [],
					documentId: root.id,
					target: { kind: "personal-wiki" },
				},
				workspaceId,
			},
			{ surfaces }
		);
		expect(blocked).toEqual({
			reason: "external-surface-active",
			status: "rejected",
		});
		expect(surfaces.listActive(root.id).map((row) => row.id)).toEqual([
			surfaceId,
		]);
		const moved = await moveDocument(
			prisma,
			{
				actorId,
				baseRevision: root.revision,
				idempotencyKey: crypto.randomUUID(),
				origin: "human",
				payload: {
					cancelExternalSurfaces: true,
					childDocumentIds: [],
					documentId: root.id,
					target: { kind: "personal-wiki" },
				},
				workspaceId,
			},
			{ surfaces }
		);
		expect(moved.status).toBe("committed");
		expect(surfaces.listActive(root.id)).toEqual([]);
		expect(surfaces.listHistorical(root.id)).toEqual([
			expect.objectContaining({
				historicalScope: { kind: "project", projectId: project.id },
				id: surfaceId,
				revoked: true,
			}),
		]);
	});

	it("refuses Move when the source Project is not Active", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const root = await addDocument(
			prisma,
			actorId,
			workspaceId,
			project.id,
			"Closed project spec"
		);
		await prisma.project.update({
			data: { lifecycleStatus: PROJECT_LIFECYCLE.completed },
			where: { id: project.id },
		});
		expect(
			await previewDocumentMove(prisma, {
				childDocumentIds: [],
				documentId: root.id,
				target: { kind: "personal-wiki" },
				workspaceId,
			})
		).toEqual({
			reason: "source-project-not-active",
			status: "blocked",
		});
	});

	it("copies a Document as a new identity with origin and without history or relations", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const source = await addDocument(
			prisma,
			actorId,
			workspaceId,
			project.id,
			"Source spec"
		);
		const edited = await updateDocument(prisma, {
			actorId,
			baseRevision: source.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: { body: "Version two", documentId: source.id },
			workspaceId,
		});
		if (edited.status !== "committed") {
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
		await createRelation(prisma, {
			actorId,
			from: { id: work.work.id, kind: "Work" },
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			previewAcknowledged: true,
			to: { id: source.id, kind: "Document" },
			type: RELATIONS_COPY.related,
			viewerWorkspaceId: workspaceId,
		});
		const copied = await copyDocument(prisma, {
			actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: { documentId: source.id },
			workspaceId,
		});
		expect(copied.status).toBe("committed");
		if (copied.status !== "committed") {
			throw new Error("expected committed Copy");
		}
		expect(copied.document.id).not.toBe(source.id);
		expect(copied.document.originDocumentId).toBe(source.id);
		expect(copied.document.body).toBe(edited.document.body);
		expect(
			await listDocumentVersions(prisma, {
				documentId: copied.document.id,
				workspaceId,
			})
		).toEqual([expect.objectContaining({ body: "Version two", revision: 1 })]);
		expect(
			await listRelations(prisma, {
				record: { id: copied.document.id, kind: "Document" },
				viewerWorkspaceId: workspaceId,
			})
		).toEqual([expect.objectContaining({ type: RELATIONS_COPY.origin })]);
		const changed = await updateDocument(prisma, {
			actorId,
			baseRevision: copied.document.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: { body: "Copy only", documentId: copied.document.id },
			workspaceId,
		});
		expect(changed.status).toBe("committed");
		expect(await getDocument(prisma, source.id)).toMatchObject({
			body: edited.document.body,
		});
		expect(await getDocument(prisma, copied.document.id)).toMatchObject({
			body: expect.stringContaining("Copy only"),
			originDocumentId: source.id,
		});
	});

	it("exports Markdown and PDF as dated labeled live-block snapshots and refuses Word", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const work = await createWork(prisma, {
			actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: { projectId: project.id, title: "Alpha" },
		});
		if (work.status !== "committed") {
			throw new Error("expected committed Work");
		}
		const created = await createDocument(prisma, {
			actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				body: liveWorkFence(work.work.id),
				scope: { kind: "project", projectId: project.id },
				title: "Live spec",
				type: "Spec",
			},
			workspaceId,
		});
		if (created.status !== "committed") {
			throw new Error("expected committed Document");
		}
		const clock = { now: () => new Date("2026-09-02T12:00:00.000Z") };
		const markdown = await exportDocument(
			prisma,
			{ documentId: created.document.id, format: "markdown" },
			{ clock }
		);
		expect(markdown.status).toBe("ok");
		if (markdown.status !== "ok" || markdown.format !== "markdown") {
			throw new Error("expected Markdown export");
		}
		expect(markdown.markdown).toContain("Snapshot");
		expect(markdown.markdown).toContain("Live Work block");
		expect(markdown.markdown).toContain("2026-09-02");
		expect(markdown.markdown).toContain("Alpha");
		expect(markdown.markdown).not.toContain("```live-work");
		const pdf = await exportDocument(
			prisma,
			{ documentId: created.document.id, format: "pdf" },
			{ clock }
		);
		expect(pdf.status).toBe("ok");
		if (pdf.status !== "ok" || pdf.format !== "pdf") {
			throw new Error("expected PDF export");
		}
		const pdfText = new TextDecoder().decode(pdf.pdf);
		expect(pdfText.startsWith("%PDF-")).toBe(true);
		expect(pdfText).toContain("Snapshot");
		expect(pdfText).toContain("2026-09-02");
		expect(
			await exportDocument(prisma, {
				documentId: created.document.id,
				format: "word",
			})
		).toEqual({ reason: "word-export-forbidden", status: "rejected" });
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

async function seedOwnedFile(
	prisma: PrismaClient,
	workspaceId: string,
	projectId: string,
	documentId: string,
	title: string
): Promise<string> {
	const id = crypto.randomUUID();
	await prisma.fileAttachment.create({
		data: {
			id,
			lifecycle: FILE_LIFECYCLE.active,
			projectId,
			revision: 1,
			scopeKind: "project",
			title,
			workspaceId,
		},
	});
	await prisma.fileAttachmentVersion.create({
		data: {
			byteLength: 4,
			contentHash: `hash-${id}`,
			fileAttachmentId: id,
			filename: `${title}.txt`,
			id: crypto.randomUUID(),
			kind: FILE_KIND.text,
			mimeType: "text/plain",
			objectKey: `obj-${id}`,
			versionNumber: 1,
		},
	});
	await relateFileAttachment(prisma, {
		fileAttachmentId: id,
		kind: DOCUMENT_OWNED_FILE_KIND,
		targetId: documentId,
	});
	return id;
}
