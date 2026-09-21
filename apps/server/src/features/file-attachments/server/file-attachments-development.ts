import type { FileAttachmentObjectStore } from "./file-attachments";

function copyBytes(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}

function temporaryObjectKey(accountId: string, uploadId: string) {
  return `file-attachments-temporary/${accountId}/${uploadId}`;
}

/**
 * Keeps the File Attachments seam usable in local development without R2
 * credentials. Production still requires R2 in createServerEnv; this store is
 * intentionally process-local and must never be used as durable storage.
 */
export function createDevelopmentFileAttachmentObjectStore(): FileAttachmentObjectStore {
  const objects = new Map<string, Uint8Array>();

  return {
    delete(key) {
      objects.delete(key);
      return Promise.resolve();
    },

    has(key) {
      return Promise.resolve(objects.has(key));
    },

    promote({ permanentKey, temporaryKey }) {
      const bytes = objects.get(temporaryKey);
      if (!bytes) {
        throw new Error("temporary object missing");
      }
      objects.set(permanentKey, copyBytes(bytes));
      return Promise.resolve();
    },

    putImmutable({ bytes, key }) {
      if (objects.has(key)) {
        return Promise.resolve("existing" as const);
      }
      objects.set(key, copyBytes(bytes));
      return Promise.resolve("created" as const);
    },

    putTemporary({ accountId, bytes, uploadId }) {
      const key = temporaryObjectKey(accountId, uploadId);
      objects.set(key, copyBytes(bytes));
      return Promise.resolve({ key });
    },

    read(key) {
      const bytes = objects.get(key);
      if (!bytes) {
        throw new Error("object missing");
      }
      return Promise.resolve(copyBytes(bytes));
    },
  };
}
