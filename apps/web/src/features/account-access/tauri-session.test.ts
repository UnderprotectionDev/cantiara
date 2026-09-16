import { TAURI_CONFIRM_GITHUB_IDENTITY_CALLBACK_URL } from "@cantiara/api/context";
import { describe, expect, test, vi } from "vitest";

const tauriMocks = vi.hoisted(() => ({
  appDataDir: vi.fn(),
  invoke: vi.fn(),
  openUrl: vi.fn(),
  strongholdLoad: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: tauriMocks.invoke }));
vi.mock("@tauri-apps/api/path", () => ({
  appDataDir: tauriMocks.appDataDir,
}));
vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: tauriMocks.openUrl,
}));
vi.mock("@tauri-apps/plugin-stronghold", () => ({
  Stronghold: { load: tauriMocks.strongholdLoad },
}));

import {
  createTauriAuthCodeChallenge,
  createTauriBearerHeaders,
  exchangeTauriAuthCode,
  exchangeTauriGitHubIdentityHandoff,
  openTauriGitHubSignIn,
  parseTauriAuthCallback,
  parseTauriGitHubIdentityConfirmationCallback,
  TAURI_AUTH_CALLBACK_URL,
} from "./tauri-session";

const CODE_VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";

describe("Account Access Tauri session", () => {
  test("accepts only the expected one-time code deep link", () => {
    expect(
      parseTauriAuthCallback(`${TAURI_AUTH_CALLBACK_URL}?code=one-time-code`),
    ).toEqual({ code: "one-time-code" });
    expect(
      parseTauriAuthCallback(
        `${TAURI_AUTH_CALLBACK_URL}?code=one-time-code&token=secret`,
      ),
    ).toBeNull();
    expect(
      parseTauriAuthCallback(`${TAURI_AUTH_CALLBACK_URL}?access_token=secret`),
    ).toBeNull();
    expect(
      parseTauriAuthCallback("cantiara://other/callback?code=one-time-code"),
    ).toBeNull();
  });

  test("exchanges the code and stores the returned bearer in the protected token store", async () => {
    const requests: Request[] = [];
    let storedToken: string | undefined;
    let clearedCodeVerifier = false;
    await exchangeTauriAuthCode("one-time-code", {
      fetch: (input, init) => {
        requests.push(new Request(input, init));
        return Promise.resolve(
          Response.json({
            expiresAt: "2026-10-16T09:00:00.000Z",
            token: "bearer-session-token",
          }),
        );
      },
      serverURL: "https://api.cantiara.example",
      tokenStore: {
        clearCodeVerifier: () => {
          clearedCodeVerifier = true;
          return Promise.resolve();
        },
        read: () => Promise.resolve(storedToken ?? null),
        readCodeVerifier: () => Promise.resolve(CODE_VERIFIER),
        write: (token) => {
          storedToken = token;
          return Promise.resolve();
        },
        writeCodeVerifier: () => Promise.resolve(),
      },
    });

    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe(
      "https://api.cantiara.example/api/auth/tauri/exchange",
    );
    await expect(requests[0]?.json()).resolves.toEqual({
      code: "one-time-code",
      codeVerifier: CODE_VERIFIER,
    });
    expect(storedToken).toBe("bearer-session-token");
    expect(clearedCodeVerifier).toBe(true);
  });

  test("accepts only the confirmation code deep link and exchanges it with the stored bearer", async () => {
    expect(
      parseTauriGitHubIdentityConfirmationCallback(
        `${TAURI_CONFIRM_GITHUB_IDENTITY_CALLBACK_URL}?code=${"H".repeat(43)}`,
      ),
    ).toEqual({ code: "H".repeat(43) });
    expect(
      parseTauriGitHubIdentityConfirmationCallback(
        `${TAURI_CONFIRM_GITHUB_IDENTITY_CALLBACK_URL}?code=${"H".repeat(43)}&grant=secret`,
      ),
    ).toBeNull();
    expect(
      parseTauriGitHubIdentityConfirmationCallback(
        `${TAURI_AUTH_CALLBACK_URL}?code=${"H".repeat(43)}`,
      ),
    ).toBeNull();

    const requests: Request[] = [];
    await expect(
      exchangeTauriGitHubIdentityHandoff("H".repeat(43), {
        fetch: (input, init) => {
          requests.push(new Request(input, init));
          return Promise.resolve(Response.json({ grant: "G".repeat(43) }));
        },
        readToken: () => Promise.resolve("bearer-session-token"),
        serverURL: "https://api.cantiara.example",
      }),
    ).resolves.toBe("G".repeat(43));

    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe(
      "https://api.cantiara.example/api/auth/confirm-github-identity/exchange",
    );
    expect(requests[0]?.headers.get("authorization")).toBe(
      "Bearer bearer-session-token",
    );
    await expect(requests[0]?.json()).resolves.toEqual({
      code: "H".repeat(43),
    });
  });

  test("stores an app verifier before opening the system browser", async () => {
    const insertedValues: Array<{ key: string; value: number[] }> = [];
    const store = {
      get: vi.fn(async () => null),
      insert: vi.fn((key: string, value: number[]) => {
        insertedValues.push({ key, value });
        return Promise.resolve();
      }),
      remove: vi.fn(async () => null),
    };
    tauriMocks.appDataDir.mockResolvedValue("/tmp/cantiara/");
    tauriMocks.invoke.mockResolvedValue("vault-password");
    tauriMocks.strongholdLoad.mockResolvedValue({
      createClient: vi.fn(async () => ({ getStore: () => store })),
      loadClient: vi.fn(async () => ({ getStore: () => store })),
      save: vi.fn(async () => undefined),
    });
    tauriMocks.openUrl.mockResolvedValue(undefined);

    await openTauriGitHubSignIn();

    const verifierBytes = insertedValues.find(
      ({ key }) => key === "code-verifier",
    )?.value;
    if (!verifierBytes) {
      throw new Error("Tauri code verifier was not stored");
    }
    const verifier = new TextDecoder().decode(new Uint8Array(verifierBytes));
    const openedURL = new URL(tauriMocks.openUrl.mock.calls[0]?.[0]);
    expect(openedURL.pathname).toBe("/api/auth/tauri/start");
    await expect(createTauriAuthCodeChallenge(verifier)).resolves.toBe(
      openedURL.searchParams.get("code_challenge"),
    );
  });

  test("adds a bearer header for Tauri requests without replacing an explicit header", async () => {
    await expect(
      createTauriBearerHeaders(
        { "content-type": "application/json" },
        async () => "bearer-session-token",
      ),
    ).resolves.toEqual(
      new Headers({
        authorization: "Bearer bearer-session-token",
        "content-type": "application/json",
      }),
    );

    await expect(
      createTauriBearerHeaders(
        { authorization: "Bearer caller-token" },
        async () => "stored-token",
      ),
    ).resolves.toEqual(new Headers({ authorization: "Bearer caller-token" }));
  });
});
