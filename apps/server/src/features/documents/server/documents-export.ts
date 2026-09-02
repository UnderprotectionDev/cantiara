import {
	DOCUMENTS_COPY,
	type DocumentBodyBlock,
	type DocumentExportOutcome,
	presentDocumentBody,
} from "./documents-model";

export function freezeLiveBlocksToMarkdown(input: {
	attachments: readonly {
		filename: string;
		id: string;
		versionNumber: number;
	}[];
	blocks: readonly DocumentBodyBlock[];
	body: string;
	documentId: string;
	exportedAt: Date;
	revision: number;
	title: string;
}): { manifest: string; markdown: string } {
	const date = input.exportedAt.toISOString().slice(0, 10);
	const presented = presentDocumentBody(input.body);
	const live = input.blocks.filter(isLiveSnapshotSource);
	let liveIndex = 0;
	const parts: string[] = [`# ${input.title}`, ""];
	const manifestLines: string[] = [
		`## ${DOCUMENTS_COPY.snapshot}`,
		"",
		`- ${DOCUMENTS_COPY.document} ${input.documentId} ${DOCUMENTS_COPY.version} ${String(input.revision)}`,
	];
	for (const block of presented.blocks) {
		if (block.kind === "live-marker") {
			const resolved = live[liveIndex];
			liveIndex += 1;
			const snapshot = snapshotFor(block.language, resolved, date);
			parts.push(snapshot.markdown, "");
			manifestLines.push(`- ${snapshot.manifest}`);
			continue;
		}
		if (block.kind === "markdown") {
			parts.push(block.text);
			continue;
		}
		if (block.kind === "fenced-code") {
			parts.push(`\`\`\`${block.language}\n${block.source}\n\`\`\``);
			continue;
		}
		if (block.kind === "mermaid" || block.kind === "latex") {
			parts.push(`\`\`\`${block.kind}\n${block.source}\n\`\`\``);
		}
	}
	for (const file of input.attachments) {
		manifestLines.push(
			`- ${file.filename} (${file.id}) ${DOCUMENTS_COPY.version} ${String(file.versionNumber)}`
		);
	}
	const manifest = `${manifestLines.join("\n")}\n`;
	const markdown = `${parts.join("\n").trim()}\n\n${manifest}`;
	return { manifest, markdown };
}

export function renderDocumentPdf(markdown: string): Uint8Array {
	const lines = markdown.split("\n").slice(0, 60);
	const commands = [
		"BT",
		"/F1 10 Tf",
		"72 760 Td",
		"12 TL",
		...lines.map((line) => `(${pdfEscape(line.slice(0, 110))}) Tj T*`),
		"ET",
	].join("\n");
	const stream = `${commands}\n% ${DOCUMENTS_COPY.snapshot}\n${markdown
		.split("\n")
		.map((line) => `% ${line}`)
		.join("\n")}\n`;
	const objects = [
		"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
		"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
		"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >> endobj",
		`4 0 obj << /Length ${String(Buffer.byteLength(stream, "utf8"))} >> stream\n${stream}\nendstream endobj`,
		"5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Courier >> endobj",
	];
	let offset = "%PDF-1.4\n".length;
	const offsets = [0];
	const body: string[] = [];
	for (const object of objects) {
		offsets.push(offset);
		body.push(object);
		offset += object.length + 1;
	}
	const xrefStart = offset;
	const xref = [
		"xref",
		`0 ${String(objects.length + 1)}`,
		"0000000000 65535 f ",
		...offsets
			.slice(1)
			.map((value) => `${String(value).padStart(10, "0")} 00000 n `),
	].join("\n");
	const pdf = `%PDF-1.4\n${body.join("\n")}\n${xref}\ntrailer << /Size ${String(objects.length + 1)} /Root 1 0 R >>\nstartxref\n${String(xrefStart)}\n%%EOF\n`;
	return new TextEncoder().encode(pdf);
}

export function exportOutcomeFromMarkdown(
	format: string,
	markdown: string,
	manifest: string
): DocumentExportOutcome {
	if (format === "word" || format === "docx") {
		return { reason: "word-export-forbidden", status: "rejected" };
	}
	if (format === "markdown") {
		return { format: "markdown", manifest, markdown, status: "ok" };
	}
	if (format === "pdf") {
		return {
			format: "pdf",
			manifest,
			markdown,
			pdf: renderDocumentPdf(markdown),
			status: "ok",
		};
	}
	return { reason: "invalid-command", status: "rejected" };
}

function isLiveSnapshotSource(block: DocumentBodyBlock): boolean {
	return "resolution" in block;
}

function snapshotFor(
	language: string,
	block: DocumentBodyBlock | undefined,
	date: string
): { manifest: string; markdown: string } {
	const label = snapshotLabel(language, block);
	const body = snapshotBody(block);
	const markdown = `> ${DOCUMENTS_COPY.snapshot} · ${label} · ${date}\n>\n> ${body.replaceAll("\n", "\n> ")}`;
	return { manifest: `${label} ${date}`, markdown };
}

function snapshotLabel(
	language: string,
	block: DocumentBodyBlock | undefined
): string {
	if (block && "resolution" in block && block.resolution === "ok") {
		if (block.kind === "live-work") {
			return DOCUMENTS_COPY.liveWorkBlock;
		}
		if (block.kind === "live-collection") {
			return block.name;
		}
		if (block.kind === "live-section") {
			return DOCUMENTS_COPY.readOnlyLiveSection;
		}
		if (block.kind === "live-diagram" || block.kind === "live-diagram-view") {
			return block.title;
		}
	}
	return language;
}

function snapshotBody(block: DocumentBodyBlock | undefined): string {
	if (!(block && "resolution" in block)) {
		return DOCUMENTS_COPY.couldNotRender;
	}
	if (block.resolution === "broken") {
		return block.reason;
	}
	if (block.kind === "live-work") {
		return `${block.key} ${block.title} (${block.workStatus})`;
	}
	if (block.kind === "live-collection") {
		return block.name;
	}
	if (block.kind === "live-section") {
		return `${block.heading}\n${block.text}`;
	}
	if (block.kind === "live-diagram" || block.kind === "live-diagram-view") {
		return block.title;
	}
	return DOCUMENTS_COPY.couldNotRender;
}

function pdfEscape(value: string): string {
	return value
		.replaceAll("\\", "\\\\")
		.replaceAll("(", "\\(")
		.replaceAll(")", "\\)")
		.replaceAll(/[^\x20-\x7E]/g, " ");
}
