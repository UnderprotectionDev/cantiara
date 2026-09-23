import type { ConfirmGitHubIdentityOperationId } from "@cantiara/api/context";

import { client } from "@/utils/orpc";
import { waitForTauriGitHubIdentityGrant } from "./github-identity-grant-events";
import { isTauriRuntime } from "./tauri-session";

const GITHUB_IDENTITY_CONFIRMATION_MESSAGE_TYPE =
  "cantiara.confirm-github-identity";
const BASE64_URL_VALUE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const CONFIRMATION_TIMEOUT_MS = 10 * 60 * 1000;

export function githubIdentityCallbackCode(
  event: Pick<MessageEvent, "data" | "origin" | "source">,
  popup: WindowProxy,
  expectedOrigin: string,
) {
  if (
    event.origin !== expectedOrigin ||
    event.source !== popup ||
    typeof event.data !== "object" ||
    event.data === null ||
    event.data.type !== GITHUB_IDENTITY_CONFIRMATION_MESSAGE_TYPE ||
    typeof event.data.code !== "string" ||
    !BASE64_URL_VALUE_PATTERN.test(event.data.code)
  ) {
    return null;
  }
  return event.data.code;
}

function waitForPopupCode(popup: WindowProxy) {
  return new Promise<string>((resolve, reject) => {
    let settled = false;
    const finish = (result: string | Error) => {
      if (settled) {
        return;
      }
      settled = true;
      window.removeEventListener("message", onMessage);
      window.clearInterval(closeCheck);
      window.clearTimeout(timeout);
      if (result instanceof Error) {
        reject(result);
      } else {
        resolve(result);
      }
    };
    const onMessage = (event: MessageEvent) => {
      const code = githubIdentityCallbackCode(
        event,
        popup,
        window.location.origin,
      );
      if (code) {
        finish(code);
      }
    };
    const closeCheck = window.setInterval(() => {
      if (popup.closed) {
        finish(new Error("GitHub identity confirmation was closed."));
      }
    }, 500);
    const timeout = window.setTimeout(
      () => finish(new Error("GitHub identity confirmation timed out.")),
      CONFIRMATION_TIMEOUT_MS,
    );
    window.addEventListener("message", onMessage);
  });
}

async function requestTauriGitHubIdentityGrant(
  operationId: ConfirmGitHubIdentityOperationId,
) {
  const pendingGrant = waitForTauriGitHubIdentityGrant();
  const grantResult = pendingGrant.promise.catch(() => null);
  try {
    const start = await client.startGitHubIdentityConfirmation({ operationId });
    if (!("authorizationUrl" in start)) {
      throw new Error(
        "Confirm GitHub Identity is waiting because GitHub is unavailable.",
      );
    }
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(start.authorizationUrl);
    const grant = await grantResult;
    if (!grant) {
      throw new Error(
        "GitHub identity confirmation was cancelled or timed out.",
      );
    }
    return grant;
  } catch (error) {
    pendingGrant.cancel();
    throw error;
  }
}

async function requestWebGitHubIdentityGrant(
  operationId: ConfirmGitHubIdentityOperationId,
) {
  const popup = window.open(
    "about:blank",
    "cantiara-confirm-github-identity",
    "popup,width=520,height=680",
  );
  if (!popup) {
    throw new Error("Allow pop-ups to confirm your GitHub identity.");
  }

  const callbackCode = waitForPopupCode(popup).catch(() => null);
  try {
    const start = await client.startGitHubIdentityConfirmation({ operationId });
    if (!("authorizationUrl" in start)) {
      throw new Error(
        "Confirm GitHub Identity is waiting because GitHub is unavailable.",
      );
    }
    popup.location.href = start.authorizationUrl;
    const code = await callbackCode;
    if (!code) {
      throw new Error(
        "GitHub identity confirmation was cancelled or timed out.",
      );
    }
    const { grant } = await client.exchangeGitHubIdentityHandoff({ code });
    return grant;
  } finally {
    popup.close();
  }
}

export function requestGitHubIdentityGrant(
  operationId: ConfirmGitHubIdentityOperationId,
) {
  return isTauriRuntime()
    ? requestTauriGitHubIdentityGrant(operationId)
    : requestWebGitHubIdentityGrant(operationId);
}
