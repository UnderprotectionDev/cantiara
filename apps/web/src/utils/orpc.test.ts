import { describe, expect, test } from "vitest";

import { workspaceOverviewQueryOptions } from "./orpc";

describe("Workspace Overview query options", () => {
  test("keeps the cached overview scoped to the account", () => {
    const accountOne = workspaceOverviewQueryOptions("account-1");
    const accountTwo = workspaceOverviewQueryOptions("account-2");

    expect(accountOne.enabled).toBe(true);
    expect(accountTwo.enabled).toBe(true);
    expect(accountOne.queryKey).not.toEqual(accountTwo.queryKey);
  });
});
