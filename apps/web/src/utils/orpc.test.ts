import { describe, expect, test } from "vitest";

import {
  documentDiscoveryQueryOptions,
  universalSearchQueryOptions,
  workspaceOverviewQueryOptions,
} from "./orpc";

test("Document discovery cannot reuse another Account's cached names or match snippets", () => {
  const input = { query: "PostgreSQL" };
  expect(
    documentDiscoveryQueryOptions("account-one", input).queryKey,
  ).not.toEqual(documentDiscoveryQueryOptions("account-two", input).queryKey);
  expect(documentDiscoveryQueryOptions(undefined, input).enabled).toBe(false);
});

test("Universal Search cache entries are scoped to the Account", () => {
  const input = { query: "PostgreSQL" };
  expect(
    universalSearchQueryOptions("account-one", input).queryKey,
  ).not.toEqual(universalSearchQueryOptions("account-two", input).queryKey);
  expect(universalSearchQueryOptions(undefined, input).enabled).toBe(false);
});

describe("Workspace Overview query options", () => {
  test("keeps the cached overview scoped to the account", () => {
    const accountOne = workspaceOverviewQueryOptions("account-1");
    const accountTwo = workspaceOverviewQueryOptions("account-2");

    expect(accountOne.enabled).toBe(true);
    expect(accountTwo.enabled).toBe(true);
    expect(accountOne.queryKey).not.toEqual(accountTwo.queryKey);
  });
});
