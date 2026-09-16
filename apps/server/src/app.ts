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
import { sanitizeGitHubCallbackResponse } from "./features/account-access/server/github-callback-response";
import type { AccountSessionAccessRuntime } from "./features/account-access/server/session-access";
import { sanitizeProductSessionResponse } from "./features/account-access/server/session-response";

export interface AppDependencies {
  accountSessionAccess: AccountSessionAccessRuntime;
  auth: AccountAccessAuth;
  corsOrigin: string;
  database: Database;
  desktopOrigins: readonly string[];
  nodeEnv: string;
  redactSecrets: (value: unknown) => unknown;
  replaySessionRevocations: () => Promise<void>;
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
  app.use("*", async (_c, next) => {
    await dependencies.replaySessionRevocations();
    await next();
  });

  app.on(["POST", "GET"], "/api/auth/*", async (c) => {
    const candidateSession = await dependencies.auth.api.getSession({
      headers: c.req.raw.headers,
      query: { disableRefresh: true },
    });
    if (
      candidateSession &&
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
