import type { Prisma, PrismaClient } from "@cantiara/db";

import { RELATIONS_COPY } from "../../relations/server/relations-catalog";
import {
	USAGE_KIND,
	type UsageKind,
} from "../../relations/server/relations-model";
import {
	DOCUMENTS_COPY,
	type DocumentBodyBlock,
	presentDocumentBody,
} from "./documents-model";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

export const CANTIARA_RECORD_LINK =
	/\[([^\]]*)\]\(cantiara:\/\/([^/]+)\/([^)]+)\)/g;

export const HEADING_LINE =
	/^(#{1,6})[ \t]+(.+?)(?:[ \t]+\{#([A-Za-z0-9_-]+)\})?[ \t]*$/;

const LIVE_SECTION_SOURCE_SPLIT = /\s+/;

export interface NamedCollectionView {
	id: string;
	membershipRuleId: string;
	name: string;
	presentationId: string;
}

export interface ImportedDiagramCopy {
	authorityMode: typeof DOCUMENTS_COPY.importedIndependentCopy;
	id: string;
	title: string;
}

export interface DocumentLiveSources {
	collections?: {
		get: (viewId: string) => NamedCollectionView | null;
	};
	diagrams?: {
		get: (diagramId: string) => ImportedDiagramCopy | null;
	};
}

export interface DocumentUsageTarget {
	embedId: string;
	kind: UsageKind;
	sourceRecordId: string;
}

export function liveWorkFence(workId: string): string {
	return fence("live-work", workId);
}

export function liveCollectionFence(viewId: string): string {
	return fence("live-collection", viewId);
}

export function liveSectionFence(
	sourceDocumentId: string,
	sectionId: string
): string {
	return fence("live-section", `${sourceDocumentId} ${sectionId}`);
}

export function liveDiagramFence(diagramId: string): string {
	return fence("live-diagram", diagramId);
}

export function liveDiagramViewFence(viewId: string): string {
	return fence("live-diagram-view", viewId);
}

export function inlineRecordMarkdown(
	title: string,
	recordKind: string,
	sourceRecordId: string
): string {
	return `[${title}](cantiara://${recordKind}/${sourceRecordId})`;
}

export function ensureSectionIds(body: string): string {
	const lines = body.split("\n");
	let inFence = false;
	return lines
		.map((line) => {
			if (line.startsWith("```")) {
				inFence = !inFence;
				return line;
			}
			if (inFence) {
				return line;
			}
			const match = HEADING_LINE.exec(line);
			if (!match || match[3]) {
				return line;
			}
			const heading = match[2]?.trim() ?? "";
			return `${match[1]} ${heading} {#sec-${crypto.randomUUID()}}`;
		})
		.join("\n");
}

export function usageTargetsFromBody(body: string): DocumentUsageTarget[] {
	const targets: DocumentUsageTarget[] = [];
	const seen = new Set<string>();
	const push = (target: DocumentUsageTarget) => {
		if (seen.has(target.embedId)) {
			return;
		}
		seen.add(target.embedId);
		targets.push(target);
	};
	for (const block of presentDocumentBody(body).blocks) {
		if (block.kind !== "live-marker") {
			continue;
		}
		if (block.language === "live-work") {
			const sourceRecordId = block.source.trim();
			push({
				embedId: `live-work:${sourceRecordId}`,
				kind: USAGE_KIND.liveContentBlock,
				sourceRecordId,
			});
			continue;
		}
		if (block.language === "live-collection") {
			const sourceRecordId = block.source.trim();
			push({
				embedId: `live-collection:${sourceRecordId}`,
				kind: USAGE_KIND.liveContentBlock,
				sourceRecordId,
			});
			continue;
		}
		if (block.language === "live-diagram") {
			const sourceRecordId = block.source.trim();
			push({
				embedId: `live-diagram:${sourceRecordId}`,
				kind: USAGE_KIND.liveContentBlock,
				sourceRecordId,
			});
			continue;
		}
		if (block.language === "live-diagram-view") {
			const sourceRecordId = block.source.trim();
			push({
				embedId: `live-diagram-view:${sourceRecordId}`,
				kind: USAGE_KIND.liveContentBlock,
				sourceRecordId,
			});
			continue;
		}
		if (block.language === "live-section") {
			const parsed = parseLiveSectionSource(block.source);
			if (!parsed) {
				continue;
			}
			push({
				embedId: `live-section:${parsed.sourceDocumentId}:${parsed.sectionId}`,
				kind: USAGE_KIND.stableSectionReference,
				sourceRecordId: parsed.sourceDocumentId,
			});
		}
	}
	for (const reference of inlineReferences(body)) {
		push({
			embedId: `inline:${reference.recordKind}:${reference.sourceRecordId}`,
			kind: USAGE_KIND.inlineRecordReference,
			sourceRecordId: reference.sourceRecordId,
		});
	}
	return targets;
}

export async function syncDocumentUsageLinks(
	tx: Prisma.TransactionClient,
	input: {
		hostRecordId: string;
		targets: readonly DocumentUsageTarget[];
		workspaceId: string;
	}
): Promise<void> {
	if (!("usageLink" in tx) || typeof tx.usageLink?.findMany !== "function") {
		return;
	}
	const existing = await tx.usageLink.findMany({
		where: { hostRecordId: input.hostRecordId },
	});
	const desired = new Set(input.targets.map((target) => target.embedId));
	for (const row of existing) {
		if (desired.has(row.embedId)) {
			continue;
		}
		// biome-ignore lint/performance/noAwaitInLoops: usage-link cleanup stays sequential in one document write.
		await tx.usageLink.delete({ where: { id: row.id } });
		await tx.usageHostEmbed.deleteMany({ where: { id: row.embedId } });
	}
	const present = new Set(existing.map((row) => row.embedId));
	for (const target of input.targets) {
		if (present.has(target.embedId) || target.sourceRecordId.length === 0) {
			continue;
		}
		// biome-ignore lint/performance/noAwaitInLoops: embed then link must land before the next target.
		await tx.usageHostEmbed.create({
			data: {
				hostRecordId: input.hostRecordId,
				id: target.embedId,
				kind: target.kind,
				sourceRecordId: target.sourceRecordId,
			},
		});
		await tx.usageLink.create({
			data: {
				embedId: target.embedId,
				hostRecordId: input.hostRecordId,
				id: crypto.randomUUID(),
				kind: target.kind,
				sourceRecordId: target.sourceRecordId,
				workspaceId: input.workspaceId,
			},
		});
	}
}

export async function documentsWouldCycle(
	prisma: PrismaLike,
	hostDocumentId: string,
	nextBody: string
): Promise<boolean> {
	if (
		!("document" in prisma) ||
		typeof prisma.document?.findMany !== "function"
	) {
		return false;
	}
	const rows = await prisma.document.findMany({
		select: { body: true, id: true },
	});
	const map = new Map(rows.map((row) => [row.id, row.body]));
	map.set(hostDocumentId, nextBody);
	for (const block of presentDocumentBody(nextBody).blocks) {
		if (block.kind !== "live-marker" || block.language !== "live-section") {
			continue;
		}
		const parsed = parseLiveSectionSource(block.source);
		if (!parsed) {
			continue;
		}
		if (liveSectionWouldCycle(map, hostDocumentId, parsed.sourceDocumentId)) {
			return true;
		}
	}
	return false;
}

export function liveSectionWouldCycle(
	documents: ReadonlyMap<string, string>,
	hostDocumentId: string,
	sourceDocumentId: string
): boolean {
	if (hostDocumentId === sourceDocumentId) {
		return true;
	}
	const visiting = new Set<string>([hostDocumentId]);
	return reachesHost(documents, sourceDocumentId, visiting);
}

export async function presentLiveDocumentBody(
	prisma: PrismaLike,
	input: {
		body: string;
		hostDocumentId?: string;
		sources?: DocumentLiveSources;
		workspaceId: string;
	}
): Promise<{ blocks: DocumentBodyBlock[]; source: string }> {
	const presented = presentDocumentBody(input.body);
	const slices = await Promise.all(
		presented.blocks.map(async (block) => {
			if (block.kind === "live-marker") {
				return [
					await resolveLiveMarker(
						prisma,
						block,
						input.sources,
						input.workspaceId
					),
				];
			}
			if (block.kind === "markdown") {
				return await resolveMarkdown(prisma, block.text, input.workspaceId);
			}
			return [block];
		})
	);
	return { blocks: slices.flat(), source: presented.source };
}

export function extractSection(
	body: string,
	sectionId: string
): { heading: string; text: string } | null {
	const lines = body.split("\n");
	let start = -1;
	let level = 0;
	let heading = "";
	for (let index = 0; index < lines.length; index += 1) {
		const match = HEADING_LINE.exec(lines[index] ?? "");
		if (!match) {
			continue;
		}
		if (start >= 0 && (match[1]?.length ?? 0) <= level) {
			return {
				heading,
				text: lines.slice(start, index).join("\n").trim(),
			};
		}
		if (match[3] === sectionId) {
			start = index;
			level = match[1]?.length ?? 0;
			heading = match[2]?.trim() ?? "";
		}
	}
	if (start < 0) {
		return null;
	}
	return {
		heading,
		text: lines.slice(start).join("\n").trim(),
	};
}

function reachesHost(
	documents: ReadonlyMap<string, string>,
	currentId: string,
	visiting: Set<string>
): boolean {
	if (visiting.has(currentId)) {
		return true;
	}
	const body = documents.get(currentId);
	if (!body) {
		return false;
	}
	visiting.add(currentId);
	for (const block of presentDocumentBody(body).blocks) {
		if (block.kind !== "live-marker" || block.language !== "live-section") {
			continue;
		}
		const parsed = parseLiveSectionSource(block.source);
		if (!parsed) {
			continue;
		}
		if (reachesHost(documents, parsed.sourceDocumentId, visiting)) {
			return true;
		}
	}
	visiting.delete(currentId);
	return false;
}

function parseLiveSectionSource(
	source: string
): { sectionId: string; sourceDocumentId: string } | null {
	const [sourceDocumentId, sectionId] = source
		.trim()
		.split(LIVE_SECTION_SOURCE_SPLIT, 2);
	if (!(sourceDocumentId && sectionId)) {
		return null;
	}
	return { sectionId, sourceDocumentId };
}

function inlineReferences(
	body: string
): Array<{ recordKind: string; sourceRecordId: string; title: string }> {
	const matches = [...body.matchAll(new RegExp(CANTIARA_RECORD_LINK, "g"))];
	return matches.flatMap((match) => {
		const title = match[1] ?? "";
		const recordKind = match[2] ?? "";
		const sourceRecordId = match[3] ?? "";
		if (!(recordKind && sourceRecordId)) {
			return [];
		}
		return [{ recordKind, sourceRecordId, title }];
	});
}

async function resolveMarkdown(
	prisma: PrismaLike,
	text: string,
	workspaceId: string
): Promise<DocumentBodyBlock[]> {
	const pattern = new RegExp(CANTIARA_RECORD_LINK.source, "g");
	const matches = [...text.matchAll(pattern)];
	if (matches.length === 0) {
		return [{ kind: "markdown", text }];
	}
	const resolved = await Promise.all(
		matches.map((match) =>
			resolveInline(prisma, match[2] ?? "", match[3] ?? "", workspaceId)
		)
	);
	const blocks: DocumentBodyBlock[] = [];
	let cursor = 0;
	let resolvedIndex = 0;
	for (const match of matches) {
		const index = match.index ?? 0;
		if (index > cursor) {
			blocks.push({ kind: "markdown", text: text.slice(cursor, index) });
		}
		const inline = resolved[resolvedIndex];
		if (inline) {
			blocks.push(inline);
		}
		resolvedIndex += 1;
		cursor = index + match[0].length;
	}
	if (cursor < text.length) {
		blocks.push({ kind: "markdown", text: text.slice(cursor) });
	}
	return blocks;
}

async function resolveInline(
	prisma: PrismaLike,
	recordKind: string,
	sourceRecordId: string,
	workspaceId: string
): Promise<DocumentBodyBlock> {
	if (recordKind === "Work") {
		const work = await loadWork(prisma, sourceRecordId, workspaceId);
		if (!work) {
			return broken("inline-reference", sourceRecordId);
		}
		return {
			kind: "inline-reference",
			openSourceRecord: DOCUMENTS_COPY.openSourceRecord,
			recordKind,
			resolution: "ok",
			sourceRecordId: work.id,
			title: work.title,
		};
	}
	if (recordKind === "Document") {
		const document = await loadDocument(prisma, sourceRecordId, workspaceId);
		if (!document) {
			return broken("inline-reference", sourceRecordId);
		}
		return {
			kind: "inline-reference",
			openSourceRecord: DOCUMENTS_COPY.openSourceRecord,
			recordKind,
			resolution: "ok",
			sourceRecordId: document.id,
			title: document.title,
		};
	}
	return broken("inline-reference", sourceRecordId);
}

async function resolveLiveMarker(
	prisma: PrismaLike,
	block: Extract<DocumentBodyBlock, { kind: "live-marker" }>,
	sources: DocumentLiveSources | undefined,
	workspaceId: string
): Promise<DocumentBodyBlock> {
	if (block.language === "live-work") {
		return await resolveLiveWork(prisma, block.source.trim(), workspaceId);
	}
	if (block.language === "live-collection") {
		return resolveLiveCollection(block.source.trim(), sources);
	}
	if (block.language === "live-section") {
		return await resolveLiveSection(prisma, block.source, workspaceId);
	}
	if (
		block.language === "live-diagram" ||
		block.language === "live-diagram-view"
	) {
		return resolveLiveDiagram(block.language, block.source.trim(), sources);
	}
	return {
		kind: "fenced-code",
		language: block.language,
		source: block.source,
	};
}

async function resolveLiveWork(
	prisma: PrismaLike,
	workId: string,
	workspaceId: string
): Promise<DocumentBodyBlock> {
	const work = await loadWork(prisma, workId, workspaceId);
	if (!work) {
		return broken("live-work", workId);
	}
	return {
		actions: {
			changeStatus: DOCUMENTS_COPY.changeStatus,
			close: DOCUMENTS_COPY.close,
			openSourceRecord: DOCUMENTS_COPY.openSourceRecord,
		},
		id: work.id,
		key: work.key,
		kind: "live-work",
		label: DOCUMENTS_COPY.liveWorkBlock,
		plannedStart: work.plannedStart,
		priority: null,
		projectId: work.projectId,
		resolution: "ok",
		revision: work.revision,
		targetDate: work.targetDate,
		title: work.title,
		type: work.type,
		workStatus: work.status,
	};
}

function resolveLiveCollection(
	viewId: string,
	sources: DocumentLiveSources | undefined
): DocumentBodyBlock {
	const view = sources?.collections?.get(viewId) ?? null;
	if (!view) {
		return broken("live-collection", viewId);
	}
	return {
		id: view.id,
		kind: "live-collection",
		membershipRuleId: view.membershipRuleId,
		name: view.name,
		openSourceRecord: DOCUMENTS_COPY.openSourceRecord,
		presentationId: view.presentationId,
		resolution: "ok",
	};
}

async function resolveLiveSection(
	prisma: PrismaLike,
	source: string,
	workspaceId: string
): Promise<DocumentBodyBlock> {
	const parsed = parseLiveSectionSource(source);
	if (!parsed) {
		return broken("live-section", source.trim());
	}
	const document = await loadDocument(
		prisma,
		parsed.sourceDocumentId,
		workspaceId
	);
	if (!document) {
		return broken("live-section", parsed.sourceDocumentId);
	}
	const section = extractSection(document.body, parsed.sectionId);
	if (!section) {
		return broken("live-section", parsed.sourceDocumentId);
	}
	return {
		heading: section.heading,
		kind: "live-section",
		label: DOCUMENTS_COPY.readOnlyLiveSection,
		openSourceRecord: DOCUMENTS_COPY.openSourceRecord,
		resolution: "ok",
		sectionId: parsed.sectionId,
		sourceDocumentId: document.id,
		sourceTitle: document.title,
		text: section.text,
		updatedAt: document.updatedAt.toISOString(),
	};
}

function resolveLiveDiagram(
	kind: "live-diagram" | "live-diagram-view",
	diagramId: string,
	sources: DocumentLiveSources | undefined
): DocumentBodyBlock {
	const diagram = sources?.diagrams?.get(diagramId) ?? null;
	if (!diagram) {
		return broken(kind, diagramId);
	}
	return {
		authorityMode:
			kind === "live-diagram" ? DOCUMENTS_COPY.importedIndependentCopy : null,
		canvas: false,
		id: diagram.id,
		kind,
		openSourceRecord: DOCUMENTS_COPY.openSourceRecord,
		readOnly: true,
		resolution: "ok",
		title: diagram.title,
	};
}

function broken(
	kind: DocumentBrokenTargetKind,
	sourceRecordId: string
): DocumentBodyBlock {
	return {
		kind,
		reason: RELATIONS_COPY.permanentlyDeleted,
		resolution: "broken",
		sourceRecordId,
	};
}

type DocumentBrokenTargetKind = Extract<
	DocumentBodyBlock,
	{ resolution: "broken" }
>["kind"];

async function loadWork(
	prisma: PrismaLike,
	workId: string,
	workspaceId: string
) {
	if (!("work" in prisma) || typeof prisma.work?.findUnique !== "function") {
		return null;
	}
	const row = await prisma.work.findUnique({
		include: { project: true },
		where: { id: workId },
	});
	if (!row || row.retiredIntoId || row.project.workspaceId !== workspaceId) {
		return null;
	}
	return row;
}

async function loadDocument(
	prisma: PrismaLike,
	documentId: string,
	workspaceId: string
) {
	if (
		!("document" in prisma) ||
		typeof prisma.document?.findUnique !== "function"
	) {
		return null;
	}
	const row = await prisma.document.findUnique({
		where: { id: documentId },
	});
	if (!row || row.workspaceId !== workspaceId) {
		return null;
	}
	return row;
}

function fence(language: string, source: string): string {
	return `\`\`\`${language}\n${source}\n\`\`\``;
}
