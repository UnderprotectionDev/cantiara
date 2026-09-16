import { createMiddleware } from "hono/factory";

const STATE_CHANGING_METHODS = new Set(["DELETE", "PATCH", "POST", "PUT"]);
const TRAILING_SLASH = /\/$/;

function normalizeOrigin(origin: string) {
  try {
    const parsed = new URL(origin);
    return parsed.origin === "null"
      ? origin.replace(TRAILING_SLASH, "")
      : parsed.origin;
  } catch {
    return "";
  }
}

export function isCookieAuthenticatedMutationCsrfSafe(
  request: Request,
  trustedOrigins: readonly string[],
) {
  if (
    !(
      STATE_CHANGING_METHODS.has(request.method.toUpperCase()) &&
      request.headers.has("cookie")
    )
  ) {
    return true;
  }

  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return false;
  }

  const origin = request.headers.get("origin");
  if (!origin) {
    return false;
  }

  const normalizedOrigin = normalizeOrigin(origin);
  return trustedOrigins.some(
    (trustedOrigin) => normalizeOrigin(trustedOrigin) === normalizedOrigin,
  );
}

export function createCsrfProtectionMiddleware(
  trustedOrigins: readonly string[],
) {
  return createMiddleware(async (context, next) => {
    if (
      !isCookieAuthenticatedMutationCsrfSafe(context.req.raw, trustedOrigins)
    ) {
      return context.json({ code: "FORBIDDEN" }, 403);
    }
    await next();
  });
}
