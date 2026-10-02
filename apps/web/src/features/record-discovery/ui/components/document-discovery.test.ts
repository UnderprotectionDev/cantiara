import { expect, test } from "vitest";
import {
  discoveryScopeValue,
  parseDiscoveryScope,
  parseDiscoveryView,
} from "./document-discovery";

test("scope controls round-trip exact homes and reject invalid selections", () => {
  const scopes = [
    { kind: "all" } as const,
    { kind: "wiki" } as const,
    { kind: "project", projectId: "project:one" } as const,
  ];
  for (const scope of scopes) {
    expect(parseDiscoveryScope(discoveryScopeValue(scope))).toEqual(scope);
  }
  for (const value of ["unknown", "project:", "other:project-one"]) {
    expect(() => parseDiscoveryScope(value)).toThrow();
  }
  expect(parseDiscoveryView("Search")).toBe("Search");
  expect(parseDiscoveryView("All Documents")).toBe("All Documents");
  expect(() => parseDiscoveryView("unknown")).toThrow();
});
