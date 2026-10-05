import { recordDiscoveryIndexLabels } from "@cantiara/api/record-discovery";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import {
  DiscoveryContent,
  discoveryIndexFailed,
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

test("exposes the closed zero-setup index list in the discovery selector", () => {
  expect(recordDiscoveryIndexLabels).toEqual([
    "All Work",
    "All Documents",
    "All Decisions",
    "All Risks",
    "All Research Sessions",
    "All Tests",
    "All Designs",
    "All Technical Diagrams",
    "All Project Releases",
    "All Sources",
    "All Files",
  ]);
  for (const label of recordDiscoveryIndexLabels) {
    expect(parseDiscoveryView(label)).toBe(label);
  }
});

test("treats required index lookup failures as unavailable", () => {
  expect(
    discoveryIndexFailed({
      index: "All Work",
      inventoryFailed: false,
      projectsFailed: true,
      resultsFailed: false,
    }),
  ).toBe(true);
  expect(
    discoveryIndexFailed({
      index: "All Files",
      inventoryFailed: true,
      projectsFailed: false,
      resultsFailed: false,
    }),
  ).toBe(true);
  expect(
    discoveryIndexFailed({
      index: "All Work",
      inventoryFailed: true,
      projectsFailed: false,
      resultsFailed: false,
    }),
  ).toBe(false);
});

test("uses the prepared index empty state instead of search wording", () => {
  const markup = renderToStaticMarkup(
    DiscoveryContent({
      data: [],
      failed: false,
      index: "All Tests",
      onOpenSource: () => undefined,
      pending: false,
    }),
  );

  expect(markup).toContain("No records in this index.");
  expect(markup).not.toContain("No matching records.");
});
