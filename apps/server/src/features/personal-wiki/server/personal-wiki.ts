import { protectedProcedure } from "@cantiara/api";

import { PERSONAL_WIKI_COPY } from "./personal-wiki-copy";

export const PERSONAL_WIKI_PATH = "/wiki";

export const PERSONAL_WIKI_RECORD_KIND = "Document" as const;

export const PERSONAL_WIKI_SCOPE = { kind: "personal-wiki" as const };

export const PERSONAL_WIKI_DOCUMENT_COMMANDS = [
	"create",
	"edit",
	"versions",
	"templates",
	"hierarchy",
	"archive",
	"references",
	"export",
] as const;

export const PERSONAL_WIKI_FORBIDDEN_ACTIONS = [
	"publish",
	"unpublish",
	"external-surface",
	"public-slug",
	"visitor-html",
	"invite-team",
	"page-role",
	"co-edit",
] as const;

export type PersonalWikiDocumentCommand =
	(typeof PERSONAL_WIKI_DOCUMENT_COMMANDS)[number];

export type PersonalWikiForbiddenAction =
	(typeof PERSONAL_WIKI_FORBIDDEN_ACTIONS)[number];

export type WikiScope = typeof PERSONAL_WIKI_SCOPE;

export interface WikiCreateInput {
	body?: string;
	scope: WikiScope;
	title: string;
	type?: string;
}

export interface WikiDocument {
	body: string;
	id: string;
	recordKind: typeof PERSONAL_WIKI_RECORD_KIND;
	scope: WikiScope;
	title: string;
	type: string;
}

export type WikiCreateOutcome =
	| { document: WikiDocument; status: "committed" }
	| { reason: "project-scope-forbidden"; status: "rejected" };

export interface DocumentsPort {
	commands: () => readonly PersonalWikiDocumentCommand[];
	create: (
		input: WikiCreateInput
	) => WikiCreateOutcome | Promise<WikiCreateOutcome>;
}

export interface WikiPublishingPort {
	isRevoked: (url: string) => boolean;
	visitorUrlFor: (documentId: string) => string | null;
}

export interface WikiCreateCommand {
	body?: string;
	projectId?: string | null;
	title: string;
	type?: string;
}

export interface PersonalWikiShell {
	commands: readonly PersonalWikiDocumentCommand[];
	forbiddenActions: readonly PersonalWikiForbiddenAction[];
	label: typeof PERSONAL_WIKI_COPY.personalWiki;
	path: typeof PERSONAL_WIKI_PATH;
	recordKind: typeof PERSONAL_WIKI_RECORD_KIND;
	requiresProject: false;
}

export interface WikiOwnership {
	canonicalProductSpec: false;
	parallelProjectTruth: false;
	projectId: null;
	recordKind: typeof PERSONAL_WIKI_RECORD_KIND;
	scopeLabel: typeof PERSONAL_WIKI_COPY.personalWiki;
}

export interface WikiVisitorSurface {
	livePublicCopy: false;
	visitorUrl: null;
}

export interface WikiLeakNothingResponse {
	body: "";
	headers: { location?: undefined };
	livePublicCopy: false;
	reopenedRevokedUrl: false;
	status: 404;
}

export function openPersonalWikiShell(options?: {
	documents?: Pick<DocumentsPort, "commands">;
}): PersonalWikiShell {
	return {
		commands: options?.documents
			? options.documents.commands()
			: PERSONAL_WIKI_DOCUMENT_COMMANDS,
		forbiddenActions: PERSONAL_WIKI_FORBIDDEN_ACTIONS,
		label: PERSONAL_WIKI_COPY.personalWiki,
		path: PERSONAL_WIKI_PATH,
		recordKind: PERSONAL_WIKI_RECORD_KIND,
		requiresProject: false,
	};
}

export function wikiOwnership(document: {
	recordKind: string;
	scope: WikiScope | { kind: "project"; projectId: string };
}): WikiOwnership | { reason: "not-wiki-scope"; status: "rejected" } {
	if (
		document.recordKind !== PERSONAL_WIKI_RECORD_KIND ||
		document.scope.kind !== PERSONAL_WIKI_SCOPE.kind
	) {
		return { reason: "not-wiki-scope", status: "rejected" };
	}
	return {
		canonicalProductSpec: false,
		parallelProjectTruth: false,
		projectId: null,
		recordKind: PERSONAL_WIKI_RECORD_KIND,
		scopeLabel: PERSONAL_WIKI_COPY.personalWiki,
	};
}

export async function createWikiDocument(
	documents: DocumentsPort,
	command: WikiCreateCommand
): Promise<WikiCreateOutcome> {
	if (command.projectId) {
		return { reason: "project-scope-forbidden", status: "rejected" };
	}
	return await documents.create({
		body: command.body,
		scope: PERSONAL_WIKI_SCOPE,
		title: command.title,
		type: command.type ?? "General",
	});
}

export function wikiVisitorSurface(
	_documentId: string,
	_publishing: WikiPublishingPort
): WikiVisitorSurface {
	return { livePublicCopy: false, visitorUrl: null };
}

export function unauthenticatedWikiGet(_input: {
	attachmentBytes?: string;
	body: string;
	path: string;
	publishing?: WikiPublishingPort;
	title: string;
}): WikiLeakNothingResponse {
	return leakNothingWikiResponse();
}

export function leakNothingWikiResponse(): WikiLeakNothingResponse {
	return {
		body: "",
		headers: {},
		livePublicCopy: false,
		reopenedRevokedUrl: false,
		status: 404,
	};
}

export const personalWiki = {
	shell: protectedProcedure.handler(() => openPersonalWikiShell()),
};
