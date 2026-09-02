/**
 * Documents seam — live blocks, inline usage links, convert-to-record,
 * and version-pinned evidence vs live section. Evidence environment
 * for docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Belge bütünlüğü: live section vs pinned evidence; broken target
 * does not show old content).
 */
import { PrismaClient } from "@cantiara/db";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createProject } from "../../project-shell/server/project-shell";
import {
	listRelations,
	listUsageLinksForHosts,
} from "../../relations/server/relations";
import { RELATIONS_COPY } from "../../relations/server/relations-catalog";
import { USAGE_KIND } from "../../relations/server/relations-model";
import {
	changeWorkStatus,
	closeWork,
	createWork,
} from "../../work-lifecycle/server/work-lifecycle";
import { createDocument, getDocument, updateDocument } from "./documents";
import {
	convertList,
	convertListFingerprint,
	convertMermaidFingerprint,
	convertMermaidToTechnicalDiagram,
	convertSelection,
	convertSelectionFingerprint,
	createMemoryTechnicalDiagramImport,
	pinVersionPinnedEvidence,
	previewConvertList,
	previewConvertMermaid,
	previewConvertSelection,
} from "./documents-convert";
import {
	ensureSectionIds,
	inlineRecordMarkdown,
	liveCollectionFence,
	liveDiagramFence,
	liveDiagramViewFence,
	liveSectionFence,
	liveWorkFence,
	presentLiveDocumentBody,
	stripSectionIds,
} from "./documents-live";
import { DOCUMENTS_COPY } from "./documents-model";

const DATABASE_URL =
	process.env.DATABASE_URL ??
	"postgresql://cantiara:cantiara@127.0.0.1:5432/cantiara";

const SECTION_ID_MARK = /\{#([^}]+)\}/;

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

async function addDocument(
	prisma: PrismaClient,
	input: {
		actorId: string;
		body: string;
		projectId: string;
		title: string;
		workspaceId: string;
	}
) {
	const created = await createDocument(prisma, {
		actorId: input.actorId,
		idempotencyKey: crypto.randomUUID(),
		origin: "human",
		payload: {
			body: input.body,
			scope: { kind: "project", projectId: input.projectId },
			title: input.title,
			type: "Spec",
		},
		workspaceId: input.workspaceId,
	});
	if (created.status !== "committed") {
		throw new Error("expected committed Document");
	}
	return created.document;
}

describe("Document section ids", () => {
	it("strips live section ids so a template skeleton does not reuse Document identity", () => {
		const withIds = ensureSectionIds("## Notes\n\nHello {{period}}\n");
		expect(withIds).toMatch(SECTION_ID_MARK);
		expect(stripSectionIds(withIds)).toBe("## Notes\n\nHello {{period}}\n");
	});
});

describe("Documents live blocks and convert", () => {
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

	it("keeps inline reference identity as a usage link, not a Related copy", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const work = await createWork(prisma, {
			actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: { projectId: project.id, title: "Checkout" },
		});
		if (work.status !== "committed") {
			throw new Error("expected Work");
		}
		const document = await addDocument(prisma, {
			actorId,
			body: `See ${inlineRecordMarkdown("Checkout", "Work", work.work.id)}.`,
			projectId: project.id,
			title: "Spec",
			workspaceId,
		});
		const hosted = await listUsageLinksForHosts(prisma, workspaceId, [
			document.id,
		]);
		expect(hosted[document.id]).toEqual([
			expect.objectContaining({
				hostRecordId: document.id,
				kind: USAGE_KIND.inlineRecordReference,
				sourceRecordId: work.work.id,
			}),
		]);
		expect(
			await listRelations(prisma, {
				record: { id: document.id, kind: "Document" },
				viewerWorkspaceId: workspaceId,
			})
		).toEqual([]);
		const presented = await presentLiveDocumentBody(prisma, {
			body: document.body,
			workspaceId,
		});
		expect(presented.blocks).toContainEqual(
			expect.objectContaining({
				kind: "inline-reference",
				resolution: "ok",
				sourceRecordId: work.work.id,
				title: "Checkout",
			})
		);
	});

	it("shows Live Work block fields from the source and ordinary Work commands", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const work = await createWork(prisma, {
			actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: { projectId: project.id, title: "Pay invoice" },
		});
		if (work.status !== "committed") {
			throw new Error("expected Work");
		}
		const document = await addDocument(prisma, {
			actorId,
			body: liveWorkFence(work.work.id),
			projectId: project.id,
			title: "Runbook",
			workspaceId,
		});
		const first = await presentLiveDocumentBody(prisma, {
			body: document.body,
			workspaceId,
		});
		expect(first.blocks).toContainEqual(
			expect.objectContaining({
				actions: {
					changeStatus: DOCUMENTS_COPY.changeStatus,
					close: DOCUMENTS_COPY.close,
					openSourceRecord: DOCUMENTS_COPY.openSourceRecord,
				},
				id: work.work.id,
				key: work.work.key,
				kind: "live-work",
				label: DOCUMENTS_COPY.liveWorkBlock,
				resolution: "ok",
				title: "Pay invoice",
				type: "Task",
				workStatus: "Not Started",
			})
		);
		const changed = await changeWorkStatus(prisma, {
			actorId,
			baseRevision: work.work.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			status: "In Progress",
			workId: work.work.id,
		});
		expect(changed.status).toBe("committed");
		if (changed.status !== "committed") {
			throw new Error("expected status write");
		}
		const afterStatus = await presentLiveDocumentBody(prisma, {
			body: document.body,
			workspaceId,
		});
		expect(afterStatus.blocks).toContainEqual(
			expect.objectContaining({
				id: work.work.id,
				kind: "live-work",
				resolution: "ok",
				workStatus: "In Progress",
			})
		);
		const closed = await closeWork(prisma, {
			actorId,
			baseRevision: changed.work.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			result: "Completed",
			workId: work.work.id,
		});
		expect(closed.status).toBe("committed");
		const afterClose = await presentLiveDocumentBody(prisma, {
			body: document.body,
			workspaceId,
		});
		expect(afterClose.blocks).toContainEqual(
			expect.objectContaining({
				id: work.work.id,
				kind: "live-work",
				resolution: "ok",
				workStatus: "Closed",
			})
		);
	});

	it("does not show stale Work fields when the live target is gone", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const missingId = crypto.randomUUID();
		const document = await addDocument(prisma, {
			actorId,
			body: `${liveWorkFence(missingId)}\n\nOld copied title must not appear as source.`,
			projectId: project.id,
			title: "Broken",
			workspaceId,
		});
		const presented = await presentLiveDocumentBody(prisma, {
			body: document.body,
			workspaceId,
		});
		expect(presented.blocks).toContainEqual({
			kind: "live-work",
			reason: RELATIONS_COPY.permanentlyDeleted,
			resolution: "broken",
			sourceRecordId: missingId,
		});
		expect(
			presented.blocks.some(
				(block) =>
					"title" in block &&
					block.title === "Old copied title must not appear as source."
			)
		).toBe(false);
	});

	it("uses a named collection view identity without a second query shape", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const viewId = crypto.randomUUID();
		const document = await addDocument(prisma, {
			actorId,
			body: liveCollectionFence(viewId),
			projectId: project.id,
			title: "Board",
			workspaceId,
		});
		const presented = await presentLiveDocumentBody(prisma, {
			body: document.body,
			sources: {
				collections: {
					get: (id) =>
						id === viewId
							? {
									id: viewId,
									membershipRuleId: "rule-1",
									name: "Open Work",
									presentationId: "view-1",
								}
							: null,
				},
			},
			workspaceId,
		});
		expect(presented.blocks).toContainEqual({
			id: viewId,
			kind: "live-collection",
			membershipRuleId: "rule-1",
			name: "Open Work",
			openSourceRecord: DOCUMENTS_COPY.openSourceRecord,
			presentationId: "view-1",
			resolution: "ok",
		});
		const hosted = await listUsageLinksForHosts(prisma, workspaceId, [
			document.id,
		]);
		expect(hosted[document.id]).toEqual([
			expect.objectContaining({
				kind: USAGE_KIND.liveContentBlock,
				sourceRecordId: viewId,
			}),
		]);
	});

	it("embeds a read-only live section, blocks cycles, and hides gone section text", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const source = await addDocument(prisma, {
			actorId,
			body: "## Goals\n\nShip payments.",
			projectId: project.id,
			title: "Source",
			workspaceId,
		});
		const sectionId = source.body.match(SECTION_ID_MARK)?.[1];
		expect(sectionId).toBeTruthy();
		const host = await addDocument(prisma, {
			actorId,
			body: liveSectionFence(source.id, sectionId ?? ""),
			projectId: project.id,
			title: "Host",
			workspaceId,
		});
		const live = await presentLiveDocumentBody(prisma, {
			body: host.body,
			workspaceId,
		});
		expect(live.blocks).toContainEqual(
			expect.objectContaining({
				kind: "live-section",
				label: DOCUMENTS_COPY.readOnlyLiveSection,
				resolution: "ok",
				sectionId,
				sourceDocumentId: source.id,
				text: expect.stringContaining("Ship payments."),
			})
		);
		const cycled = await updateDocument(prisma, {
			actorId,
			baseRevision: source.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				body: liveSectionFence(host.id, "sec-missing"),
				documentId: source.id,
			},
			workspaceId,
		});
		expect(cycled).toEqual({
			reason: "live-section-cycle",
			status: "rejected",
		});
		expect(await getDocument(prisma, source.id)).toMatchObject({
			body: source.body,
		});
		const missing = await presentLiveDocumentBody(prisma, {
			body: liveSectionFence(crypto.randomUUID(), "sec-gone"),
			workspaceId,
		});
		expect(missing.blocks).toContainEqual(
			expect.objectContaining({
				kind: "live-section",
				reason: RELATIONS_COPY.permanentlyDeleted,
				resolution: "broken",
			})
		);
		expect(missing.blocks.some((block) => "text" in block && block.text)).toBe(
			false
		);
	});

	it("presents Technical Diagram live blocks as read-only without a canvas", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const diagramId = crypto.randomUUID();
		const viewId = crypto.randomUUID();
		const document = await addDocument(prisma, {
			actorId,
			body: `${liveDiagramFence(diagramId)}\n\n${liveDiagramViewFence(viewId)}`,
			projectId: project.id,
			title: "Architecture",
			workspaceId,
		});
		const presented = await presentLiveDocumentBody(prisma, {
			body: document.body,
			sources: {
				diagrams: {
					get: (id) =>
						id === diagramId || id === viewId
							? {
									authorityMode: DOCUMENTS_COPY.importedIndependentCopy,
									id,
									title: "Payments model",
								}
							: null,
				},
			},
			workspaceId,
		});
		expect(presented.blocks).toContainEqual(
			expect.objectContaining({
				canvas: false,
				id: diagramId,
				kind: "live-diagram",
				readOnly: true,
				resolution: "ok",
			})
		);
		expect(presented.blocks).toContainEqual(
			expect.objectContaining({
				canvas: false,
				id: viewId,
				kind: "live-diagram-view",
				readOnly: true,
				resolution: "ok",
			})
		);
		const broken = await presentLiveDocumentBody(prisma, {
			body: liveDiagramFence(crypto.randomUUID()),
			workspaceId,
		});
		expect(broken.blocks).toContainEqual(
			expect.objectContaining({
				kind: "live-diagram",
				reason: RELATIONS_COPY.permanentlyDeleted,
				resolution: "broken",
			})
		);
	});

	it("previews and atomically converts Mermaid to an Imported Independent Copy without a canvas", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const mermaid = "graph TD\n  A-->B";
		const document = await addDocument(prisma, {
			actorId,
			body: ["```mermaid", mermaid, "```"].join("\n"),
			projectId: project.id,
			title: "Flows",
			workspaceId,
		});
		const diagrams = createMemoryTechnicalDiagramImport();
		const previewed = await previewConvertMermaid(prisma, {
			blockSource: mermaid,
			documentId: document.id,
			originalBlockOutcome: "live-reference",
			targetType: "Technical Architecture",
			workspaceId,
		});
		expect(previewed.status).toBe("ok");
		if (previewed.status !== "ok") {
			throw new Error("expected preview");
		}
		expect(previewed.preview).toMatchObject({
			authorityMode: DOCUMENTS_COPY.importedIndependentCopy,
			canvas: false,
			documentId: document.id,
			label: DOCUMENTS_COPY.convertToTechnicalDiagram,
			originalBlockOutcome: "live-reference",
			unparseableItems: [],
		});
		const refused = await convertMermaidToTechnicalDiagram(
			prisma,
			{
				actorId,
				baseRevision: document.revision,
				idempotencyKey: crypto.randomUUID(),
				origin: "human",
				payload: {
					blockSource: mermaid,
					documentId: document.id,
					originalBlockOutcome: "live-reference",
					previewFingerprint: convertMermaidFingerprint(previewed.preview),
					targetType: "Technical Architecture",
				},
				workspaceId,
			},
			diagrams
		);
		expect(refused).toEqual({
			reason: "preview-required",
			status: "rejected",
		});
		expect(diagrams.copies).toEqual([]);
		const applied = await convertMermaidToTechnicalDiagram(
			prisma,
			{
				actorId,
				baseRevision: document.revision,
				idempotencyKey: crypto.randomUUID(),
				origin: "human",
				payload: {
					blockSource: mermaid,
					documentId: document.id,
					originalBlockOutcome: "live-reference",
					previewFingerprint: convertMermaidFingerprint(previewed.preview),
					targetType: "Technical Architecture",
				},
				previewAcknowledged: true,
				workspaceId,
			},
			diagrams
		);
		expect(applied.status).toBe("committed");
		if (applied.status !== "committed" || !("copy" in applied)) {
			throw new Error("expected copy");
		}
		expect(applied.copy.authorityMode).toBe(
			DOCUMENTS_COPY.importedIndependentCopy
		);
		expect(applied.document.body).toContain(liveDiagramFence(applied.copy.id));
		expect(applied.document.body).not.toContain("```mermaid");
		expect(diagrams.copies).toHaveLength(1);
		const relations = await listRelations(prisma, {
			record: { id: document.id, kind: "Document" },
			viewerWorkspaceId: workspaceId,
		});
		expect(relations).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: RELATIONS_COPY.origin,
				}),
			])
		);
	});

	it("previews convert-to-record and bulk list convert as atomic Work writes", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const document = await addDocument(prisma, {
			actorId,
			body: "Need a checkout path.\n\n- Capture card\n- Tokenize",
			projectId: project.id,
			title: "Notes",
			workspaceId,
		});
		const single = await previewConvertSelection(prisma, {
			documentId: document.id,
			projectId: project.id,
			recordKind: "Work",
			selectedText: "Need a checkout path.",
			workspaceId,
		});
		expect(single.status).toBe("ok");
		if (single.status !== "ok") {
			throw new Error("expected preview");
		}
		expect(single.preview).toMatchObject({
			documentRevision: document.revision,
			label: DOCUMENTS_COPY.convertToRecord,
			recordKind: "Work",
			title: "Need a checkout path.",
			versionPinnedEvidence: DOCUMENTS_COPY.versionPinnedEvidence,
		});
		expect(single.preview.label).not.toBe(DOCUMENTS_COPY.readOnlyLiveSection);
		const skipped = await convertSelection(prisma, {
			actorId,
			baseRevision: document.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				documentId: document.id,
				previewFingerprint: convertSelectionFingerprint(single.preview),
				projectId: project.id,
				recordKind: "Work",
				selectedText: "Need a checkout path.",
			},
			workspaceId,
		});
		expect(skipped).toEqual({
			reason: "preview-required",
			status: "rejected",
		});
		const converted = await convertSelection(prisma, {
			actorId,
			baseRevision: document.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				documentId: document.id,
				previewFingerprint: convertSelectionFingerprint(single.preview),
				projectId: project.id,
				recordKind: "Work",
				selectedText: "Need a checkout path.",
			},
			previewAcknowledged: true,
			workspaceId,
		});
		expect(converted.status).toBe("committed");
		if (converted.status !== "committed" || !("records" in converted)) {
			throw new Error("expected records");
		}
		expect(converted.records).toEqual([
			expect.objectContaining({
				kind: "Work",
				title: "Need a checkout path.",
			}),
		]);
		expect(await getDocument(prisma, document.id)).toMatchObject({
			body: document.body,
		});
		const listed = await previewConvertList(prisma, {
			documentId: document.id,
			projectId: project.id,
			selectedText: "- Capture card\n- Tokenize",
			workspaceId,
		});
		expect(listed.status).toBe("ok");
		if (listed.status !== "ok") {
			throw new Error("expected list preview");
		}
		expect(listed.preview).toMatchObject({
			candidates: [
				{ include: true, title: "Capture card", type: "Task" },
				{ include: true, title: "Tokenize", type: "Task" },
			],
			label: DOCUMENTS_COPY.convertInBulk,
		});
		const bulk = await convertList(prisma, {
			actorId,
			baseRevision: document.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				candidates: listed.preview.candidates,
				documentId: document.id,
				previewFingerprint: convertListFingerprint(listed.preview),
				projectId: project.id,
				selectedText: "- Capture card\n- Tokenize",
			},
			previewAcknowledged: true,
			workspaceId,
		});
		expect(bulk.status).toBe("committed");
		if (bulk.status !== "committed" || !("records" in bulk)) {
			throw new Error("expected bulk records");
		}
		expect(bulk.records).toHaveLength(2);
		const prose = await previewConvertList(prisma, {
			documentId: document.id,
			projectId: project.id,
			selectedText: "not a list",
			workspaceId,
		});
		expect(prose).toEqual({ reason: "list-required", status: "rejected" });
	});

	it("keeps version-pinned evidence distinct from a read-only live section", async () => {
		const { actorId, project, workspaceId } = await openProject(prisma);
		const work = await createWork(prisma, {
			actorId,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: { projectId: project.id, title: "Claim" },
		});
		if (work.status !== "committed") {
			throw new Error("expected Work");
		}
		const document = await addDocument(prisma, {
			actorId,
			body: "## Evidence\n\nThe fee is 2%.",
			projectId: project.id,
			title: "Fees",
			workspaceId,
		});
		expect(DOCUMENTS_COPY.versionPinnedEvidence).not.toBe(
			DOCUMENTS_COPY.readOnlyLiveSection
		);
		const pinned = await pinVersionPinnedEvidence(prisma, {
			actorId,
			baseRevision: document.revision,
			idempotencyKey: crypto.randomUUID(),
			origin: "human",
			payload: {
				documentId: document.id,
				selectedText: "The fee is 2%.",
				targetId: work.work.id,
				targetKind: "Work",
			},
			previewAcknowledged: true,
			workspaceId,
		});
		expect(pinned.status).toBe("committed");
		const relations = await listRelations(prisma, {
			record: { id: document.id, kind: "Document" },
			viewerWorkspaceId: workspaceId,
		});
		expect(relations).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					originLocation: expect.objectContaining({
						sourceVersion: String(document.revision),
					}),
					type: RELATIONS_COPY.origin,
				}),
				expect.objectContaining({
					type: RELATIONS_COPY.evidence,
				}),
			])
		);
		expect(relations.some((row) => row.type === RELATIONS_COPY.related)).toBe(
			false
		);
	});
});
