import type { PrismaClient } from "@cantiara/db";

import { envelopeOpen } from "../../capture-triage/server/capture-staging-crypto";

export interface CaptureStagingPlaintext {
	bytes: Uint8Array;
	contentType: string;
	filename: string;
}

export interface CaptureStagingSource {
	delete: (inboxItemId: string) => Promise<void>;
	put?: (inboxItemId: string, object: CaptureStagingPlaintext) => Promise<void>;
	read: (inboxItemId: string) => Promise<CaptureStagingPlaintext | null>;
}

export function createMemoryCaptureStagingSource(): CaptureStagingSource {
	const objects = new Map<string, CaptureStagingPlaintext>();
	return {
		delete(inboxItemId) {
			objects.delete(inboxItemId);
			return Promise.resolve();
		},
		put(inboxItemId, object) {
			objects.set(inboxItemId, object);
			return Promise.resolve();
		},
		read(inboxItemId) {
			return Promise.resolve(objects.get(inboxItemId) ?? null);
		},
	};
}

export function createPrismaCaptureStagingSource(
	prisma: PrismaClient,
	rootKey: Uint8Array
): CaptureStagingSource {
	return {
		async delete(inboxItemId) {
			await prisma.captureStagingObject.deleteMany({
				where: { inboxItemId },
			});
		},
		async read(inboxItemId) {
			const row = await prisma.captureStagingObject.findUnique({
				where: { inboxItemId },
			});
			if (!row) {
				return null;
			}
			return {
				bytes: envelopeOpen({
					ciphertext: Uint8Array.from(row.ciphertext),
					rootKey,
					wrappedDek: Uint8Array.from(row.wrappedDek),
				}),
				contentType: row.contentType,
				filename: row.filename,
			};
		},
	};
}
