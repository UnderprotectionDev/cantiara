import type { Prisma } from "@cantiara/db";

export interface FileObjectRecord {
	accessible: boolean;
	bytes: Uint8Array;
	objectKey: string;
}

export interface FileObjectStore {
	promote: (tx: Prisma.TransactionClient, objectKey: string) => Promise<void>;
	putTemp: (
		tx: Prisma.TransactionClient,
		input: { bytes: Uint8Array; objectKey: string; workspaceId: string }
	) => Promise<void>;
	read: (
		tx: Prisma.TransactionClient,
		objectKey: string
	) => Promise<FileObjectRecord | null>;
	remove: (tx: Prisma.TransactionClient, objectKey: string) => Promise<void>;
}

export function createPrismaFileObjectStore(): FileObjectStore {
	return {
		async promote(tx, objectKey) {
			await tx.fileObjectBlob.update({
				data: { accessible: true },
				where: { objectKey },
			});
		},
		async putTemp(tx, input) {
			await tx.fileObjectBlob.deleteMany({
				where: { objectKey: input.objectKey },
			});
			await tx.fileObjectBlob.create({
				data: {
					accessible: false,
					bytes: Buffer.from(input.bytes),
					objectKey: input.objectKey,
					workspaceId: input.workspaceId,
				},
			});
		},
		async read(tx, objectKey) {
			const row = await tx.fileObjectBlob.findUnique({
				where: { objectKey },
			});
			if (!row) {
				return null;
			}
			return {
				accessible: row.accessible,
				bytes: Uint8Array.from(row.bytes),
				objectKey: row.objectKey,
			};
		},
		async remove(tx, objectKey) {
			await tx.fileObjectBlob.deleteMany({ where: { objectKey } });
		},
	};
}

export function createFailingPromoteStore(
	inner: FileObjectStore
): FileObjectStore {
	return {
		promote: () => Promise.reject(new Error("promote-failed")),
		putTemp: (tx, input) => inner.putTemp(tx, input),
		read: (tx, objectKey) => inner.read(tx, objectKey),
		remove: (tx, objectKey) => inner.remove(tx, objectKey),
	};
}
