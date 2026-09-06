import { crc32, deflateSync } from "node:zlib";

export function encodePngImage(): Uint8Array {
	const width = 1;
	const height = 1;
	const raw = Uint8Array.from([0, 200, 80, 40]);
	const ihdr = new Uint8Array(13);
	writeUint32(ihdr, 0, width);
	writeUint32(ihdr, 4, height);
	ihdr[8] = 8;
	ihdr[9] = 2;
	const idat = deflateSync(raw);
	const signature = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
	const chunks = [
		pngChunk("IHDR", ihdr),
		pngChunk("IDAT", idat),
		pngChunk("IEND", new Uint8Array(0)),
	];
	const bytes = new Uint8Array(
		signature.length + chunks.reduce((sum, chunk) => sum + chunk.length, 0)
	);
	bytes.set(signature, 0);
	let offset = signature.length;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.length;
	}
	return bytes;
}

export function encodePdfPages(titles: readonly string[]): Uint8Array {
	const fontObject =
		"3 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n";
	const pages: string[] = [];
	const contents: string[] = [];
	for (const [index, title] of titles.entries()) {
		const pageNumber = 4 + index * 2;
		const contentNumber = pageNumber + 1;
		const text = pdfEscape(title);
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

function pngChunk(type: string, data: Uint8Array): Uint8Array {
	const typeBytes = new TextEncoder().encode(type);
	const chunk = new Uint8Array(12 + data.length);
	writeUint32(chunk, 0, data.length);
	chunk.set(typeBytes, 4);
	chunk.set(data, 8);
	writeUint32(chunk, 8 + data.length, crc32(concat(typeBytes, data)));
	return chunk;
}

function concat(left: Uint8Array, right: Uint8Array): Uint8Array {
	const bytes = new Uint8Array(left.length + right.length);
	bytes.set(left, 0);
	bytes.set(right, left.length);
	return bytes;
}

function writeUint32(target: Uint8Array, offset: number, value: number): void {
	const view = new DataView(target.buffer, target.byteOffset + offset, 4);
	view.setUint32(0, value);
}

function pdfEscape(value: string): string {
	return value
		.replaceAll("\\", "\\\\")
		.replaceAll("(", "\\(")
		.replaceAll(")", "\\)");
}
