import type { Prisma, PrismaClient } from "@cantiara/db";
import sharp from "sharp";

import {
	derivativeObjectKeyFor,
	FILE_KIND,
	IMAGE_DERIVATIVE_LIMITS,
	PREVIEW_STATUS,
	THUMBNAIL_SIZE,
	type ThumbnailSize,
} from "./file-attachments-model";
import type { FileObjectStore } from "./file-attachments-store";

export type DerivativeFailureCause =
	| "cpu"
	| "decode-limit"
	| "frames"
	| "pixels";

export type DerivativeProduceResult =
	| {
			medium: Uint8Array;
			small: Uint8Array;
			status: "ok";
	  }
	| { cause: DerivativeFailureCause; status: "limit-exceeded" };

export interface ImageDerivativeEngine {
	produce: (bytes: Uint8Array) => Promise<DerivativeProduceResult>;
}

const GPS_MARKERS = ["GPSLatitude", "GPSLongitude", "GPSInfo"];
const DEVICE_MARKERS = ["Apple iPhone", "iPhone"];

export function derivativeContainsSensitiveExif(bytes: Uint8Array): boolean {
	const ascii = Buffer.from(bytes).toString("latin1");
	return (
		GPS_MARKERS.some((marker) => ascii.includes(marker)) ||
		DEVICE_MARKERS.some((marker) => ascii.includes(marker))
	);
}

export function createSharpDerivativeEngine(): ImageDerivativeEngine {
	return {
		async produce(bytes) {
			try {
				const image = sharp(bytes, {
					failOn: "error",
					limitInputPixels: IMAGE_DERIVATIVE_LIMITS.maxPixels,
					pages: -1,
				});
				const metadata = await Promise.race([image.metadata(), cpuTimeout()]);
				if (metadata === "timeout") {
					return { cause: "cpu", status: "limit-exceeded" };
				}
				const width = metadata.width ?? 0;
				const height = metadata.height ?? 0;
				const frames = metadata.pages ?? 1;
				if (
					width > IMAGE_DERIVATIVE_LIMITS.maxWidth ||
					height > IMAGE_DERIVATIVE_LIMITS.maxHeight
				) {
					return { cause: "decode-limit", status: "limit-exceeded" };
				}
				if (width * height > IMAGE_DERIVATIVE_LIMITS.maxPixels) {
					return { cause: "pixels", status: "limit-exceeded" };
				}
				if (frames > IMAGE_DERIVATIVE_LIMITS.maxFrames) {
					return { cause: "frames", status: "limit-exceeded" };
				}
				const rendered = await Promise.race([
					renderThumbnails(bytes),
					cpuTimeout(),
				]);
				if (rendered === "timeout") {
					return { cause: "cpu", status: "limit-exceeded" };
				}
				return rendered;
			} catch {
				return { cause: "decode-limit", status: "limit-exceeded" };
			}
		},
	};
}

async function renderThumbnails(
	bytes: Uint8Array
): Promise<Extract<DerivativeProduceResult, { status: "ok" }>> {
	const oriented = sharp(bytes, { failOn: "error" }).rotate();
	const [small, medium] = await Promise.all([
		oriented
			.clone()
			.resize({
				fit: "inside",
				width: IMAGE_DERIVATIVE_LIMITS.smallPx,
				withoutEnlargement: true,
			})
			.webp({ effort: 2 })
			.toBuffer(),
		oriented
			.clone()
			.resize({
				fit: "inside",
				width: IMAGE_DERIVATIVE_LIMITS.mediumPx,
				withoutEnlargement: true,
			})
			.webp({ effort: 2 })
			.toBuffer(),
	]);
	return {
		medium: Uint8Array.from(medium),
		small: Uint8Array.from(small),
		status: "ok",
	};
}

function cpuTimeout(): Promise<"timeout"> {
	return new Promise((resolve) => {
		setTimeout(() => resolve("timeout"), IMAGE_DERIVATIVE_LIMITS.cpuMs);
	});
}

export function previewSupportReference(): string {
	const bytes = new Uint8Array(4);
	crypto.getRandomValues(bytes);
	return `CANT-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"))
		.join("")
		.toUpperCase()}`;
}

export async function ensureImageDerivatives(
	prisma: PrismaClient,
	input: {
		contentHash: string;
		kind: string;
		versionId: string;
		workspaceId: string;
	},
	deps: {
		engine?: ImageDerivativeEngine;
		store: FileObjectStore;
	}
): Promise<void> {
	if (input.kind !== FILE_KIND.image) {
		await prisma.fileAttachmentVersion.update({
			data: {
				previewCause: null,
				previewStatus: PREVIEW_STATUS.ready,
			},
			where: { id: input.versionId },
		});
		return;
	}
	const existing = await prisma.fileImageDerivative.findMany({
		where: { contentHash: input.contentHash },
	});
	if (
		existing.some((row) => row.size === THUMBNAIL_SIZE.small) &&
		existing.some((row) => row.size === THUMBNAIL_SIZE.medium)
	) {
		await prisma.fileAttachmentVersion.update({
			data: {
				previewCause: null,
				previewStatus: PREVIEW_STATUS.ready,
			},
			where: { id: input.versionId },
		});
		return;
	}
	const version = await prisma.fileAttachmentVersion.findUnique({
		where: { id: input.versionId },
	});
	if (!version) {
		return;
	}
	if (version.previewAttempts >= IMAGE_DERIVATIVE_LIMITS.retryLimit) {
		await prisma.fileAttachmentVersion.update({
			data: {
				previewStatus: PREVIEW_STATUS.unavailable,
			},
			where: { id: input.versionId },
		});
		return;
	}
	const blob = await deps.store.read(
		prisma as unknown as Prisma.TransactionClient,
		version.objectKey
	);
	if (!blob?.accessible) {
		return;
	}
	const engine = deps.engine ?? createSharpDerivativeEngine();
	const result = await produceUntilReady(
		engine,
		blob.bytes,
		version.previewAttempts,
		version.previewSupportReference,
		null
	);
	if (result.status === "ok") {
		await persistDerivative(prisma, deps.store, {
			bytes: result.small,
			contentHash: input.contentHash,
			size: THUMBNAIL_SIZE.small,
			workspaceId: input.workspaceId,
		});
		await persistDerivative(prisma, deps.store, {
			bytes: result.medium,
			contentHash: input.contentHash,
			size: THUMBNAIL_SIZE.medium,
			workspaceId: input.workspaceId,
		});
		await prisma.fileAttachmentVersion.update({
			data: {
				previewAttempts: result.attempts,
				previewCause: null,
				previewDataWritten: false,
				previewStatus: PREVIEW_STATUS.ready,
			},
			where: { id: input.versionId },
		});
		return;
	}
	await prisma.fileAttachmentVersion.update({
		data: {
			previewAttempts: result.attempts,
			previewCause: result.cause,
			previewDataWritten: false,
			previewStatus: PREVIEW_STATUS.unavailable,
			previewSupportReference: result.supportReference,
		},
		where: { id: input.versionId },
	});
}

async function produceUntilReady(
	engine: ImageDerivativeEngine,
	bytes: Uint8Array,
	attempts: number,
	supportReference: string | null,
	lastCause: DerivativeFailureCause | null
): Promise<
	| { attempts: number; medium: Uint8Array; small: Uint8Array; status: "ok" }
	| {
			attempts: number;
			cause: DerivativeFailureCause | null;
			status: "unavailable";
			supportReference: string | null;
	  }
> {
	if (attempts >= IMAGE_DERIVATIVE_LIMITS.retryLimit) {
		return {
			attempts,
			cause: lastCause,
			status: "unavailable",
			supportReference,
		};
	}
	const produced = await engine.produce(bytes);
	if (
		produced.status === "ok" &&
		!(
			derivativeContainsSensitiveExif(produced.small) ||
			derivativeContainsSensitiveExif(produced.medium)
		)
	) {
		return {
			attempts,
			medium: produced.medium,
			small: produced.small,
			status: "ok",
		};
	}
	if (produced.status === "ok") {
		return await produceUntilReady(
			engine,
			bytes,
			attempts + 1,
			supportReference ?? previewSupportReference(),
			"decode-limit"
		);
	}
	return await produceUntilReady(
		engine,
		bytes,
		attempts + 1,
		supportReference ?? previewSupportReference(),
		produced.cause
	);
}

async function persistDerivative(
	prisma: PrismaClient,
	store: FileObjectStore,
	input: {
		bytes: Uint8Array;
		contentHash: string;
		size: ThumbnailSize;
		workspaceId: string;
	}
) {
	const objectKey = derivativeObjectKeyFor(input.contentHash, input.size);
	const already = await prisma.fileImageDerivative.findUnique({
		where: {
			contentHash_size: {
				contentHash: input.contentHash,
				size: input.size,
			},
		},
	});
	if (already) {
		return;
	}
	await store.putTemp(prisma as unknown as Prisma.TransactionClient, {
		bytes: input.bytes,
		objectKey,
		workspaceId: input.workspaceId,
	});
	await store.promote(prisma as unknown as Prisma.TransactionClient, objectKey);
	await prisma.fileImageDerivative.create({
		data: {
			contentHash: input.contentHash,
			id: crypto.randomUUID(),
			objectKey,
			size: input.size,
		},
	});
}

export async function removeDerivativesForHash(
	prisma: PrismaClient | Prisma.TransactionClient,
	contentHash: string,
	store: FileObjectStore
): Promise<void> {
	const remaining = await prisma.fileAttachmentVersion.count({
		where: { contentHash },
	});
	if (remaining > 0) {
		return;
	}
	const rows = await prisma.fileImageDerivative.findMany({
		where: { contentHash },
	});
	await Promise.all(
		rows.map((row) =>
			store.remove(prisma as Prisma.TransactionClient, row.objectKey)
		)
	);
	await prisma.fileImageDerivative.deleteMany({ where: { contentHash } });
}
