import type { FileAttachmentObjectStore } from "./file-attachments";
import { createDevelopmentFileAttachmentObjectStore } from "./file-attachments-development";
import {
  createR2FileAttachmentObjectStore,
  type R2FileAttachmentConfig,
} from "./file-attachments-r2";

export interface FileAttachmentObjectStoreOptions {
  nodeEnv: "development" | "production" | "test";
  r2?: R2FileAttachmentConfig;
}

export function createFileAttachmentObjectStore({
  nodeEnv,
  r2,
}: FileAttachmentObjectStoreOptions): FileAttachmentObjectStore | undefined {
  if (r2) {
    return createR2FileAttachmentObjectStore(r2);
  }
  if (nodeEnv === "development") {
    return createDevelopmentFileAttachmentObjectStore();
  }
  return undefined;
}
