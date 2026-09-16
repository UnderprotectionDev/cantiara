import { describe, expect, test } from "vitest";

import {
  createTauriBearerHeaders,
  exchangeTauriAuthCode,
  parseTauriAuthCallback,
  TAURI_AUTH_CALLBACK_URL,
} from "./tauri-session";

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
        read: () => Promise.resolve(storedToken ?? null),
        write: (token) => {
          storedToken = token;
          return Promise.resolve();
        },
      },
    });

    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe(
      "https://api.cantiara.example/api/auth/tauri/exchange",
    );
    await expect(requests[0]?.json()).resolves.toEqual({
      code: "one-time-code",
    });
    expect(storedToken).toBe("bearer-session-token");
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
