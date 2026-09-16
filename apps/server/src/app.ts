import { appRouter } from "@cantiara/api/routers/index";
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
import type { GitHubAvailability } from "./features/account-access/server/github-availability";
import { sanitizeGitHubCallbackResponse } from "./features/account-access/server/github-callback-response";
import type { AccountSessionAccessRuntime } from "./features/account-access/server/session-access";
import { sanitizeProductSessionResponse } from "./features/account-access/server/session-response";

export interface AppDependencies {
  accountSessionAccess: AccountSessionAccessRuntime;
  auth: AccountAccessAuth;
  corsOrigin: string;
  database: Database;
  desktopOrigins: readonly string[];
  githubAvailability: Pick<
    GitHubAvailability,
    "getStatus" | "requiresFreshConsent"
  >;
  nodeEnv: string;
  redactSecrets: (value: unknown) => unknown;
}

function isRecoverableAuthPath(path: string) {
  const authPath = path.startsWith("/api/auth/")
    ? path.slice("/api/auth".length)
    : path;
  return authPath === "/sign-out" || authPath.startsWith("/sign-in/");
}

async function addFreshGitHubConsent(
  request: Request,
  githubAvailability: AppDependencies["githubAvailability"],
) {
  if (
    request.method !== "POST" ||
    new URL(request.url).pathname !== "/api/auth/sign-in/social" ||
    !githubAvailability.requiresFreshConsent()
  ) {
    return request;
  }

  try {
    const body = (await request.clone().json()) as {
      additionalParams?: Record<string, string>;
      provider?: unknown;
      [key: string]: unknown;
    };
    if (body.provider !== "github") {
      return request;
    }

    const headers = new Headers(request.headers);
    headers.delete("content-length");
    return new Request(request, {
      body: JSON.stringify({
        ...body,
        additionalParams: {
          ...body.additionalParams,
          prompt: "consent",
        },
      }),
      headers,
    });
  } catch {
    return request;
  }
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
    const authRequest = await addFreshGitHubConsent(
      c.req.raw,
      dependencies.githubAvailability,
    );
    const response = await dependencies.auth.handler(authRequest);
    const sessionResponse = await sanitizeProductSessionResponse(
      c.req.raw,
      response,
    );
    return sanitizeGitHubCallbackResponse(
      c.req.raw,
      sessionResponse,
      dependencies.corsOrigin,
    );
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
      githubAvailability: dependencies.githubAvailability,
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
