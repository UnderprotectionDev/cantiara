import { SHARE_VISITOR_LINK_PATH } from "@cantiara/api/link-sharing";
import { type Context, Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import {
  gatePage,
  surfacePage,
  unavailablePage,
  visitorHeaders,
} from "./link-sharing-page";
import type {
  ExchangeResult,
  LinkSharingVisitorAccess,
  VisitorSignals,
} from "./link-sharing-visitor";

/**
 * The visitor HTTP boundary: `GET /s/:token` and `POST /s` exchange the token
 * (and the Link password) for a Paylaşım erişim oturumu and redirect to the
 * token-free `GET /shared/:surfaceId`. The session cookie is `__Secure-`
 * prefixed, `HttpOnly`, `Secure`, `SameSite=Lax`, scoped to that one surface's
 * path and has no `Max-Age`, so it ends when the browser closes; the server
 * also ends it 12 hours after creation. These routes read no Better Auth
 * cookie and the product's RPC never reads this one.
 */

/** Name without the `__Secure-` prefix the cookie helper adds. */
export const SHARE_COOKIE_NAME = "cantiara-share";
export const SHARE_SURFACE_PATH = "/shared";
const MAX_FORM_BYTES = 4096;
const MAX_DEVICE_LENGTH = 200;

function respond(
  html: string,
  status: 200 | 401 | 404 | 429,
  nonce: string,
  options: { frames?: boolean; retryAfterSeconds?: number } = {},
) {
  return new Response(html, {
    headers: {
      ...visitorHeaders({ frames: options.frames ?? false, nonce }),
      ...(options.retryAfterSeconds
        ? { "Retry-After": String(options.retryAfterSeconds) }
        : {}),
    },
    status,
  });
}

export function createLinkSharingVisitorRoutes(options: {
  /** The caller's trusted-proxy aware client address (Account Access owns it). */
  networkOf: (request: Request, context: Context) => string;
  visitor: LinkSharingVisitorAccess;
}) {
  const { networkOf, visitor } = options;
  const routes = new Hono();

  const signalsOf = (request: Request, context: Context): VisitorSignals => ({
    device: (request.headers.get("user-agent") ?? "").slice(
      0,
      MAX_DEVICE_LENGTH,
    ),
    network: networkOf(request, context),
  });

  function finish(
    context: Context,
    result: ExchangeResult,
    token: string,
    attempted: boolean,
  ) {
    const nonce = crypto.randomUUID();
    if (result.status === "granted") {
      const { surfaceId } = result;
      setCookie(context, SHARE_COOKIE_NAME, result.cookieValue, {
        httpOnly: true,
        path: `${SHARE_SURFACE_PATH}/${surfaceId}`,
        prefix: "secure",
        sameSite: "Lax",
        secure: true,
      });
      // The redirect drops the token from the address bar and history.
      return context.redirect(`${SHARE_SURFACE_PATH}/${surfaceId}`, 303);
    }
    if (result.status === "cooldown") {
      return respond(
        gatePage({
          error: "cooldown",
          nonce,
          retryAfterSeconds: result.retryAfterSeconds,
          token,
        }),
        429,
        nonce,
        { retryAfterSeconds: result.retryAfterSeconds },
      );
    }
    return respond(
      gatePage({ error: attempted ? "denied" : null, nonce, token }),
      attempted ? 401 : 200,
      nonce,
    );
  }

  routes.get(`${SHARE_VISITOR_LINK_PATH}/:token`, async (c) => {
    const token = c.req.param("token");
    const result = await visitor.exchange({
      password: null,
      signals: signalsOf(c.req.raw, c),
      token,
    });
    return finish(c, result, token, false);
  });

  routes.post(SHARE_VISITOR_LINK_PATH, async (c) => {
    const nonce = crypto.randomUUID();
    const request = c.req.raw;
    const origin = request.headers.get("origin");
    const length = Number(request.headers.get("content-length") ?? 0);
    if (
      request.headers.get("sec-fetch-site") === "cross-site" ||
      (origin && origin !== new URL(request.url).origin) ||
      length > MAX_FORM_BYTES
    ) {
      return respond(unavailablePage(nonce), 404, nonce);
    }
    let token = "";
    let password = "";
    try {
      const form = await request.formData();
      const tokenValue = form.get("token");
      const passwordValue = form.get("password");
      token = typeof tokenValue === "string" ? tokenValue : "";
      password = typeof passwordValue === "string" ? passwordValue : "";
    } catch {
      return respond(unavailablePage(nonce), 404, nonce);
    }
    const result = await visitor.exchange({
      password,
      signals: signalsOf(request, c),
      token,
    });
    return finish(c, result, token, true);
  });

  routes.get(`${SHARE_SURFACE_PATH}/:surfaceId`, async (c) => {
    const nonce = crypto.randomUUID();
    const snapshot = await visitor.authorize(
      c.req.param("surfaceId"),
      getCookie(c, SHARE_COOKIE_NAME, "secure"),
    );
    if (!snapshot) {
      // No session, another browser, an ended session and an unknown surface
      // all answer the same.
      return respond(unavailablePage(nonce), 404, nonce);
    }
    const page = surfacePage(snapshot, nonce);
    return respond(page.html, 200, nonce, { frames: page.frames });
  });

  return routes;
}
