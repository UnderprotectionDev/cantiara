/**
 * Personal Wiki seam — ownership boundary and Wiki shell that
 * calls Documents. Create without Project, same Document kind,
 * no publish/team actions, never-published has no visitor URL,
 * unauthenticated GET from this shell leaks nothing, and this
 * shell keeps no live public copy after 74 unpublish.
 * Move/Copy into Wiki keeps identity vs new origin, does not
 * auto-convert to Work/template, and leaves unselected children.
 * docs/specs/32-personal-wiki/spec.md and GitHub #236, #238.
 * Evidence: docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Dogfooding wiki, Belge bütünlüğü move/copy). `410 Gone` is 74, not this module.
 */
import { describe, expect, it } from "vitest";

import {
	copyIntoWiki,
	createWikiDocument,
	type DocumentsPort,
	moveToWiki,
	openPersonalWikiShell,
	PERSONAL_WIKI_PATH,
	PERSONAL_WIKI_RECORD_KIND,
	PERSONAL_WIKI_SCOPE,
	previewMoveToWiki,
	unauthenticatedWikiGet,
	type WikiCreateInput,
	type WikiPublishingPort,
	wikiOwnership,
	wikiVisitorSurface,
} from "./personal-wiki";
import { PERSONAL_WIKI_COPY } from "./personal-wiki-copy";

const DOCUMENT_COMMANDS_IN_WIKI = [
	"create",
	"edit",
	"versions",
	"templates",
	"hierarchy",
	"archive",
	"references",
	"export",
	"move",
	"copy",
] as const;

const FORBIDDEN_SHELL_COPY = /Publish|Unpublish|Invite|Co-edit|page role/i;

const SECRET_TITLE = "Atlas launch passphrase";
const SECRET_BODY = "hunter2 lives in the live Wiki";
const SECRET_BYTES = "attachment-secret-bytes";
const REVOKED_URL = "https://example.invalid/w/revoked-wiki";

interface StoredDocument {
	body: string;
	id: string;
	originDocumentId: string | null;
	parentId: string | null;
	recordKind: typeof PERSONAL_WIKI_RECORD_KIND;
	scope: WikiCreateInput["scope"] | { kind: "project"; projectId: string };
	title: string;
	type: string;
}

function memoryDocuments(
	seed: readonly StoredDocument[] = []
): DocumentsPort & {
	conversions: { template: number; work: number };
	creates: WikiCreateInput[];
	documents: Map<string, StoredDocument>;
} {
	const creates: WikiCreateInput[] = [];
	const conversions = { template: 0, work: 0 };
	const documents = new Map(seed.map((row) => [row.id, { ...row }]));
	let nextId = seed.length + 1;
	return {
		commands: () => DOCUMENT_COMMANDS_IN_WIKI,
		conversions,
		convertToTemplate() {
			conversions.template += 1;
			return { status: "committed" as const };
		},
		convertToWork() {
			conversions.work += 1;
			return { status: "committed" as const };
		},
		copy(input) {
			const source = documents.get(input.documentId);
			if (!source) {
				return { reason: "document-not-found", status: "rejected" as const };
			}
			const copy: StoredDocument = {
				...source,
				id: `copy-${nextId}`,
				originDocumentId: source.id,
				parentId: null,
				scope: input.target,
			};
			nextId += 1;
			documents.set(copy.id, copy);
			return {
				document: copy,
				status: "committed" as const,
			};
		},
		create(input) {
			creates.push(input);
			const document: StoredDocument = {
				body: input.body ?? "",
				id: `doc-${creates.length}`,
				originDocumentId: null,
				parentId: null,
				recordKind: PERSONAL_WIKI_RECORD_KIND,
				scope: input.scope,
				title: input.title,
				type: input.type ?? "General",
			};
			documents.set(document.id, document);
			return {
				document,
				status: "committed" as const,
			};
		},
		creates,
		documents,
		move(input) {
			const root = documents.get(input.documentId);
			if (!root) {
				return { reason: "document-not-found", status: "rejected" as const };
			}
			const moving = new Set([input.documentId, ...input.childDocumentIds]);
			for (const [id, row] of documents) {
				if (!moving.has(id)) {
					continue;
				}
				documents.set(id, { ...row, scope: input.target });
			}
			for (const [id, row] of documents) {
				if (row.parentId && moving.has(row.parentId) && !moving.has(id)) {
					documents.set(id, { ...row, parentId: null });
				}
			}
			return {
				document: documents.get(input.documentId) as StoredDocument,
				status: "committed" as const,
			};
		},
		previewMove(input) {
			const children = [...documents.values()].filter(
				(row) => row.parentId === input.documentId
			);
			const selected = new Set([input.documentId, ...input.childDocumentIds]);
			return {
				detachedChildIds: children
					.filter((row) => !selected.has(row.id))
					.map((row) => row.id),
				selectedDocumentIds: [...selected],
				status: "ok" as const,
				target: input.target,
			};
		},
	};
}

function unpublishedPublishing(): WikiPublishingPort {
	return {
		isRevoked: () => false,
		visitorUrlFor: () => null,
	};
}

function unpublishedAfterRevoke(): WikiPublishingPort {
	return {
		isRevoked: (url) => url === REVOKED_URL,
		visitorUrlFor: () => null,
	};
}

describe("Personal Wiki ownership and shell", () => {
	it("creates a Document in Personal Wiki without a Project", async () => {
		const documents = memoryDocuments();
		const created = await createWikiDocument(documents, {
			body: "Durable pattern",
			title: "Retry with backoff",
		});
		expect(created).toMatchObject({
			document: {
				recordKind: "Document",
				scope: { kind: "personal-wiki" },
				title: "Retry with backoff",
			},
			status: "committed",
		});
		expect(documents.creates).toEqual([
			{
				body: "Durable pattern",
				scope: { kind: "personal-wiki" },
				title: "Retry with backoff",
				type: "General",
			},
		]);
		expect(wikiOwnership(created.document)).toEqual({
			canonicalProductSpec: false,
			parallelProjectTruth: false,
			projectId: null,
			recordKind: "Document",
			scopeLabel: "Personal Wiki",
		});
	});

	it("refuses to assign a Project when creating in the Wiki shell", async () => {
		const documents = memoryDocuments();
		const created = await createWikiDocument(documents, {
			projectId: "proj_atlas",
			title: "Should stay Wiki",
		});
		expect(created).toEqual({
			reason: "project-scope-forbidden",
			status: "rejected",
		});
		expect(documents.creates).toEqual([]);
	});

	it("opens as a first-class personal shell target without entering a Project", () => {
		expect(openPersonalWikiShell()).toEqual({
			commands: [
				"create",
				"edit",
				"versions",
				"templates",
				"hierarchy",
				"archive",
				"references",
				"export",
				"move",
				"copy",
			],
			forbiddenActions: [
				"publish",
				"unpublish",
				"external-surface",
				"public-slug",
				"visitor-html",
				"invite-team",
				"page-role",
				"co-edit",
			],
			label: "Personal Wiki",
			path: "/wiki",
			recordKind: "Document",
			requiresProject: false,
		});
		expect(PERSONAL_WIKI_PATH).toBe("/wiki");
		expect(PERSONAL_WIKI_SCOPE).toEqual({ kind: "personal-wiki" });
	});

	it("exposes the same Documents commands in Wiki scope and no second schema", () => {
		const documents = memoryDocuments();
		const shell = openPersonalWikiShell({ documents });
		expect(shell.commands).toEqual([
			"create",
			"edit",
			"versions",
			"templates",
			"hierarchy",
			"archive",
			"references",
			"export",
			"move",
			"copy",
		]);
		expect(shell.recordKind).toBe("Document");
		expect(shell.recordKind).not.toBe("Wiki Document");
		expect(shell.commands).not.toContain("publish");
	});

	it("does not treat a Project Document as Wiki ownership or a canonical product spec", () => {
		expect(
			wikiOwnership({
				recordKind: "Document",
				scope: { kind: "project", projectId: "proj_atlas" },
			})
		).toEqual({ reason: "not-wiki-scope", status: "rejected" });
	});

	it("uses English Personal Wiki copy and no publish or team UI", () => {
		expect(PERSONAL_WIKI_COPY.personalWiki).toBe("Personal Wiki");
		const copy = JSON.stringify(PERSONAL_WIKI_COPY);
		expect(copy).not.toMatch(FORBIDDEN_SHELL_COPY);
		expect(openPersonalWikiShell().forbiddenActions).toEqual([
			"publish",
			"unpublish",
			"external-surface",
			"public-slug",
			"visitor-html",
			"invite-team",
			"page-role",
			"co-edit",
		]);
	});

	it("gives a never-published Wiki Document no visitor URL", async () => {
		const documents = memoryDocuments();
		const created = await createWikiDocument(documents, {
			title: SECRET_TITLE,
		});
		if (created.status !== "committed") {
			throw new Error("expected committed Wiki Document");
		}
		expect(
			wikiVisitorSurface(created.document.id, unpublishedPublishing())
		).toEqual({
			livePublicCopy: false,
			visitorUrl: null,
		});
	});

	it("leaks nothing on unauthenticated GET of live Wiki body, name, or attachment bytes", () => {
		const response = unauthenticatedWikiGet({
			attachmentBytes: SECRET_BYTES,
			body: SECRET_BODY,
			path: "/wiki/doc-secret",
			title: SECRET_TITLE,
		});
		expect(response.status).toBe(404);
		expect(response.body).toBe("");
		expect(response.body).not.toContain(SECRET_TITLE);
		expect(response.body).not.toContain(SECRET_BODY);
		expect(response.body).not.toContain(SECRET_BYTES);
		expect(response.headers.location).toBeUndefined();
		expect(JSON.stringify(response)).not.toContain(SECRET_TITLE);
		expect(JSON.stringify(response)).not.toContain(SECRET_BODY);
		expect(JSON.stringify(response)).not.toContain(SECRET_BYTES);
	});

	it("does not keep a live public copy or reopen a revoked URL after 74 unpublish", () => {
		const publishing = unpublishedAfterRevoke();
		expect(wikiVisitorSurface("doc-1", publishing)).toEqual({
			livePublicCopy: false,
			visitorUrl: null,
		});
		const response = unauthenticatedWikiGet({
			attachmentBytes: SECRET_BYTES,
			body: SECRET_BODY,
			path: REVOKED_URL,
			publishing,
			title: SECRET_TITLE,
		});
		expect(response.status).toBe(404);
		expect(response.body).toBe("");
		expect(response.reopenedRevokedUrl).toBe(false);
		expect(response.livePublicCopy).toBe(false);
		expect(response.status).not.toBe(410);
	});
});

describe("Personal Wiki Move and Copy", () => {
	const projectScope = { kind: "project" as const, projectId: "proj_atlas" };
	const root: StoredDocument = {
		body: "Lasting pattern from the product",
		id: "doc-root",
		originDocumentId: null,
		parentId: null,
		recordKind: PERSONAL_WIKI_RECORD_KIND,
		scope: projectScope,
		title: "Retry with backoff",
		type: "General",
	};
	const selectedChild: StoredDocument = {
		body: "Child kept with the move",
		id: "doc-child",
		originDocumentId: null,
		parentId: "doc-root",
		recordKind: PERSONAL_WIKI_RECORD_KIND,
		scope: projectScope,
		title: "Backoff table",
		type: "General",
	};
	const skippedChild: StoredDocument = {
		body: "Stays in the Project",
		id: "doc-skipped",
		originDocumentId: null,
		parentId: "doc-root",
		recordKind: PERSONAL_WIKI_RECORD_KIND,
		scope: projectScope,
		title: "Project-only note",
		type: "General",
	};

	it("Moves into Personal Wiki with the same identity and leaves unselected children", async () => {
		const documents = memoryDocuments([root, selectedChild, skippedChild]);
		const preview = await previewMoveToWiki(documents, {
			childDocumentIds: ["doc-child"],
			documentId: "doc-root",
		});
		expect(preview).toEqual({
			detachedChildIds: ["doc-skipped"],
			selectedDocumentIds: ["doc-root", "doc-child"],
			status: "ok",
			target: { kind: "personal-wiki" },
		});
		const moved = await moveToWiki(documents, {
			childDocumentIds: ["doc-child"],
			documentId: "doc-root",
		});
		expect(moved).toMatchObject({
			document: {
				id: "doc-root",
				recordKind: "Document",
				scope: { kind: "personal-wiki" },
				title: "Retry with backoff",
			},
			status: "committed",
		});
		expect(documents.documents.get("doc-root")?.id).toBe("doc-root");
		expect(documents.documents.get("doc-child")).toMatchObject({
			parentId: "doc-root",
			scope: { kind: "personal-wiki" },
		});
		expect(documents.documents.get("doc-skipped")).toMatchObject({
			parentId: null,
			scope: projectScope,
		});
		expect(documents.conversions).toEqual({ template: 0, work: 0 });
		if (moved.status !== "committed") {
			throw new Error("expected committed Move");
		}
		expect(wikiOwnership(moved.document)).toEqual({
			canonicalProductSpec: false,
			parallelProjectTruth: false,
			projectId: null,
			recordKind: "Document",
			scopeLabel: "Personal Wiki",
		});
	});

	it("Copies into Personal Wiki as a new identity with origin and independent bodies", async () => {
		const documents = memoryDocuments([root]);
		const copied = await copyIntoWiki(documents, {
			documentId: "doc-root",
		});
		expect(copied).toMatchObject({
			document: {
				body: "Lasting pattern from the product",
				originDocumentId: "doc-root",
				recordKind: "Document",
				scope: { kind: "personal-wiki" },
				title: "Retry with backoff",
			},
			status: "committed",
		});
		if (copied.status !== "committed") {
			throw new Error("expected committed Copy");
		}
		expect(copied.document.id).not.toBe("doc-root");
		expect(documents.documents.get("doc-root")).toMatchObject({
			body: "Lasting pattern from the product",
			scope: projectScope,
		});
		documents.documents.set(copied.document.id, {
			...copied.document,
			body: "Wiki-only edit",
		});
		expect(documents.documents.get("doc-root")?.body).toBe(
			"Lasting pattern from the product"
		);
		expect(documents.documents.get(copied.document.id)?.body).toBe(
			"Wiki-only edit"
		);
		expect(documents.conversions).toEqual({ template: 0, work: 0 });
	});

	it("does not auto-convert Move or Copy into Work or a template", async () => {
		const documents = memoryDocuments([root, selectedChild]);
		await moveToWiki(documents, {
			childDocumentIds: [],
			documentId: "doc-root",
		});
		await copyIntoWiki(documents, { documentId: "doc-child" });
		expect(documents.conversions).toEqual({ template: 0, work: 0 });
		expect(openPersonalWikiShell({ documents }).commands).toEqual(
			expect.arrayContaining(["move", "copy"])
		);
		expect(openPersonalWikiShell({ documents }).commands).not.toContain(
			"convert-to-work"
		);
		expect(openPersonalWikiShell({ documents }).forbiddenActions).toEqual(
			expect.arrayContaining(["publish", "invite-team", "co-edit"])
		);
	});
});
