import { afterEach, describe, expect, test, vi } from "vitest";

import {
  client,
  documentDiscoveryQueryOptions,
  universalSearchQueryOptions,
  workspaceOverviewQueryOptions,
} from "../orpc";

afterEach(() => vi.unstubAllGlobals());

describe("Account Access through the RPC transport", () => {
  test("preserves session credentials and manual redirect handling", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ json: [] }));
    vi.stubGlobal("fetch", fetcher);

    expect(await client.projects()).toEqual([]);
    expect(fetcher).toHaveBeenCalledWith(
      expect.any(Request),
      expect.objectContaining({ credentials: "include", redirect: "manual" }),
    );
  });

  test.each([301, 302, 303, 307, 308])(
    "rejects a %s sign-in redirect instead of treating it as RPC data",
    async (status) => {
      const fetcher = vi.fn().mockResolvedValue(
        Response.json(
          { json: [] },
          {
            status,
            headers: { location: "https://example.org/sign-in" },
          },
        ),
      );
      vi.stubGlobal("fetch", fetcher);

      await expect(client.projects()).rejects.toThrow();
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );
});

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
