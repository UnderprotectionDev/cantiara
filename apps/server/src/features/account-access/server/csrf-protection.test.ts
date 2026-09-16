import { Hono } from "hono";
import { describe, expect, test } from "vitest";

import {
  createCsrfProtectionMiddleware,
  isCookieAuthenticatedMutationCsrfSafe,
} from "./csrf-protection";

const trustedOrigins = [
  "https://cantiara.example",
  "tauri://localhost",
] as const;

describe("Account Access CSRF protection", () => {
  test("rejects a cookie-authenticated state change without a trusted origin", () => {
    const request = new Request("https://api.cantiara.example/rpc/sessions", {
      body: "{}",
      headers: {
        "content-type": "application/json",
        cookie: "__Secure-better-auth.session_token=secret",
      },
      method: "POST",
    });

    expect(isCookieAuthenticatedMutationCsrfSafe(request, trustedOrigins)).toBe(
      false,
    );
  });

  test("accepts only trusted same-site cookie mutations and leaves reads untouched", () => {
    const mutation = new Request(
      "https://api.cantiara.example/rpc/revoke-session",
      {
        body: "{}",
        headers: {
          "content-type": "application/json",
          cookie: "__Secure-better-auth.session_token=secret",
          origin: "https://cantiara.example",
          "sec-fetch-site": "same-site",
        },
        method: "POST",
      },
    );
    const crossSiteMutation = new Request(mutation, {
      headers: {
        ...Object.fromEntries(mutation.headers),
        "sec-fetch-site": "cross-site",
      },
    });
    const read = new Request("https://api.cantiara.example/rpc/sessions", {
      headers: { cookie: "__Secure-better-auth.session_token=secret" },
    });

    expect(
      isCookieAuthenticatedMutationCsrfSafe(mutation, trustedOrigins),
    ).toBe(true);
    expect(
      isCookieAuthenticatedMutationCsrfSafe(crossSiteMutation, trustedOrigins),
    ).toBe(false);
    expect(isCookieAuthenticatedMutationCsrfSafe(read, trustedOrigins)).toBe(
      true,
    );
  });

  test("the HTTP middleware blocks the protected command before it runs", async () => {
    let protectedCommandCalls = 0;
    const app = new Hono();
    app.use("*", createCsrfProtectionMiddleware(trustedOrigins));
    app.post("/protected-command", (context) => {
      protectedCommandCalls += 1;
      return context.json({ status: true });
    });

    const response = await app.request("/protected-command", {
      body: "{}",
      headers: {
        "content-type": "application/json",
        cookie: "__Secure-better-auth.session_token=secret",
      },
      method: "POST",
    });

    expect(response.status).toBe(403);
    expect(protectedCommandCalls).toBe(0);
  });
});
