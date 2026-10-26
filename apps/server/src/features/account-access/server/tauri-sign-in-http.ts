import { TAURI_AUTH_CALLBACK_URL } from "@cantiara/auth";
import { z } from "zod";
import type { AccountAccessAuth } from "../../../context";
import {
  isTauriAuthCodeChallenge,
  isTauriAuthCodeVerifier,
  type TauriSessionAccess,
} from "./tauri-session";

export async function createTauriSignInStartResponse(
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

const tauriCodeExchangeInputSchema = z.object({
  code: z.string().min(1).max(512),
  codeVerifier: z.string().refine(isTauriAuthCodeVerifier),
});

export async function exchangeTauriCode(
  request: Request,
  tauriSessionAccess: TauriSessionAccess | undefined,
) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ code: "UNAUTHORIZED" }, { status: 401 });
  }

  const input = tauriCodeExchangeInputSchema.safeParse(body);
  if (!input.success) {
    return Response.json({ code: "UNAUTHORIZED" }, { status: 401 });
  }
  const { code, codeVerifier } = input.data;

  const session = await tauriSessionAccess?.exchangeCode(code, codeVerifier);
  if (!session) {
    return Response.json({ code: "UNAUTHORIZED" }, { status: 401 });
  }

  return Response.json({
    expiresAt: session.expiresAt.toISOString(),
    token: session.token,
  });
}
