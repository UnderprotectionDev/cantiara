import type { AccountPreferencesAccess } from "@cantiara/api/account-preferences";
import {
  CONFIRM_GITHUB_IDENTITY_HANDOFF_EXCHANGE_PATH,
  TAURI_CONFIRM_GITHUB_IDENTITY_CALLBACK_URL,
} from "@cantiara/api/context";
import { appRouter } from "@cantiara/api/routers/index";
import { SUPPORT_REFERENCE_HEADER } from "@cantiara/api/support-reference";
import { TAURI_AUTH_CALLBACK_URL } from "@cantiara/auth";
import type { Database } from "@cantiara/db";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { experimental_RethrowHandlerPlugin } from "@orpc/server/plugins";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import {
  type BetterAuthInstance,
  createAuthMiddleware,
} from "evlog/better-auth";
import { createFsDrain } from "evlog/fs";
import { type EvlogVariables, evlog } from "evlog/hono";
import type { Context as HonoContext } from "hono";
import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  type AccountAccessAuth,
  createContext,
  requestClientPlatform,
} from "./context";
import { requestClientIp } from "./features/account-access/server/client-ip";
import { createCsrfProtectionMiddleware } from "./features/account-access/server/csrf-protection";
import type { GitHubAvailability } from "./features/account-access/server/github-availability";
import { sanitizeGitHubCallbackResponse } from "./features/account-access/server/github-callback-response";
import {
  CONFIRM_GITHUB_IDENTITY_CALLBACK_PATH,
  CONFIRM_GITHUB_IDENTITY_FAILURE_CODE,
  CONFIRM_GITHUB_IDENTITY_START_PATH,
  type GitHubIdentityConfirmation,
  isConfirmGitHubIdentityOperationId,
} from "./features/account-access/server/github-identity-confirmation";
import type { AccountSessionAccessRuntime } from "./features/account-access/server/session-access";
import { sanitizeProductSessionResponse } from "./features/account-access/server/session-response";
import { sanitizeTauriCallbackResponse } from "./features/account-access/server/tauri-callback-response";
import {
  isTauriAuthCodeChallenge,
  isTauriAuthCodeVerifier,
  type TauriSessionAccess,
} from "./features/account-access/server/tauri-session";
import {
  createSupportFailureResponse,
  createSupportReferenceFailure,
  decorateSupportFailureResponse,
  recordSupportFailure,
} from "./features/web-macos-client/server/support-reference";

export interface AppDependencies {
  accountPreferences: AccountPreferencesAccess;
  accountSessionAccess: AccountSessionAccessRuntime;
  auth: AccountAccessAuth;
  corsOrigin: string;
  database: Database;
  desktopOrigins: readonly string[];
  githubAvailability: Pick<
    GitHubAvailability,
    "getStatus" | "requiresFreshConsent"
  >;
  githubIdentityConfirmation?: GitHubIdentityConfirmation;
  nodeEnv: string;
  redactSecrets: (value: unknown) => unknown;
  tauriSessionAccess?: TauriSessionAccess;
  trustedProxyIps: readonly string[];
}

function isRecoverableAuthPath(path: string) {
  const authPath = path.startsWith("/api/auth/")
    ? path.slice("/api/auth".length)
    : path;
  return authPath === "/sign-out" || authPath.startsWith("/sign-in/");
}

async function createTauriSignInStartResponse(
  request: Request,
  dependencies: {
    auth: AccountAccessAuth;
    tauriSessionAccess: TauriSessionAccess | undefined;
  },
) {
  const codeChallenge = new URL(request.url).searchParams.get("code_challenge");
  if (
    !(
      dependencies.tauriSessionAccess &&
      codeChallenge &&
      isTauriAuthCodeChallenge(codeChallenge)
    )
  ) {
    const errorURL = new URL(TAURI_AUTH_CALLBACK_URL);
    errorURL.searchParams.set("error", "sign_in_failed");
    return Response.redirect(errorURL.href, 302);
  }

  const callbackURL = new URL(TAURI_AUTH_CALLBACK_URL);
  callbackURL.searchParams.set("challenge", codeChallenge);

  const authRequestHeaders = new Headers();
  for (const header of ["user-agent", "x-forwarded-for"]) {
    const value = request.headers.get(header);
    if (value) {
      authRequestHeaders.set(header, value);
    }
  }
  authRequestHeaders.set("content-type", "application/json");

  const response = await dependencies.auth.handler(
    new Request(new URL("/api/auth/sign-in/social", request.url).href, {
      body: JSON.stringify({
        callbackURL: callbackURL.href,
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

  const codeVerifier =
    typeof body === "object" && body !== null && "codeVerifier" in body
      ? body.codeVerifier
      : undefined;
  if (
    typeof codeVerifier !== "string" ||
    !isTauriAuthCodeVerifier(codeVerifier)
  ) {
    return Response.json({ code: "UNAUTHORIZED" }, { status: 401 });
  }

  const session = await tauriSessionAccess?.exchangeCode(code, codeVerifier);
  if (!session) {
    return Response.json({ code: "UNAUTHORIZED" }, { status: 401 });
  }

  return Response.json({
    expiresAt: session.expiresAt.toISOString(),
    token: session.token,
  });
}

function noStoreHeaders() {
  return {
    "cache-control": "no-store",
    pragma: "no-cache",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
  };
}

function confirmGitHubIdentityFailure(status = 400) {
  return Response.json(
    { code: CONFIRM_GITHUB_IDENTITY_FAILURE_CODE },
    { headers: noStoreHeaders(), status },
  );
}

function confirmGitHubIdentityCompletionResponse(
  completion: {
    callbackCode: string;
    clientPlatform: "web" | "tauri";
  },
  corsOrigin: string,
) {
  if (completion.clientPlatform === "tauri") {
    const callbackURL = new URL(TAURI_CONFIRM_GITHUB_IDENTITY_CALLBACK_URL);
    callbackURL.searchParams.set("code", completion.callbackCode);
    return new Response(null, {
      headers: {
        ...noStoreHeaders(),
        location: callbackURL.href,
      },
      status: 302,
    });
  }

  let targetOrigin: string;
  try {
    targetOrigin = new URL(corsOrigin).origin;
  } catch {
    return confirmGitHubIdentityFailure();
  }

  const message = JSON.stringify({
    code: completion.callbackCode,
    type: "cantiara.confirm-github-identity",
  });
  const serializedTargetOrigin = JSON.stringify(targetOrigin);
  const body = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="referrer" content="no-referrer">
    <title>Confirm GitHub Identity</title>
  </head>
  <body>
    <p>Confirm GitHub Identity complete. You can return to Cantiara.</p>
    <script>
      const message = ${message};
      const targetOrigin = ${serializedTargetOrigin};
      if (window.opener) {
        window.opener.postMessage(message, targetOrigin);
        window.close();
      }
    </script>
  </body>
</html>`;
  return new Response(body, {
    headers: {
      ...noStoreHeaders(),
      "content-security-policy":
        "default-src 'none'; script-src 'unsafe-inline'",
      "content-type": "text/html; charset=UTF-8",
    },
  });
}

async function authorizedPrincipal(
  request: Request,
  dependencies: Pick<AppDependencies, "accountSessionAccess" | "auth">,
) {
  const session = await dependencies.auth.api.getSession({
    headers: request.headers,
    query: { disableRefresh: true },
  });
  if (!session) {
    return null;
  }

  const principal = {
    accountId: session.user.id,
    sessionId: session.session.id,
  };
  return (await dependencies.accountSessionAccess.authorizeWrite(principal))
    ? principal
    : null;
}

async function recordConfirmGitHubIdentityFailure(
  request: Request,
  context: Parameters<typeof requestClientIp>[1],
  dependencies: Pick<
    AppDependencies,
    | "accountSessionAccess"
    | "auth"
    | "githubIdentityConfirmation"
    | "trustedProxyIps"
  >,
  state: string | null,
) {
  const confirmation = dependencies.githubIdentityConfirmation;
  if (!confirmation) {
    return;
  }

  let principal: Awaited<ReturnType<typeof authorizedPrincipal>> = null;
  try {
    principal = await authorizedPrincipal(request, dependencies);
  } catch {
    // A state-bound callback can still be recorded when the browser session is absent.
  }
  try {
    await confirmation.recordFailure(
      principal,
      state ?? undefined,
      requestClientIp(request, context, dependencies.trustedProxyIps),
    );
  } catch {
    // Callback failures stay generic even when session or audit storage is unavailable.
  }
}

async function startConfirmGitHubIdentity(
  request: Request,
  context: Parameters<typeof requestClientIp>[1],
  dependencies: Pick<
    AppDependencies,
    | "accountSessionAccess"
    | "auth"
    | "githubIdentityConfirmation"
    | "trustedProxyIps"
  >,
) {
  if (!dependencies.githubIdentityConfirmation) {
    return confirmGitHubIdentityFailure(404);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return confirmGitHubIdentityFailure();
  }

  const operationId =
    typeof body === "object" && body !== null && "operationId" in body
      ? body.operationId
      : undefined;
  if (!isConfirmGitHubIdentityOperationId(operationId)) {
    return confirmGitHubIdentityFailure();
  }

  let principal: Awaited<ReturnType<typeof authorizedPrincipal>>;
  try {
    principal = await authorizedPrincipal(request, dependencies);
  } catch {
    return confirmGitHubIdentityFailure(401);
  }
  if (!principal) {
    return confirmGitHubIdentityFailure(401);
  }

  try {
    const result = await dependencies.githubIdentityConfirmation.start(
      principal,
      operationId,
      requestClientIp(request, context, dependencies.trustedProxyIps),
      requestClientPlatform(request),
    );
    return result
      ? Response.json(result, { headers: noStoreHeaders() })
      : confirmGitHubIdentityFailure();
  } catch {
    return confirmGitHubIdentityFailure();
  }
}

async function exchangeConfirmGitHubIdentityHandoff(
  request: Request,
  context: Parameters<typeof requestClientIp>[1],
  dependencies: Pick<
    AppDependencies,
    | "accountSessionAccess"
    | "auth"
    | "githubIdentityConfirmation"
    | "trustedProxyIps"
  >,
) {
  if (!dependencies.githubIdentityConfirmation) {
    return confirmGitHubIdentityFailure(404);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return confirmGitHubIdentityFailure();
  }

  const code =
    typeof body === "object" && body !== null && "code" in body
      ? body.code
      : undefined;
  if (typeof code !== "string" || code.length === 0 || code.length > 512) {
    return confirmGitHubIdentityFailure();
  }

  let principal: Awaited<ReturnType<typeof authorizedPrincipal>>;
  try {
    principal = await authorizedPrincipal(request, dependencies);
  } catch {
    return confirmGitHubIdentityFailure(401);
  }
  if (!principal) {
    return confirmGitHubIdentityFailure(401);
  }

  try {
    const grant = await dependencies.githubIdentityConfirmation.exchange(
      principal,
      code,
      requestClientIp(request, context, dependencies.trustedProxyIps),
    );
    return grant
      ? Response.json({ grant }, { headers: noStoreHeaders() })
      : confirmGitHubIdentityFailure();
  } catch {
    return confirmGitHubIdentityFailure();
  }
}

async function completeConfirmGitHubIdentity(
  request: Request,
  context: Parameters<typeof requestClientIp>[1],
  dependencies: Pick<
    AppDependencies,
    | "accountSessionAccess"
    | "auth"
    | "corsOrigin"
    | "githubIdentityConfirmation"
    | "trustedProxyIps"
  >,
) {
  if (!dependencies.githubIdentityConfirmation) {
    return confirmGitHubIdentityFailure(404);
  }

  const callbackURL = new URL(request.url);
  const code = callbackURL.searchParams.get("code");
  const state = callbackURL.searchParams.get("state");
  if (
    callbackURL.searchParams.has("error") ||
    !code ||
    !state ||
    code.length > 512
  ) {
    await recordConfirmGitHubIdentityFailure(
      request,
      context,
      dependencies,
      state,
    );
    return confirmGitHubIdentityFailure();
  }

  try {
    const completion = await dependencies.githubIdentityConfirmation.complete(
      null,
      { code, state },
      requestClientIp(request, context, dependencies.trustedProxyIps),
    );
    return completion
      ? confirmGitHubIdentityCompletionResponse(
          completion,
          dependencies.corsOrigin,
        )
      : confirmGitHubIdentityFailure();
  } catch {
    return confirmGitHubIdentityFailure();
  }
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

function requestSupportReferenceId(
  context: HonoContext<EvlogVariables>,
): string | undefined {
  const { requestId } = context.get("log").getContext();
  return typeof requestId === "string" ? requestId : undefined;
}

async function decorateAndRecordSupportFailure(
  context: HonoContext<EvlogVariables>,
  response: Response,
  error?: unknown,
) {
  const requestId = requestSupportReferenceId(context);
  const decorated = await decorateSupportFailureResponse(response, {
    error,
    requestId,
  });

  if (decorated.status >= 400) {
    let payload: unknown;
    try {
      payload = await decorated.clone().json();
    } catch {
      payload = undefined;
    }
    const failure = createSupportReferenceFailure({
      error: payload,
      requestId,
      supportReference:
        decorated.headers.get(SUPPORT_REFERENCE_HEADER) ?? undefined,
    });
    recordSupportFailure(context.get("log"), failure);
  }

  return decorated;
}

function errorStatus(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number" &&
    error.status >= 400 &&
    error.status <= 599
  ) {
    return error.status;
  }
  return 500;
}

function isClientShellPath(path: string) {
  return path === "/rpc" || path.startsWith("/rpc/");
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

  app.use("*", async (c, next) => {
    c.req.raw.headers.delete("x-request-id");
    await next();
  });
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
    createTauriSignInStartResponse(c.req.raw, {
      auth: dependencies.auth,
      tauriSessionAccess: dependencies.tauriSessionAccess,
    }),
  );
  app.post("/api/auth/tauri/exchange", (c) =>
    exchangeTauriCode(c.req.raw, dependencies.tauriSessionAccess),
  );
  app.post(CONFIRM_GITHUB_IDENTITY_START_PATH, (c) =>
    startConfirmGitHubIdentity(c.req.raw, c, dependencies),
  );
  app.post(CONFIRM_GITHUB_IDENTITY_HANDOFF_EXCHANGE_PATH, (c) =>
    exchangeConfirmGitHubIdentityHandoff(c.req.raw, c, dependencies),
  );
  app.get(CONFIRM_GITHUB_IDENTITY_CALLBACK_PATH, (c) =>
    completeConfirmGitHubIdentity(c.req.raw, c, dependencies),
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
    const authRequest = await addFreshGitHubConsent(
      c.req.raw,
      dependencies.githubAvailability,
    );
    const response = await dependencies.auth.handler(authRequest);
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
      new experimental_RethrowHandlerPlugin({ filter: () => true }),
    ],
    interceptors: [onError(() => undefined)],
  });
  const rpcHandler = new RPCHandler(appRouter, {
    plugins: [new experimental_RethrowHandlerPlugin({ filter: () => true })],
    interceptors: [onError(() => undefined)],
  });

  app.use("/*", async (c, next) => {
    const context = await createContext({
      accountSessionAccess: dependencies.accountSessionAccess,
      accountPreferences: dependencies.accountPreferences,
      auth: dependencies.auth,
      context: c,
      database: dependencies.database,
      githubAvailability: dependencies.githubAvailability,
      githubIdentityConfirmation: dependencies.githubIdentityConfirmation,
      trustedProxyIps: dependencies.trustedProxyIps,
    });
    const rpcResult = await rpcHandler.handle(c.req.raw, {
      prefix: "/rpc",
      context,
    });
    if (rpcResult.matched) {
      const response = await decorateAndRecordSupportFailure(
        c,
        rpcResult.response,
      );
      return c.newResponse(response.body, response);
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
  app.notFound((c) => {
    if (c.req.path !== "/rpc" && !c.req.path.startsWith("/rpc/")) {
      return c.text("404 Not Found", 404);
    }

    const requestId = requestSupportReferenceId(c);
    const failure = createSupportReferenceFailure({
      error: { code: "NOT_FOUND", message: "Not Found", status: 404 },
      requestId,
      writeOutcome: "not-written",
    });
    recordSupportFailure(c.get("log"), failure);
    return createSupportFailureResponse({
      error: failure,
      reasonCode: failure.reasonCode,
      requestId,
      retryPolicy: failure.retryPolicy,
      supportReference: failure.supportReference,
      status: 404,
      writeOutcome: failure.writeOutcome,
    });
  });
  app.onError((error, c) => {
    if (!isClientShellPath(c.req.path)) {
      c.error = undefined;
      return new Response("Internal Server Error", {
        status: errorStatus(error),
      });
    }

    const requestId = requestSupportReferenceId(c);
    const failure = createSupportReferenceFailure({ error, requestId });
    recordSupportFailure(c.get("log"), failure);
    c.error = undefined;
    return createSupportFailureResponse({
      error: failure,
      reasonCode: failure.reasonCode,
      requestId,
      retryPolicy: failure.retryPolicy,
      supportReference: failure.supportReference,
      writeOutcome: failure.writeOutcome,
      status: errorStatus(error),
    });
  });
  return app;
}
