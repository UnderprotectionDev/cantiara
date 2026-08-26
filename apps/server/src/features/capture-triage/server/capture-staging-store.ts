import type { PrismaClient } from "@cantiara/db";

export interface CaptureStagingPut {
	byteLength: number;
	ciphertext: Uint8Array;
	contentType: string;
	filename: string;
	id: string;
	inboxItemId: string;
	keyVersion: number;
	workspaceId: string;
	wrappedDek: Uint8Array;
}

export interface CaptureStagingMeta {
	filename: string;
	id: string;
}

export interface CaptureStagingStore {
	deleteByInboxItemId: (inboxItemId: string) => Promise<void>;
	put: (input: CaptureStagingPut) => Promise<void>;
	readMeta: (inboxItemId: string) => Promise<CaptureStagingMeta | null>;
}

export function createPrismaCaptureStagingStore(
	prisma: PrismaClient
): CaptureStagingStore {
	return {
		async deleteByInboxItemId(inboxItemId) {
			await prisma.captureStagingObject.deleteMany({
				where: { inboxItemId },
			});
		},
		async put(input) {
			await prisma.captureStagingObject.deleteMany({
				where: { inboxItemId: input.inboxItemId },
			});
			await prisma.captureStagingObject.create({
				data: {
					byteLength: input.byteLength,
					ciphertext: Buffer.from(input.ciphertext),
					contentType: input.contentType,
					filename: input.filename,
					id: input.id,
					inboxItemId: input.inboxItemId,
					keyVersion: input.keyVersion,
					workspaceId: input.workspaceId,
					wrappedDek: Buffer.from(input.wrappedDek),
				},
			});
		},
		async readMeta(inboxItemId) {
			const row = await prisma.captureStagingObject.findUnique({
				where: { inboxItemId },
			});
			if (!row) {
				return null;
			}
			return { filename: row.filename, id: row.id };
		},
	};
}

export function createRecordingCaptureStagingStore(
	inner: CaptureStagingStore,
	puts: Uint8Array[]
): CaptureStagingStore {
	return {
		deleteByInboxItemId: (inboxItemId) =>
			inner.deleteByInboxItemId(inboxItemId),
		async put(input) {
			puts.push(Uint8Array.from(input.ciphertext));
			await inner.put(input);
		},
		readMeta: (inboxItemId) => inner.readMeta(inboxItemId),
	};
}
