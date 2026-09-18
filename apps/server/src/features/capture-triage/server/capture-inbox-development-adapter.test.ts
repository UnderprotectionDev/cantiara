import type { CaptureInboxItem } from "@cantiara/api/capture-triage";
import { describe, expect, test } from "vitest";
import { createDevelopmentCaptureInboxTriageAdapter } from "./capture-inbox-development-adapter";

const item: CaptureInboxItem = {
  content: "A captured note",
  createdAt: "2026-09-18T09:00:00.000Z",
  fields: {},
  id: "capture-1",
  projectId: "project-1",
  template: "Research Fragment",
};

describe("createDevelopmentCaptureInboxTriageAdapter", () => {
  test("provides deterministic local conversion and attachment receipts", async () => {
    const adapter = createDevelopmentCaptureInboxTriageAdapter();
    const clientIdempotencyKey = "client-key-1";

    await expect(
      adapter.createRecord({
        accountId: "account-1",
        clientIdempotencyKey,
        fields: {},
        item,
        projectId: item.projectId,
        recordType: "Work",
        title: "A captured note",
      }),
    ).resolves.toEqual({
      id: "capture-test-record:account-1:client-key-1",
      recordType: "Work",
    });

    const target = await adapter.findRecord("account-1", "target-1");
    expect(target).not.toBeNull();
    if (!target) {
      throw new Error("The development adapter did not return a target.");
    }

    await expect(
      adapter.attachToExisting({
        accountId: "account-1",
        clientIdempotencyKey,
        item,
        mergeId: "merge-1",
        relation: "Origin",
        target,
      }),
    ).resolves.toEqual({
      attributedRelationIds: ["capture-test-relation:client-key-1"],
      attributedValueKeys: ["capture-test-value:client-key-1"],
      mergeId: "merge-1",
    });
  });

  test("offers a local suggestion that can be used as an attachment target", async () => {
    const adapter = createDevelopmentCaptureInboxTriageAdapter();
    const { findSimilar } = adapter;
    if (!findSimilar) {
      throw new Error("The development adapter did not return suggestions.");
    }
    const [suggestion] = await findSimilar("account-1", item);

    expect(suggestion).toBeDefined();
    if (!suggestion) {
      throw new Error("The development adapter returned no suggestion.");
    }

    expect(suggestion).toMatchObject({
      id: "capture-test-target:account-1:capture-1",
      projectId: "project-1",
      recordType: "Work",
    });
    await expect(
      adapter.findRecord("account-1", suggestion.id),
    ).resolves.toMatchObject({
      id: suggestion.id,
    });
  });
});
