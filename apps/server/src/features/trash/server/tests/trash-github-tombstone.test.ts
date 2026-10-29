import { describe, expect, test } from "vitest";

import type { TrashRecordExecutor } from "../trash-records-database";
import { trashRecordAdapters } from "../trash-records-database";

/** A delete chain that returns what the deleted row would hold. */
function deleting(rows: Record<string, unknown>[]) {
  return {
    delete: () => ({
      where: () => ({ returning: () => Promise.resolve(rows) }),
    }),
  } as unknown as TrashRecordExecutor;
}

describe("Trash seam: GitHub External Record tombstone", () => {
  test("a permanent delete returns only provider kind, source id, number and local alias", async () => {
    const executor = deleting([
      {
        githubId: 42,
        kind: "Issue",
        linkId: "link-1",
        number: 7,
        recordId: "record-1",
      },
    ]);

    const erased = await trashRecordAdapters["GitHub External Record"].erase(
      executor,
      "record-1",
    );

    expect(erased).toEqual({
      githubTombstone: {
        githubId: 42,
        kind: "Issue",
        linkId: "link-1",
        number: 7,
        recordId: "record-1",
      },
    });
  });

  test("a record that is already gone yields no tombstone", async () => {
    const erased = await trashRecordAdapters["GitHub External Record"].erase(
      deleting([]),
      "record-1",
    );

    expect(erased).toBeNull();
  });
});
