import { describe, expect, test } from "vitest";

import { createGitHubSignInCallbackUrl } from "./github-sign-in-url";

describe("GitHub sign-in callback URL", () => {
  test("returns to the web dashboard instead of the API server", () => {
    expect(createGitHubSignInCallbackUrl("http://localhost:3001")).toBe(
      "http://localhost:3001/dashboard",
    );
  });
});
