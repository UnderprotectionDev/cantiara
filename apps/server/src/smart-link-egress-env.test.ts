import { describe, expect, test } from "vitest";
import { createSmartLinkEgressEnv } from "./smart-link-egress-env";

describe("createSmartLinkEgressEnv", () => {
  test("defaults PORT to 3002", () => {
    expect(createSmartLinkEgressEnv({}).PORT).toBe(3002);
    expect(createSmartLinkEgressEnv({ PORT: "" }).PORT).toBe(3002);
  });

  test("coerces a configured PORT", () => {
    expect(createSmartLinkEgressEnv({ PORT: "8080" }).PORT).toBe(8080);
  });

  test("rejects an invalid PORT", () => {
    expect(() => createSmartLinkEgressEnv({ PORT: "abc" })).toThrow();
    expect(() => createSmartLinkEgressEnv({ PORT: "0" })).toThrow();
  });
});
