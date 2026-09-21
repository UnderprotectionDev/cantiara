import {
  type FileAttachmentFinalizeInput,
  type FileAttachmentFinalizeReceipt,
  type FileAttachmentScope,
  fileAttachmentFinalizeReceiptSchema,
  fileAttachmentUploadSessionSchema,
} from "@cantiara/api/file-attachments";

import { env } from "@/env";
import { createTauriBearerHeaders } from "@/features/account-access/lib/tauri-session";
import { defaultClientShell } from "@/features/web-macos-client/store/client-shell";
import { client } from "@/utils/orpc";

const FILE_ATTACHMENT_STAGE_PATH = "/api/file-attachments/stage";

interface FileAttachmentUploadDependencies {
  createIdempotencyKey?: () => string;
  finalize?: (
    input: FileAttachmentFinalizeInput,
  ) => Promise<FileAttachmentFinalizeReceipt>;
  request?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  serverURL?: string;
}

function defaultDependencies(): Required<FileAttachmentUploadDependencies> {
  return {
    createIdempotencyKey: () => crypto.randomUUID(),
    finalize: async (input) =>
      fileAttachmentFinalizeReceiptSchema.parse(
        await client.finalizeFileAttachment(input),
      ),
    request: (input, init) => defaultClientShell.request(input, init),
    serverURL: env.VITE_SERVER_URL,
  };
}

async function responseErrorMessage(response: Response) {
  try {
    const body: unknown = await response.json();
    if (
      typeof body === "object" &&
      body !== null &&
      "message" in body &&
      typeof body.message === "string" &&
      body.message.length > 0
    ) {
      return body.message;
    }
  } catch {
    // Fall through to the stable product-facing message.
  }
  return "File Attachment upload could not be started. Try again.";
}

export async function uploadFileAttachment(
  file: File,
  scope: FileAttachmentScope,
  overrides: FileAttachmentUploadDependencies = {},
) {
  const dependencies = { ...defaultDependencies(), ...overrides };
  const clientIdempotencyKey = dependencies.createIdempotencyKey();
  const declaredMimeType = file.type || "application/octet-stream";
  const form = new FormData();
  form.set("clientIdempotencyKey", clientIdempotencyKey);
  form.set("declaredMimeType", declaredMimeType);
  form.set("file", file);
  form.set("fileName", file.name);
  form.set("mode", "new");
  form.set("scope", JSON.stringify(scope));

  const headers = await createTauriBearerHeaders(undefined);
  const response = await dependencies.request(
    new URL(FILE_ATTACHMENT_STAGE_PATH, dependencies.serverURL),
    {
      body: form,
      credentials: "include",
      headers,
      method: "POST",
    },
  );
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response));
  }

  const upload = fileAttachmentUploadSessionSchema.parse(await response.json());
  return dependencies.finalize({
    clientIdempotencyKey,
    declaredMimeType,
    fileName: file.name,
    mode: "new",
    scope,
    uploadId: upload.uploadId,
  });
}
