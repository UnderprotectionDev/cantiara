import { QueryClient } from "@tanstack/react-query";
import { expect, test } from "vitest";
import { orpc } from "@/utils/orpc";
import { refreshTrashQueries } from "../refresh-trash-queries";

test("moving a Risk refreshes its Project without invalidating other record lists", async () => {
  const cache = new QueryClient();
  const risk = orpc.projectRisks.queryKey({ input: { projectId: "p1" } });
  const other = orpc.projectRisks.queryKey({ input: { projectId: "p2" } });
  const documents = orpc.documents.queryKey({ input: { projectId: "p1" } });
  const trash = orpc.trash.queryKey({ input: { projectId: "p1" } });
  for (const key of [risk, other, documents, trash]) {
    cache.setQueryData(key, []);
  }
  await refreshTrashQueries(cache, {
    projectId: "p1",
    recordId: "risk-1",
    recordKind: "Risk",
  });
  expect(cache.getQueryState(risk)?.isInvalidated).toBe(true);
  expect(cache.getQueryState(trash)?.isInvalidated).toBe(true);
  expect(cache.getQueryState(other)?.isInvalidated).toBe(false);
  expect(cache.getQueryState(documents)?.isInvalidated).toBe(false);
  cache.clear();
});
