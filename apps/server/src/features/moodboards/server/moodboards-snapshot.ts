import sharp from "sharp";

import {
	MOODBOARD_SNAPSHOT_FORMAT,
	MOODBOARDS_COPY,
	type MoodboardSnapshotView,
	type MoodboardVisualView,
	type VisualPresentationView,
} from "./moodboards-model";

export async function renderPresentedPng(input: {
	original: Uint8Array;
	presentation: VisualPresentationView;
}): Promise<Uint8Array> {
	let pipeline = sharp(input.original);
	const meta = await pipeline.metadata();
	const width = meta.width ?? 1;
	const height = meta.height ?? 1;
	const { crop } = input.presentation;
	if (crop) {
		const left = Math.min(width - 1, Math.round(crop.left * width));
		const top = Math.min(height - 1, Math.round(crop.top * height));
		const extractWidth = Math.max(
			1,
			Math.min(width - left, Math.round(crop.width * width))
		);
		const extractHeight = Math.max(
			1,
			Math.min(height - top, Math.round(crop.height * height))
		);
		pipeline = pipeline.extract({
			height: extractHeight,
			left,
			top,
			width: extractWidth,
		});
	}
	if (input.presentation.rotation !== 0) {
		pipeline = pipeline.rotate(input.presentation.rotation);
	}
	return Uint8Array.from(await pipeline.png().toBuffer());
}

export async function placeholderPresentedPng(): Promise<Uint8Array> {
	return Uint8Array.from(
		await sharp({
			create: {
				background: { b: 36, g: 36, r: 36 },
				channels: 3,
				height: 8,
				width: 8,
			},
		})
			.png()
			.toBuffer()
	);
}

export async function buildDatedPdf(input: {
	pages: readonly { jpeg: Uint8Array; visualId: string }[];
	producedAt: string;
	title: string;
}): Promise<Uint8Array> {
	const images = await Promise.all(
		input.pages.map(async (page) => {
			const jpeg = Buffer.from(
				await sharp(page.jpeg).jpeg({ quality: 90 }).toBuffer()
			);
			const meta = await sharp(jpeg).metadata();
			return {
				height: meta.height ?? 1,
				jpeg,
				visualId: page.visualId,
				width: meta.width ?? 1,
			};
		})
	);
	const encoder = new TextEncoder();
	const chunks: Uint8Array[] = [];
	const offsets: number[] = [0];
	let length = 0;
	const push = (part: string | Uint8Array) => {
		const bytes = typeof part === "string" ? encoder.encode(part) : part;
		chunks.push(bytes);
		length += bytes.byteLength;
	};
	const startObject = () => {
		offsets.push(length);
	};
	push("%PDF-1.4\n");
	startObject();
	push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
	const pageIds = images.map((_, index) => 4 + index * 3);
	startObject();
	push(
		`2 0 obj\n<< /Type /Pages /Count ${images.length} /Kids [${pageIds
			.map((id) => `${id} 0 R`)
			.join(" ")}] >>\nendobj\n`
	);
	startObject();
	push(
		"3 0 obj\n<< /Title (" +
			escapePdf(input.title) +
			") /CreationDate (" +
			escapePdf(input.producedAt) +
			") /Producer (" +
			escapePdf(MOODBOARDS_COPY.snapshot) +
			") >>\nendobj\n"
	);
	for (const [index, image] of images.entries()) {
		const pageId = 4 + index * 3;
		const contentId = pageId + 1;
		const imageId = pageId + 2;
		startObject();
		push(
			`${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${image.width} ${image.height}] /Contents ${contentId} 0 R /Resources << /XObject << /Im0 ${imageId} 0 R >> >> >>\nendobj\n`
		);
		const content = `q ${image.width} 0 0 ${image.height} 0 0 cm /Im0 Do Q`;
		startObject();
		push(
			`${contentId} 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`
		);
		startObject();
		push(
			`${imageId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.jpeg.byteLength} >>\nstream\n`
		);
		push(image.jpeg);
		push("\nendstream\nendobj\n");
	}
	const xrefStart = length;
	push(`xref\n0 ${offsets.length}\n`);
	push("0000000000 65535 f \n");
	for (const offset of offsets.slice(1)) {
		push(`${String(offset).padStart(10, "0")} 00000 n \n`);
	}
	push(
		`trailer\n<< /Size ${offsets.length} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`
	);
	const out = new Uint8Array(length);
	let cursor = 0;
	for (const chunk of chunks) {
		out.set(chunk, cursor);
		cursor += chunk.byteLength;
	}
	return out;
}

export function snapshotFilename(input: {
	format: typeof MOODBOARDS_COPY.png | typeof MOODBOARDS_COPY.pdf;
	producedAt: string;
	visualId: string | null;
}): string {
	const stamp = input.producedAt.slice(0, 10);
	if (input.format === MOODBOARD_SNAPSHOT_FORMAT.pdf) {
		return `moodboard-snapshot-${stamp}.pdf`;
	}
	return `moodboard-snapshot-${stamp}-${input.visualId ?? "page"}.png`;
}

export function snapshotPreviewFor(
	visuals: readonly MoodboardVisualView[],
	format: typeof MOODBOARDS_COPY.png | typeof MOODBOARDS_COPY.pdf,
	viewMoment: string
): MoodboardSnapshotView["preview"] {
	return {
		applied: visuals.map((visual) => ({
			crop: visual.presentation.crop,
			fileAttachmentVersionId: visual.presentation.fileAttachmentVersionId,
			rotation: visual.presentation.rotation,
			visualId: visual.id,
		})),
		format,
		liveSourceLinks: false,
		noLiveSourceLinks: MOODBOARDS_COPY.noLiveSourceLinks,
		viewMoment,
	};
}

function escapePdf(value: string): string {
	return value
		.replaceAll("\\", "\\\\")
		.replaceAll("(", "\\(")
		.replaceAll(")", "\\)");
}
