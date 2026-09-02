/**
 * Personal Wiki seam — ownership boundary and Wiki shell that
 * calls Documents. Create without Project, same Document kind,
 * no publish/team actions, never-published has no visitor URL,
 * unauthenticated GET from this shell leaks nothing, and this
 * shell keeps no live public copy after 74 unpublish.
 * docs/specs/32-personal-wiki/spec.md and GitHub #236.
 * Evidence: docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Dogfooding wiki). `410 Gone` is 74, not this module.
 */
import { describe, expect, it } from "vitest";

import {
	createWikiDocument,
	type DocumentsPort,
	openPersonalWikiShell,
	PERSONAL_WIKI_DOCUMENT_COMMANDS,
	PERSONAL_WIKI_FORBIDDEN_ACTIONS,
	PERSONAL_WIKI_PATH,
	PERSONAL_WIKI_RECORD_KIND,
	PERSONAL_WIKI_SCOPE,
	unauthenticatedWikiGet,
	type WikiCreateInput,
	type WikiPublishingPort,
	wikiOwnership,
	wikiVisitorSurface,
} from "./personal-wiki";
import { PERSONAL_WIKI_COPY } from "./personal-wiki-copy";

const FORBIDDEN_SHELL_COPY = /Publish|Unpublish|Invite|Co-edit|page role/i;

const SECRET_TITLE = "Atlas launch passphrase";
const SECRET_BODY = "hunter2 lives in the live Wiki";
const SECRET_BYTES = "attachment-secret-bytes";
const REVOKED_URL = "https://example.invalid/w/revoked-wiki";

function memoryDocuments(): DocumentsPort & {
	creates: WikiCreateInput[];
} {
	const creates: WikiCreateInput[] = [];
	return {
		commands: () => PERSONAL_WIKI_DOCUMENT_COMMANDS,
		create(input) {
			creates.push(input);
			return {
				document: {
					body: input.body ?? "",
					id: `doc-${creates.length}`,
					recordKind: PERSONAL_WIKI_RECORD_KIND,
					scope: input.scope,
					title: input.title,
					type: input.type ?? "General",
				},
				status: "committed" as const,
			};
		},
		creates,
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
			scopeLabel: PERSONAL_WIKI_COPY.personalWiki,
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
			commands: [...PERSONAL_WIKI_DOCUMENT_COMMANDS],
			forbiddenActions: [...PERSONAL_WIKI_FORBIDDEN_ACTIONS],
			label: "Personal Wiki",
			path: PERSONAL_WIKI_PATH,
			recordKind: "Document",
			requiresProject: false,
		});
		expect(PERSONAL_WIKI_PATH).toBe("/wiki");
		expect(PERSONAL_WIKI_SCOPE).toEqual({ kind: "personal-wiki" });
	});

	it("exposes the same Documents commands in Wiki scope and no second schema", () => {
		const documents = memoryDocuments();
		const shell = openPersonalWikiShell({ documents });
		expect(shell.commands).toEqual([...PERSONAL_WIKI_DOCUMENT_COMMANDS]);
		expect(shell.recordKind).toBe("Document");
		expect(shell.recordKind).not.toBe("Wiki Document");
		expect(shell.commands).not.toContain("publish");
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
