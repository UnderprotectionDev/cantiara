import { TAURI_AUTH_CALLBACK_URL } from "@cantiara/auth";
import { describe, expect, test } from "vitest";
import { sanitizeTauriCallbackResponse } from "./tauri-callback-response";

const callbackRequest = new Request(
  "https://api.cantiara.example/api/auth/callback/github",
);
const CODE_CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

describe("Account Access Tauri callback", () => {
  test("redirects with only a one-time code and strips the bearer response headers", async () => {
    const response = await sanitizeTauriCallbackResponse(
      callbackRequest,
      new Response(null, {
        headers: {
          location: `${TAURI_AUTH_CALLBACK_URL}?challenge=${CODE_CHALLENGE}`,
          "set-auth-token": "signed-session-token",
          "set-cookie": "__Secure-better-auth.session_token=secret",
        },
        status: 302,
      }),
      {
        auth: {
          api: {
            getSession: async () => ({
              session: { id: "session-1" },
              user: { id: "account-1" },
            }),
          },
        } as never,
        tauriSessionAccess: {
          exchangeCode: async () => null,
          issueCode: (_sessionId, codeChallenge) => {
            expect(codeChallenge).toBe(CODE_CHALLENGE);
            return Promise.resolve("one-time-code");
          },
        },
      },
    );

    const location = response.headers.get("location");
    expect(location).toBe(`${TAURI_AUTH_CALLBACK_URL}?code=one-time-code`);
    expect(location).not.toContain("token");
    expect(response.headers.get("set-auth-token")).toBeNull();
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  test("maps a callback failure to a generic deep-link error without returning a token", async () => {
    const response = await sanitizeTauriCallbackResponse(
      callbackRequest,
      new Response(null, {
        headers: {
          location: `${TAURI_AUTH_CALLBACK_URL}?error=access_denied&error_description=secret-detail`,
          "set-auth-token": "must-not-escape",
        },
        status: 302,
      }),
      {
        auth: {
          api: { getSession: async () => null },
        } as never,
        tauriSessionAccess: {
          exchangeCode: async () => null,
          issueCode: async () => "unused",
        },
      },
    );

    expect(response.headers.get("location")).toBe(
      `${TAURI_AUTH_CALLBACK_URL}?error=sign_in_failed`,
    );
    expect(response.headers.get("location")).not.toContain("must-not-escape");
    expect(response.headers.get("set-auth-token")).toBeNull();
  });

  test("does not mint a code when the callback is missing the app challenge", async () => {
    let issueCalls = 0;
    const response = await sanitizeTauriCallbackResponse(
      callbackRequest,
      new Response(null, {
        headers: {
          location: TAURI_AUTH_CALLBACK_URL,
          "set-auth-token": "must-not-escape",
        },
        status: 302,
      }),
      {
        auth: {
          api: {
            getSession: async () => ({
              session: { id: "session-1" },
              user: { id: "account-1" },
            }),
          },
        } as never,
        tauriSessionAccess: {
          exchangeCode: async () => null,
          issueCode: () => {
            issueCalls += 1;
            return Promise.resolve("unused");
          },
        },
      },
    );

    expect(response.headers.get("location")).toBe(
      `${TAURI_AUTH_CALLBACK_URL}?error=sign_in_failed`,
    );
    expect(issueCalls).toBe(0);
  });

  test("leaves web callbacks on the existing response path", async () => {
    const response = Response.redirect(
      "https://cantiara.example/dashboard",
      302,
    );

    await expect(
      sanitizeTauriCallbackResponse(callbackRequest, response, {
        auth: { api: { getSession: async () => null } } as never,
        tauriSessionAccess: {
          exchangeCode: async () => null,
          issueCode: async () => "unused",
        },
      }),
    ).resolves.toBe(response);
  });
});
