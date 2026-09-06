import type { Prisma, PrismaClient } from "@cantiara/db";

import { extractSection } from "../../documents/server/documents-live";

import { listLinkedBlockRows } from "./linked-block-store";
import type { ScreenDb } from "./screen-store";
import { documentOpenHref, SCREENS_COPY } from "./screens-and-wireframes-model";
import {
	overlayLinkedInstance,
	presentWireframeText,
	snapshotLiveText,
	type WireframeDocument,
	type WireframeLinkedBlockDefinition,
	type WireframeNode,
	type WireframeText,
	wireframeLinkedBlockDefinitionSchema,
} from "./wireframe-document";

type Db = PrismaClient | Prisma.TransactionClient | ScreenDb;

export async function snapshotWireframeDocument(
	db: Db,
	document: WireframeDocument
): Promise<WireframeDocument> {
	const nodes = await Promise.all(
		document.nodes.map(async (node) => {
			if (!node.text) {
				return node;
			}
			const live = await loadLiveSection(db, node.text);
			return { ...node, text: snapshotLiveText(node.text, live) };
		})
	);
	return { ...document, nodes };
}

export async function presentWireframeDocument(
	db: Db,
	input: {
		document: WireframeDocument;
		mode: "current" | "historical";
		projectId: string;
	}
): Promise<{
	document: WireframeDocument;
	presentedNodes: PresentedNode[];
}> {
	const definitions = await loadDefinitions(db, input.projectId);
	const nodes = await Promise.all(
		input.document.nodes.map((node) => {
			const overlaid =
				input.mode === "current"
					? overlayLinkedInstance(
							node,
							node.linkedBlockId
								? (definitions.get(node.linkedBlockId) ?? null)
								: null
						)
					: node;
			return presentNode(db, overlaid, input.mode, input.projectId);
		})
	);
	return {
		document: input.document,
		presentedNodes: nodes.map((row) => row.presented),
	};
}

export interface PresentedNode {
	geometry: {
		height: number;
		width: number;
		x: number;
		y: number;
	};
	groupId?: string;
	id: string;
	kind: string;
	label?: string;
	linkedBlockId?: string;
	liveRecord?: { id: string; kind: "Work" | "Decision" | "Risk" };
	openHref: string | null;
	openSourceRecord: string;
	text?: {
		liveSourcePath: { documentId: string; sectionId: string } | null;
		status: "broken" | "ok";
		value: string;
	};
}

async function presentNode(
	db: Db,
	node: WireframeNode,
	mode: "current" | "historical",
	projectId: string
): Promise<{ node: WireframeNode; presented: PresentedNode }> {
	const base = {
		geometry: node.geometry,
		groupId: node.groupId,
		id: node.id,
		kind: node.kind,
		label: node.label,
		linkedBlockId: node.linkedBlockId,
		liveRecord: node.liveRecord,
		openHref: null as string | null,
		openSourceRecord: SCREENS_COPY.openSourceRecord,
	};
	if (!node.text) {
		return {
			node,
			presented: base,
		};
	}
	const live = await loadLiveSection(db, node.text);
	const text = presentWireframeText(
		node.text,
		live,
		mode === "historical" ? "historical" : "live"
	);
	return {
		node,
		presented: {
			...base,
			openHref: text.liveSourcePath ? documentOpenHref(projectId) : null,
			text,
		},
	};
}

export async function loadDefinitions(
	db: Db,
	projectId: string
): Promise<Map<string, WireframeLinkedBlockDefinition>> {
	const rows = await listLinkedBlockRows(db, projectId);
	const definitions = new Map<string, WireframeLinkedBlockDefinition>();
	for (const row of rows) {
		const parsed = wireframeLinkedBlockDefinitionSchema.safeParse(
			row.definition
		);
		if (parsed.success) {
			definitions.set(row.id, parsed.data);
		}
	}
	return definitions;
}

async function loadLiveSection(
	db: Db,
	text: WireframeText
): Promise<{ text: string } | null> {
	if (text.mode !== "liveMarkdownSection") {
		return null;
	}
	const body = await loadDocumentBody(db, text.documentId);
	if (body === null) {
		return null;
	}
	const section = extractSection(body, text.sectionId);
	if (!section) {
		return null;
	}
	return { text: section.text };
}

async function loadDocumentBody(
	db: Db,
	documentId: string
): Promise<string | null> {
	const prisma = db as PrismaClient;
	if (typeof prisma.document?.findUnique === "function") {
		const row = await prisma.document.findUnique({
			select: { body: true },
			where: { id: documentId },
		});
		return row?.body ?? null;
	}
	const rows = await db.$queryRaw<{ body: string }[]>`
		SELECT "body" FROM "document" WHERE "id" = ${documentId} LIMIT 1
	`;
	return rows[0]?.body ?? null;
}
