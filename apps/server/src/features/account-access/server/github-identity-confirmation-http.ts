import {
  CONFIRM_GITHUB_IDENTITY_OPERATION_IDS,
  TAURI_CONFIRM_GITHUB_IDENTITY_CALLBACK_URL,
} from "@cantiara/api/context";
import { z } from "zod";
import {
  type AccountAccessAuth,
  requestClientPlatform,
} from "../../../context";
import { noStoreHeaders } from "../../../no-store-headers";
import { requestClientIp } from "./client-ip";
import {
  CONFIRM_GITHUB_IDENTITY_FAILURE_CODE,
  type GitHubIdentityConfirmation,
} from "./github-identity-confirmation";
import type { AccountSessionAccessRuntime } from "./session-access";

export interface GitHubIdentityConfirmationHttpDependencies {
  accountSessionAccess: AccountSessionAccessRuntime;
  auth: AccountAccessAuth;
  githubIdentityConfirmation?: GitHubIdentityConfirmation;
  trustedProxyIps: readonly string[];
}

export interface GitHubIdentityCompletionHttpDependencies
  extends GitHubIdentityConfirmationHttpDependencies {
  corsOrigin: string;
}

const confirmGitHubIdentityStartInputSchema = z.object({
  operationId: z.enum(CONFIRM_GITHUB_IDENTITY_OPERATION_IDS),
});

const confirmGitHubIdentityHandoffInputSchema = z.object({
  code: z.string().min(1).max(512),
});

export function confirmGitHubIdentityFailure(status = 400) {
  return Response.json(
    { code: CONFIRM_GITHUB_IDENTITY_FAILURE_CODE },
    { headers: noStoreHeaders(), status },
  );
}

export function confirmGitHubIdentityCompletionResponse(
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

export async function authorizedPrincipal(
  request: Request,
  dependencies: Pick<
    GitHubIdentityConfirmationHttpDependencies,
    "accountSessionAccess" | "auth"
  >,
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

export async function recordConfirmGitHubIdentityFailure(
  request: Request,
  context: Parameters<typeof requestClientIp>[1],
  dependencies: GitHubIdentityConfirmationHttpDependencies,
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

export async function startConfirmGitHubIdentity(
  request: Request,
  context: Parameters<typeof requestClientIp>[1],
  dependencies: GitHubIdentityConfirmationHttpDependencies,
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

  const startInput = confirmGitHubIdentityStartInputSchema.safeParse(body);
  if (!startInput.success) {
    return confirmGitHubIdentityFailure();
  }
  const { operationId } = startInput.data;

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

export async function exchangeConfirmGitHubIdentityHandoff(
  request: Request,
  context: Parameters<typeof requestClientIp>[1],
  dependencies: GitHubIdentityConfirmationHttpDependencies,
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

  const handoffInput = confirmGitHubIdentityHandoffInputSchema.safeParse(body);
  if (!handoffInput.success) {
    return confirmGitHubIdentityFailure();
  }
  const { code } = handoffInput.data;

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

export async function completeConfirmGitHubIdentity(
  request: Request,
  context: Parameters<typeof requestClientIp>[1],
  dependencies: GitHubIdentityCompletionHttpDependencies,
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
