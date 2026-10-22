import {
  type FileAttachmentFinalizeInput,
  type FileAttachmentFinalizeReceipt,
  type FileAttachmentScope,
  fileAttachmentFinalizeReceiptSchema,
  fileAttachmentUploadSessionSchema,
} from "@cantiara/api/file-attachments";
import Uppy from "@uppy/core";
import { z } from "zod";

import { env } from "@/env";
import { createTauriBearerHeaders } from "@/features/account-access/lib/tauri-session";
import { defaultClientShell } from "@/features/web-macos-client/store/client-shell";
import { client } from "@/utils/orpc";

type FileAttachmentUploadSession = z.infer<
  typeof fileAttachmentUploadSessionSchema
>;

const FILE_ATTACHMENT_STAGE_PATH = "/api/file-attachments/stage";
const uploadErrorBodySchema = z.object({ message: z.string().min(1) });

interface FileAttachmentUploadDependencies {
  createIdempotencyKey?: () => string;
  finalize?: (
    input: FileAttachmentFinalizeInput,
  ) => Promise<FileAttachmentFinalizeReceipt>;
  request?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  serverURL?: string;
}

interface FileAttachmentUploadOptions {
  /** Resolves once staging is complete and the finalize barrier begins. */
  onFinalizeStart?: () => void;
  /** Cancels the staging upload; finalize has not started in that case. */
  signal?: AbortSignal;
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
    const body = uploadErrorBodySchema.safeParse(await response.json());
    if (body.success) {
      return body.data.message;
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
  options: FileAttachmentUploadOptions = {},
) {
  const dependencies = { ...defaultDependencies(), ...overrides };
  const clientIdempotencyKey = dependencies.createIdempotencyKey();
  const declaredMimeType = file.type || "application/octet-stream";
  const uppy = new Uppy({
    allowMultipleUploadBatches: false,
    autoProceed: false,
  });
  const staged: { session?: FileAttachmentUploadSession } = {};
  // Uppy Core owns the upload lifecycle; the uploader posts the multipart
  // stage request through the Client Shell so connection gating, credentials
  // and the Tauri bearer header stay in one place.
  uppy.addUploader(async (fileIDs) => {
    const [uppyFile] = fileIDs.map((id) => uppy.getFile(id));
    const form = new FormData();
    form.set("clientIdempotencyKey", clientIdempotencyKey);
    form.set("declaredMimeType", declaredMimeType);
    form.set("file", uppyFile?.data instanceof Blob ? uppyFile.data : file);
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
        signal: options.signal,
      },
    );
    if (!response.ok) {
      throw new Error(await responseErrorMessage(response));
    }
    staged.session = fileAttachmentUploadSessionSchema.parse(
      await response.json(),
    );
  });
  const cancel = () => uppy.cancelAll();
  options.signal?.addEventListener("abort", cancel, { once: true });
  try {
    uppy.addFile({
      data: file,
      name: file.name,
      source: "file-attachment-upload",
      type: declaredMimeType,
    });
    await uppy.upload();
  } catch (error) {
    if (options.signal?.aborted) {
      // biome-ignore lint/style/useErrorCause: DOMException does not accept ErrorOptions.
      throw new DOMException("The staging upload was cancelled.", "AbortError");
    }
    throw error;
  } finally {
    options.signal?.removeEventListener("abort", cancel);
    uppy.destroy();
  }
  if (!staged.session) {
    throw new DOMException("The staging upload was cancelled.", "AbortError");
  }

  options.onFinalizeStart?.();
  return dependencies.finalize({
    clientIdempotencyKey,
    declaredMimeType,
    fileName: file.name,
    mode: "new",
    scope,
    uploadId: staged.session.uploadId,
  });
}
