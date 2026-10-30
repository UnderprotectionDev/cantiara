import type { SmartCollectionViewSource } from "@cantiara/api/smart-collections";
import { describe, expect, test } from "vitest";

import { createSmartCollectionExportVerifier } from "../smart-collection-export-verifier";

const view = {
  collectionName: "Ready work",
  conditions: { status: "Ready" },
  projectSourceRecords: [],
  scope: { projectIds: ["p1", "p2"] },
  sourceType: "Work",
  works: [{ id: "w1" }, { id: "w2" }],
} as unknown as SmartCollectionViewSource;

describe("Smart Collection export verifier", () => {
  test("reads the stored definition and live membership read-only", async () => {
    const calls: unknown[] = [];
    const verifier = createSmartCollectionExportVerifier({
      getView: (_accountId, _viewId, options) => {
        calls.push(options);
        return Promise.resolve(view);
      },
    });
    expect(await verifier.smartCollection("a1", "sc1")).toEqual({
      conditions: { status: "Ready" },
      memberIds: ["w1", "w2"],
      name: "Ready work",
      projectIds: ["p1", "p2"],
      sourceType: "Work",
    });
    expect(calls).toEqual([{ readOnly: true }]);
  });

  test("returns null for a collection the account cannot read", async () => {
    const verifier = createSmartCollectionExportVerifier({
      getView: () => Promise.resolve(null),
    });
    expect(await verifier.smartCollection("a1", "other")).toBeNull();
  });
});
