import { TAURI_AUTH_CALLBACK_URL } from "@cantiara/auth";
import type { AccountAccessAuth } from "../../../context";

import {
  isTauriAuthCodeChallenge,
  type TauriSessionAccess,
} from "./tauri-session";

const GENERIC_TAURI_SIGN_IN_ERROR = "sign_in_failed";

function isGitHubCallback(request: Request) {
  return new URL(request.url).pathname.endsWith("/callback/github");
}

function isTauriCallbackLocation(location: string, request: Request) {
  try {
    const parsedLocation = new URL(location, request.url);
    const expectedLocation = new URL(TAURI_AUTH_CALLBACK_URL);
    return (
      parsedLocation.protocol === expectedLocation.protocol &&
      parsedLocation.hostname === expectedLocation.hostname &&
      parsedLocation.pathname === expectedLocation.pathname &&
      parsedLocation.port === expectedLocation.port &&
      !parsedLocation.username &&
      !parsedLocation.password
    );
  } catch {
    return false;
  }
}

function createTauriRedirectResponse(response: Response, location: string) {
  const headers = new Headers(response.headers);
  headers.delete("access-control-expose-headers");
  headers.delete("content-length");
  headers.delete("location");
  headers.delete("set-auth-token");
  headers.delete("set-cookie");
  headers.set("location", location);
  return new Response(null, { headers, status: response.status });
}

function createTauriFailureResponse(response: Response) {
  const failureURL = new URL(TAURI_AUTH_CALLBACK_URL);
  failureURL.searchParams.set("error", GENERIC_TAURI_SIGN_IN_ERROR);
  return createTauriRedirectResponse(response, failureURL.href);
}

export async function sanitizeTauriCallbackResponse(
  request: Request,
  response: Response,
  dependencies: {
    auth: AccountAccessAuth;
    tauriSessionAccess: TauriSessionAccess;
  },
) {
  if (!isGitHubCallback(request)) {
    return response;
  }

  const location = response.headers.get("location");
  if (!(location && isTauriCallbackLocation(location, request))) {
    return response;
  }

  const locationURL = new URL(location, request.url);
  if (locationURL.searchParams.has("error")) {
    return createTauriFailureResponse(response);
  }

  const callbackParameters = [...locationURL.searchParams.keys()];
  const codeChallenge = locationURL.searchParams.get("challenge");
  if (
    callbackParameters.length !== 1 ||
    callbackParameters[0] !== "challenge" ||
    !codeChallenge ||
    !isTauriAuthCodeChallenge(codeChallenge)
  ) {
    return createTauriFailureResponse(response);
  }

  const bearerToken = response.headers.get("set-auth-token");
  if (!bearerToken) {
    return createTauriFailureResponse(response);
  }

  try {
    const session = await dependencies.auth.api.getSession({
      headers: { authorization: `Bearer ${bearerToken}` },
      query: { disableRefresh: true },
    });
    if (!session) {
      return createTauriFailureResponse(response);
    }

    const code = await dependencies.tauriSessionAccess.issueCode(
      session.session.id,
      codeChallenge,
    );
    const callbackURL = new URL(TAURI_AUTH_CALLBACK_URL);
    callbackURL.searchParams.set("code", code);
    return createTauriRedirectResponse(response, callbackURL.href);
  } catch {
    return createTauriFailureResponse(response);
  }
}
