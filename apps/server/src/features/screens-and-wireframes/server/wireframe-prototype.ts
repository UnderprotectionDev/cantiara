import sharp from "sharp";

import {
	type PresentationLinkView,
	type PresentationScreenView,
	type PresentationView,
	SCREENS_COPY,
	WIREFRAME_EXPORT_FORMAT,
	type WireframeExportFormat,
	type WireframeExportOutcome,
} from "./screens-and-wireframes-model";
import {
	isKonvaStageJson,
	parseWireframeDocument,
	WIREFRAME_ANIMATION_KIND,
	WIREFRAME_CANVAS_TYPEFACE,
	type WireframeDocument,
	type WireframeNode,
} from "./wireframe-document";

const HTML_NETWORK =
	/https?:\/\/|fetch\s*\(|XMLHttpRequest|sendBeacon|gtag\(|analytics|googletagmanager/i;
const PRODUCT_URL = /cantiara\.|localhost:\d+/i;

export function prototypeLinks(
	document: WireframeDocument
): PresentationLinkView[] {
	const byNode = new Map<string, string>();
	for (const node of document.nodes) {
		if (node.targetScreenId) {
			byNode.set(node.id, node.targetScreenId);
		}
	}
	for (const animation of document.animations) {
		if (
			animation.kind === WIREFRAME_ANIMATION_KIND.screenTransition &&
			animation.nodeId &&
			animation.targetScreenId
		) {
			byNode.set(animation.nodeId, animation.targetScreenId);
		}
	}
	return [...byNode.entries()]
		.map(([nodeId, targetScreenId]) => ({
			nodeId,
			status: "unresolved" as const,
			targetScreenId,
		}))
		.sort((left, right) => left.nodeId.localeCompare(right.nodeId));
}

export function resolvePrototypeLinks(
	links: readonly PresentationLinkView[],
	screens: readonly PresentationScreenView[]
): PresentationLinkView[] {
	const present = new Set(screens.map((screen) => screen.id));
	return links.map((link) => ({
		...link,
		status: present.has(link.targetScreenId) ? "ok" : "unresolved",
	}));
}

export function buildPresentationView(input: {
	currentScreenId: string;
	screens: readonly PresentationScreenView[];
	startScreenId: string;
	unresolvedTarget?: boolean;
}): PresentationView | { reason: string; status: "rejected" } {
	const current =
		input.screens.find((screen) => screen.id === input.currentScreenId) ??
		input.screens.find((screen) => screen.id === input.startScreenId);
	if (!current) {
		return { reason: "start-screen-not-found", status: "rejected" };
	}
	const links = resolvePrototypeLinks(
		prototypeLinks(current.document),
		input.screens
	);
	return {
		currentScreenId: current.id,
		currentVersionNumber: current.versionNumber,
		editing: false,
		links,
		mode: SCREENS_COPY.presentationMode,
		screens: [...input.screens].sort((left, right) =>
			left.id.localeCompare(right.id)
		),
		startScreenId: input.startScreenId,
		toolsHidden: true,
		unresolvedLabel: SCREENS_COPY.unresolved,
		unresolvedTarget: input.unresolvedTarget === true,
		writes: false,
	};
}

export function followPresentationLink(
	view: PresentationView,
	nodeId: string
): PresentationView {
	const link = view.links.find((item) => item.nodeId === nodeId);
	if (link?.status !== "ok") {
		return {
			...view,
			editing: false,
			toolsHidden: true,
			unresolvedTarget: true,
			writes: false,
		};
	}
	const next = buildPresentationView({
		currentScreenId: link.targetScreenId,
		screens: view.screens,
		startScreenId: view.startScreenId,
	});
	if ("status" in next) {
		return {
			...view,
			editing: false,
			toolsHidden: true,
			unresolvedTarget: true,
			writes: false,
		};
	}
	return next;
}

export function wireframeManifest(
	screens: readonly PresentationScreenView[]
): string {
	const lines = [
		`## ${SCREENS_COPY.wireframe}`,
		"",
		...[...screens]
			.sort((left, right) => left.id.localeCompare(right.id))
			.map(
				(screen) =>
					`- ${SCREENS_COPY.screen} ${screen.title} (${screen.id}) ${SCREENS_COPY.wireframe} ${String(screen.versionNumber)}`
			),
	];
	return `${lines.join("\n")}\n`;
}

export function renderScreenSvg(
	document: WireframeDocument,
	selectionNodeIds?: readonly string[]
): string {
	const nodes = selectedNodes(document, selectionNodeIds);
	const bounds = boundsOf(nodes);
	const shapes = nodes
		.map((node) => {
			const label = escapeXml(node.label ?? node.kind);
			return [
				`<rect data-node="${escapeXml(node.id)}" fill="none" height="${String(node.geometry.height)}" stroke="#171717" stroke-width="1" width="${String(node.geometry.width)}" x="${String(node.geometry.x)}" y="${String(node.geometry.y)}"/>`,
				`<text font-family="${WIREFRAME_CANVAS_TYPEFACE}" font-size="14" x="${String(node.geometry.x + 8)}" y="${String(node.geometry.y + 22)}">${label}</text>`,
			].join("");
		})
		.join("");
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${String(bounds.minX)} ${String(bounds.minY)} ${String(bounds.width)} ${String(bounds.height)}" width="${String(bounds.width)}" height="${String(bounds.height)}">${shapes}</svg>`;
}

export function renderInteractiveHtml(input: {
	screens: readonly PresentationScreenView[];
	startScreenId: string;
}): { html: string; manifest: string } {
	const manifest = wireframeManifest(input.screens);
	const ordered = [...input.screens].sort((left, right) =>
		left.id.localeCompare(right.id)
	);
	const sections = ordered
		.map((screen) => {
			const links = resolvePrototypeLinks(
				prototypeLinks(screen.document),
				input.screens
			);
			const hidden = screen.id === input.startScreenId ? "" : " hidden";
			const nodes = screen.document.nodes
				.map((node) => {
					const link = links.find((item) => item.nodeId === node.id);
					const label = escapeHtml(node.label ?? node.kind);
					const unresolved =
						link?.status === "unresolved"
							? ` ${escapeHtml(SCREENS_COPY.unresolved)}`
							: "";
					const target = link
						? ` data-target="${escapeHtml(link.targetScreenId)}" data-link-status="${link.status}"`
						: "";
					return `<button type="button" data-node="${escapeHtml(node.id)}"${target} style="position:absolute;left:${String(node.geometry.x)}px;top:${String(node.geometry.y)}px;width:${String(node.geometry.width)}px;height:${String(node.geometry.height)}px;font-family:'${WIREFRAME_CANVAS_TYPEFACE}',cursive;background:transparent;border:1px solid #171717">${label}${unresolved}</button>`;
				})
				.join("");
			return `<section data-screen data-screen-id="${escapeHtml(screen.id)}" data-version="${String(screen.versionNumber)}"${hidden} style="position:relative;min-height:240px">${nodes}</section>`;
		})
		.join("");
	const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>${escapeHtml(SCREENS_COPY.wireframe)}</title><style>@font-face{font-family:"${WIREFRAME_CANVAS_TYPEFACE}";src:url("data:font/woff2;base64,d09GMgABAAAAAA") format("woff2");}body{margin:0;font-family:"${WIREFRAME_CANVAS_TYPEFACE}",cursive}[hidden]{display:none}#manifest{white-space:pre-wrap;padding:16px}</style></head><body><main data-start="${escapeHtml(input.startScreenId)}">${sections}</main><aside id="manifest">${escapeHtml(manifest)}</aside><script>(function(){document.addEventListener("click",function(event){var node=event.target&&event.target.closest?event.target.closest("[data-target]"):null;if(!node){return;}var status=node.getAttribute("data-link-status");var target=node.getAttribute("data-target");if(status!=="ok"||!target){var note=document.getElementById("unresolved-note");if(!note){note=document.createElement("p");note.id="unresolved-note";note.textContent=${JSON.stringify(SCREENS_COPY.unresolved)};document.body.appendChild(note);}return;}var screens=document.querySelectorAll("[data-screen]");for(var i=0;i<screens.length;i+=1){screens[i].hidden=screens[i].getAttribute("data-screen-id")!==target;}});})();</script></body></html>`;
	if (HTML_NETWORK.test(html) || PRODUCT_URL.test(html)) {
		throw new Error("html-not-isolated");
	}
	return { html, manifest };
}

export async function exportFromExactScreens(input: {
	format: WireframeExportFormat;
	screens: readonly PresentationScreenView[];
	selectionNodeIds?: readonly string[];
	startScreenId: string;
}): Promise<WireframeExportOutcome> {
	const start = input.screens.find(
		(screen) => screen.id === input.startScreenId
	);
	if (!start) {
		return { reason: "start-screen-not-found", status: "rejected" };
	}
	for (const screen of input.screens) {
		if (isKonvaStageJson(screen.document)) {
			return { reason: "konva-json-not-durable", status: "rejected" };
		}
		const parsed = parseWireframeDocument(screen.document);
		if (parsed.status !== "ok") {
			return { reason: parsed.reason, status: "rejected" };
		}
	}
	const manifest = wireframeManifest(input.screens);
	if (input.format === WIREFRAME_EXPORT_FORMAT.svg) {
		const svg = renderScreenSvg(start.document, input.selectionNodeIds);
		return {
			bytes: new TextEncoder().encode(svg),
			filename: `${start.id}.svg`,
			format: input.format,
			liveDocumentWritten: false,
			manifest,
			status: "ok",
		};
	}
	if (input.format === WIREFRAME_EXPORT_FORMAT.png) {
		const svg = renderScreenSvg(start.document, input.selectionNodeIds);
		const bytes = Uint8Array.from(
			await sharp(Buffer.from(svg)).png().toBuffer()
		);
		return {
			bytes,
			filename: `${start.id}.png`,
			format: input.format,
			liveDocumentWritten: false,
			manifest,
			status: "ok",
		};
	}
	if (input.format === WIREFRAME_EXPORT_FORMAT.pdf) {
		const titles = [...input.screens]
			.sort((left, right) => left.id.localeCompare(right.id))
			.flatMap((screen) => [
				`${SCREENS_COPY.screen} ${screen.title} ${SCREENS_COPY.wireframe} ${String(screen.versionNumber)}`,
				...prototypeLinks(screen.document).map((link) =>
					link.status === "ok"
						? `${link.nodeId} -> ${link.targetScreenId}`
						: `${link.nodeId} ${SCREENS_COPY.unresolved}`
				),
			]);
		return {
			bytes: encodePdfPages(titles.length > 0 ? titles : [start.title]),
			filename: `${start.id}.pdf`,
			format: input.format,
			liveDocumentWritten: false,
			manifest,
			status: "ok",
		};
	}
	const rendered = renderInteractiveHtml({
		screens: input.screens,
		startScreenId: input.startScreenId,
	});
	return {
		bytes: new TextEncoder().encode(rendered.html),
		filename: `${start.id}.html`,
		format: input.format,
		html: rendered.html,
		liveDocumentWritten: false,
		manifest: rendered.manifest,
		status: "ok",
	};
}

function selectedNodes(
	document: WireframeDocument,
	selectionNodeIds?: readonly string[]
): WireframeNode[] {
	if (!selectionNodeIds || selectionNodeIds.length === 0) {
		return document.nodes;
	}
	const wanted = new Set(selectionNodeIds);
	return document.nodes.filter((node) => wanted.has(node.id));
}

function boundsOf(nodes: readonly WireframeNode[]): {
	height: number;
	minX: number;
	minY: number;
	width: number;
} {
	if (nodes.length === 0) {
		return { height: 1, minX: 0, minY: 0, width: 1 };
	}
	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;
	for (const node of nodes) {
		minX = Math.min(minX, node.geometry.x);
		minY = Math.min(minY, node.geometry.y);
		maxX = Math.max(maxX, node.geometry.x + node.geometry.width);
		maxY = Math.max(maxY, node.geometry.y + node.geometry.height);
	}
	return {
		height: Math.max(1, maxY - minY),
		minX,
		minY,
		width: Math.max(1, maxX - minX),
	};
}

function escapeXml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");
}

function escapeHtml(value: string): string {
	return escapeXml(value).replaceAll("'", "&#39;");
}

function encodePdfPages(titles: readonly string[]): Uint8Array {
	const fontObject =
		"3 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n";
	const pages: string[] = [];
	const contents: string[] = [];
	for (const [index, title] of titles.entries()) {
		const pageNumber = 4 + index * 2;
		const contentNumber = pageNumber + 1;
		const text = title
			.replaceAll("\\", "\\\\")
			.replaceAll("(", "\\(")
			.replaceAll(")", "\\)");
		const stream = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
		contents.push(
			`${contentNumber} 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream\nendobj\n`
		);
		pages.push(
			`${pageNumber} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentNumber} 0 R /Resources << /Font << /F1 3 0 R >> >> >> endobj\n`
		);
	}
	const kids = titles.map((_, index) => `${4 + index * 2} 0 R`).join(" ");
	const catalog = "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n";
	const pagesObject = `2 0 obj << /Type /Pages /Kids [${kids}] /Count ${titles.length} >> endobj\n`;
	const body = [
		catalog,
		pagesObject,
		fontObject,
		...pages.flatMap((page, index) => [page, contents[index] ?? ""]),
	].join("");
	const header = "%PDF-1.4\n";
	const offsets = [0];
	let cursor = header.length;
	for (const object of [
		catalog,
		pagesObject,
		fontObject,
		...pages.flatMap((page, index) => [page, contents[index] ?? ""]),
	]) {
		offsets.push(cursor);
		cursor += object.length;
	}
	const xrefStart = header.length + body.length;
	const xrefEntries = ["0000000000 65535 f \n"];
	for (const offset of offsets.slice(1)) {
		xrefEntries.push(`${String(offset).padStart(10, "0")} 00000 n \n`);
	}
	const xref = `xref\n0 ${offsets.length}\n${xrefEntries.join("")}`;
	const trailer = `trailer << /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
	return new TextEncoder().encode(header + body + xref + trailer);
}
