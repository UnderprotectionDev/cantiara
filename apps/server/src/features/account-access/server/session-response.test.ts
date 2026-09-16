import { describe, expect, test } from "vitest";

import { sanitizeProductSessionResponse } from "./session-response";

describe("Account Access session response", () => {
  test("keeps the session token out of the web response", async () => {
    const response = await sanitizeProductSessionResponse(
      new Request("https://api.cantiara.example/api/auth/get-session"),
      Response.json({
        session: {
          createdAt: "2026-09-16T09:00:00.000Z",
          id: "session-alias",
          token: "session-secret",
        },
        user: { id: "account-1", name: "Founder" },
      }),
    );

    expect(await response.json()).toEqual({
      session: {
        createdAt: "2026-09-16T09:00:00.000Z",
        id: "session-alias",
      },
      user: { id: "account-1", name: "Founder" },
    });
  });
});
