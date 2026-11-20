import { QueryClient } from "@tanstack/react-query";
import { expect, test } from "vitest";
import { fetchFresh } from "../fetch-fresh";

test("a command reads the current result even with a fresh cached value", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Number.POSITIVE_INFINITY } },
  });
  const queryKey = ["work", "work-1"];
  client.setQueryData(queryKey, { revision: 1 });

  await expect(
    fetchFresh(client, {
      queryFn: () => Promise.resolve({ revision: 2 }),
      queryKey,
      select: (work) => work.revision,
    }),
  ).resolves.toBe(2);
  expect(client.getQueryData(queryKey)).toEqual({ revision: 2 });
  client.clear();
});

test("a sensitive preview can expire immediately without changing other reads", async () => {
  const client = new QueryClient();
  const queryFn = () => Promise.resolve("preview");
  const retained = ["work", "work-2"];
  const ephemeral = ["preview", "work-2"];

  await fetchFresh(client, { queryFn, queryKey: retained });
  await fetchFresh(client, { gcTime: 0, queryFn, queryKey: ephemeral });

  await expect.poll(() => client.getQueryData(ephemeral)).toBeUndefined();
  expect(client.getQueryData(retained)).toBe("preview");
  client.clear();
});
