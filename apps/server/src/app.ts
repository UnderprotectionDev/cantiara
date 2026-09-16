import { appRouter } from "@cantiara/api/routers/index";
import { TAURI_AUTH_CALLBACK_URL } from "@cantiara/auth";
import type { Database } from "@cantiara/db";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import {
  type BetterAuthInstance,
  createAuthMiddleware,
} from "evlog/better-auth";
import { createFsDrain } from "evlog/fs";
import { type EvlogVariables, evlog } from "evlog/hono";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { type AccountAccessAuth, createContext } from "./context";
import { createCsrfProtectionMiddleware } from "./features/account-access/server/csrf-protection";
import { sanitizeGitHubCallbackResponse } from "./features/account-access/server/github-callback-response";
import type { AccountSessionAccessRuntime } from "./features/account-access/server/session-access";
import { sanitizeProductSessionResponse } from "./features/account-access/server/session-response";
import { sanitizeTauriCallbackResponse } from "./features/account-access/server/tauri-callback-response";
import type { TauriSessionAccess } from "./features/account-access/server/tauri-session";

export interface AppDependencies {
  accountSessionAccess: AccountSessionAccessRuntime;
  auth: AccountAccessAuth;
  corsOrigin: string;
  database: Database;
  desktopOrigins: readonly string[];
  nodeEnv: string;
  redactSecrets: (value: unknown) => unknown;
  tauriSessionAccess?: TauriSessionAccess;
}

function isRecoverableAuthPath(path: string) {
  const authPath = path.startsWith("/api/auth/")
    ? path.slice("/api/auth".length)
    : path;
  return authPath === "/sign-out" || authPath.startsWith("/sign-in/");
}

async function createTauriSignInStartResponse(
  request: Request,
  auth: AccountAccessAuth,
) {
  const authRequestHeaders = new Headers();
  for (const header of ["user-agent", "x-forwarded-for"]) {
    const value = request.headers.get(header);
    if (value) {
      authRequestHeaders.set(header, value);
    }
  }
  authRequestHeaders.set("content-type", "application/json");

  const response = await auth.handler(
    new Request(new URL("/api/auth/sign-in/social", request.url).href, {
      body: JSON.stringify({
        callbackURL: TAURI_AUTH_CALLBACK_URL,
        errorCallbackURL: TAURI_AUTH_CALLBACK_URL,
        provider: "github",
      }),
      headers: authRequestHeaders,
      method: "POST",
    }),
  );
  const location = response.headers.get("location");
  if (!location) {
    const errorURL = new URL(TAURI_AUTH_CALLBACK_URL);
    errorURL.searchParams.set("error", "sign_in_failed");
    return Response.redirect(errorURL.href, 302);
  }

  const headers = new Headers({ location });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) {
    headers.set("set-cookie", setCookie);
  }
  return new Response(null, { headers, status: 302 });
}

async function exchangeTauriCode(
  request: Request,
  tauriSessionAccess: TauriSessionAccess | undefined,
) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ code: "UNAUTHORIZED" }, { status: 401 });
  }

  const code =
    typeof body === "object" && body !== null && "code" in body
      ? body.code
      : undefined;
  if (typeof code !== "string" || code.length === 0 || code.length > 512) {
    return Response.json({ code: "UNAUTHORIZED" }, { status: 401 });
  }

  const session = await tauriSessionAccess?.exchangeCode(code);
  if (!session) {
    return Response.json({ code: "UNAUTHORIZED" }, { status: 401 });
  }

  return Response.json({
    expiresAt: session.expiresAt.toISOString(),
    token: session.token,
  });
}

export function createApp(dependencies: AppDependencies) {
  const identifyUser = createAuthMiddleware(
    dependencies.auth as unknown as BetterAuthInstance,
    {
      exclude: ["/api/auth/**"],
      maskEmail: true,
    },
  );
  const allowedOrigins = [
    dependencies.corsOrigin,
    ...dependencies.desktopOrigins,
  ];
  const app = new Hono<EvlogVariables>();

  app.use(
    evlog({
      drain:
        dependencies.nodeEnv === "production" ? undefined : createFsDrain(),
    }),
  );
  app.use("*", async (c, next) => {
    await identifyUser(c.get("log"), c.req.raw.headers, c.req.path);
    await next();
  });
  app.use(
    "/*",
    cors({
      origin: allowedOrigins,
      allowMethods: ["GET", "POST", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    }),
  );
  app.use("*", createCsrfProtectionMiddleware(allowedOrigins));

  app.get("/api/auth/tauri/start", (c) =>
    createTauriSignInStartResponse(c.req.raw, dependencies.auth),
  );
  app.post("/api/auth/tauri/exchange", (c) =>
    exchangeTauriCode(c.req.raw, dependencies.tauriSessionAccess),
  );

  app.on(["POST", "GET"], "/api/auth/*", async (c) => {
    const candidateSession = await dependencies.auth.api.getSession({
      headers: c.req.raw.headers,
      query: { disableRefresh: true },
    });
    if (
      candidateSession &&
      !isRecoverableAuthPath(c.req.path) &&
      !(await dependencies.accountSessionAccess.authorizeWrite({
        accountId: candidateSession.user.id,
        sessionId: candidateSession.session.id,
      }))
    ) {
      if (c.req.path.endsWith("/get-session")) {
        return c.json(null);
      }
      return c.json({ code: "UNAUTHORIZED" }, 401);
    }
    const response = await dependencies.auth.handler(c.req.raw);
    const tauriResponse = dependencies.tauriSessionAccess
      ? await sanitizeTauriCallbackResponse(c.req.raw, response, {
          auth: dependencies.auth,
          tauriSessionAccess: dependencies.tauriSessionAccess,
        })
      : response;
    const sessionResponse = await sanitizeProductSessionResponse(
      c.req.raw,
      tauriResponse,
    );
    return tauriResponse === response
      ? sanitizeGitHubCallbackResponse(
          c.req.raw,
          sessionResponse,
          dependencies.corsOrigin,
        )
      : sessionResponse;
  });

  const apiHandler = new OpenAPIHandler(appRouter, {
    plugins: [
      new OpenAPIReferencePlugin({
        schemaConverters: [new ZodToJsonSchemaConverter()],
      }),
    ],
    interceptors: [
      onError((error) => {
        console.error(dependencies.redactSecrets(error));
      }),
    ],
  });
  const rpcHandler = new RPCHandler(appRouter, {
    interceptors: [
      onError((error) => {
        console.error(dependencies.redactSecrets(error));
      }),
    ],
  });

  app.use("/*", async (c, next) => {
    const context = await createContext({
      accountSessionAccess: dependencies.accountSessionAccess,
      auth: dependencies.auth,
      context: c,
      database: dependencies.database,
    });
    const rpcResult = await rpcHandler.handle(c.req.raw, {
      prefix: "/rpc",
      context,
    });
    if (rpcResult.matched) {
      return c.newResponse(rpcResult.response.body, rpcResult.response);
    }
    const apiResult = await apiHandler.handle(c.req.raw, {
      prefix: "/api-reference",
      context,
    });
    if (apiResult.matched) {
      return c.newResponse(apiResult.response.body, apiResult.response);
    }
    await next();
  });

  app.get("/", (c) => c.text("OK"));
  return app;
}
