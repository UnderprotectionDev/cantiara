import {
  fileAttachmentScopeSchema,
  fileAttachmentStageInputSchema,
} from "@cantiara/api/file-attachments";
import { ZodError } from "zod";
import { noStoreHeaders } from "../../../no-store-headers";

export function fileAttachmentUnauthorizedResponse() {
  return Response.json(
    { code: "UNAUTHORIZED" },
    { headers: noStoreHeaders(), status: 401 },
  );
}

export function fileAttachmentErrorResponse(error: unknown) {
  if (error instanceof ZodError || error instanceof SyntaxError) {
    return Response.json(
      { code: "FILE_ATTACHMENT_INVALID_REQUEST" },
      { headers: noStoreHeaders(), status: 400 },
    );
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    error.code.startsWith("FILE_ATTACHMENT_")
  ) {
    const status =
      {
        FILE_ATTACHMENT_ACCOUNT_NOT_FOUND: 404,
        FILE_ATTACHMENT_IDEMPOTENCY_CONFLICT: 409,
        FILE_ATTACHMENT_PREVIEW_UNAVAILABLE: 503,
        FILE_ATTACHMENT_QUOTA_EXCEEDED: 412,
        FILE_ATTACHMENT_REVISION_CONFLICT: 409,
        FILE_ATTACHMENT_TARGET_NOT_FOUND: 404,
        FILE_ATTACHMENT_UPLOAD_NOT_FOUND: 404,
      }[error.code] ?? 400;
    return Response.json(
      {
        code: error.code,
        message:
          "message" in error && typeof error.message === "string"
            ? error.message
            : "File Attachment request was rejected.",
      },
      { headers: noStoreHeaders(), status },
    );
  }
  return Response.json(
    { code: "FILE_ATTACHMENT_UNAVAILABLE" },
    { headers: noStoreHeaders(), status: 500 },
  );
}

export function fileAttachmentUnavailableResponse() {
  return Response.json(
    { code: "FILE_ATTACHMENT_UNAVAILABLE" },
    { headers: noStoreHeaders(), status: 503 },
  );
}

export async function parseFileAttachmentStageForm(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    throw new ZodError([]);
  }
  const rawScope = form.get("scope");
  const rawBaseRevision = form.get("baseRevision");
  const rawAttachmentId = form.get("attachmentId");
  const scope =
    typeof rawScope === "string"
      ? fileAttachmentScopeSchema.parse(JSON.parse(rawScope))
      : undefined;
  const input = fileAttachmentStageInputSchema.parse({
    ...(scope ? { scope } : {}),
    ...(typeof rawAttachmentId === "string"
      ? { attachmentId: rawAttachmentId }
      : {}),
    ...(typeof rawBaseRevision === "string"
      ? { baseRevision: Number(rawBaseRevision) }
      : {}),
    clientIdempotencyKey: form.get("clientIdempotencyKey"),
    declaredMimeType: form.get("declaredMimeType") || file.type,
    fileName: form.get("fileName") || file.name,
    mode: form.get("mode"),
  });
  return { bytes: new Uint8Array(await file.arrayBuffer()), input };
}
