import { ZodError } from "zod";
import { noStoreHeaders } from "../../../no-store-headers";
import { WebCaptureError } from "./web-capture";

export function webCaptureToken(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }
  const token = authorization.slice("Bearer ".length).trim();
  return token.length > 0 && token.length <= 512 ? token : null;
}

export function webCaptureErrorResponse(error: unknown) {
  if (error instanceof ZodError || error instanceof SyntaxError) {
    return Response.json(
      { code: "WEB_CAPTURE_INVALID_REQUEST" },
      { headers: noStoreHeaders(), status: 400 },
    );
  }
  if (error instanceof WebCaptureError) {
    const status = {
      WEB_CAPTURE_IDEMPOTENCY_CONFLICT: 409,
      WEB_CAPTURE_LINK_NOT_FOUND: 401,
      WEB_CAPTURE_LINK_REVOKED: 401,
      WEB_CAPTURE_PAIRING_INVALID: 401,
      WEB_CAPTURE_REAUTH_REQUIRED: 401,
      WEB_CAPTURE_STAGING_UNAVAILABLE: 503,
      WEB_CAPTURE_TARGET_NOT_FOUND: 404,
    }[error.code];
    return Response.json(
      { code: error.code, message: error.message },
      { headers: noStoreHeaders(), status },
    );
  }
  return Response.json(
    { code: "WEB_CAPTURE_UNAVAILABLE" },
    { headers: noStoreHeaders(), status: 500 },
  );
}

export function webCaptureUnavailableResponse() {
  return Response.json(
    { code: "WEB_CAPTURE_UNAVAILABLE" },
    { headers: noStoreHeaders(), status: 503 },
  );
}

export function webCaptureUnauthorizedResponse() {
  return Response.json(
    { code: "UNAUTHORIZED" },
    { headers: noStoreHeaders(), status: 401 },
  );
}
