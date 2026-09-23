import { describe, expect, test } from "vitest";

import { githubIdentityCallbackCode } from "./github-identity-confirmation";

describe("GitHub identity confirmation popup", () => {
  test("accepts callback codes only from the same-origin confirmation popup", () => {
    const popup = {} as WindowProxy;
    const event = {
      data: {
        code: "A".repeat(43),
        type: "cantiara.confirm-github-identity",
      },
      origin: "https://app.cantiara.example",
      source: popup,
    } as MessageEvent;

    expect(
      githubIdentityCallbackCode(event, popup, "https://app.cantiara.example"),
    ).toBe("A".repeat(43));
    expect(
      githubIdentityCallbackCode(
        { ...event, origin: "https://attacker.example" },
        popup,
        "https://app.cantiara.example",
      ),
    ).toBeNull();
    expect(
      githubIdentityCallbackCode(
        { ...event, source: {} as WindowProxy },
        popup,
        "https://app.cantiara.example",
      ),
    ).toBeNull();
  });
});
