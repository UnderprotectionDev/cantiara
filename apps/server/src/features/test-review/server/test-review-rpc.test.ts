import type { Context } from "@cantiara/api/context";
import { appRouter } from "@cantiara/api/routers/index";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test } from "vitest";

import {
  accountId,
  createMemoryHarness,
  fixtureSession,
  projectId,
} from "./test-review-memory-store";

function setup(authenticated = true) {
  const { testReview } = createMemoryHarness([
    fixtureSession("s1", [{ id: "t1", title: "Login works" }]),
  ]);
  const context = {
    session: authenticated
      ? { session: { id: "session" }, user: { id: accountId } }
      : null,
    testReview,
  } as Context;
  return createRouterClient(appRouter, { context });
}

const REVIEW_PROCEDURE = /^projectTestReview$|Review(Session|Item|Close|Bulk)/;
const FORBIDDEN_PROCEDURE = /archive|trash|delete|gate|release/i;

describe("Test Review RPC seam", () => {
  test("lists, reviews and bulk marks for the authenticated account", async () => {
    const client = setup();
    await client.setReviewItemState({
      projectId,
      sessionId: "s1",
      sessionTestId: "t1",
      state: "Follow-up needed",
    });
    const preview = await client.previewReviewBulk({
      projectId,
      sessionId: "s1",
      sessionTestIds: ["t1"],
    });
    expect(preview.changes).toHaveLength(2);
    await client.commitReviewBulk({
      previewed: preview.changes,
      projectId,
      sessionId: "s1",
      sessionTestIds: ["t1"],
    });
    const listed = await client.projectTestReview({ projectId });
    expect(listed.sessions[0]?.reviewState).toBe("Reviewed");
    expect(listed.sessions[0]?.items[0]?.reviewState).toBe("Reviewed");
    expect(listed.events).toHaveLength(3);
  });

  test("requires a signed-in account and maps refusals to defined errors", async () => {
    await expect(
      setup(false).projectTestReview({ projectId }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      setup().commitReviewBulk({
        previewed: [],
        projectId,
        sessionId: "s1",
        sessionTestIds: ["t1"],
      }),
    ).rejects.toMatchObject({ data: { code: "TEST_REVIEW_PREVIEW_STALE" } });
    await expect(
      setup().setReviewSessionState({
        projectId,
        sessionId: "missing",
        state: "Reviewed",
      }),
    ).rejects.toMatchObject({ data: { code: "TEST_REVIEW_RECORD_NOT_FOUND" } });
  });

  test("exposes no archive, trash, delete or gate procedure for a Session Test", () => {
    const names = Object.keys(appRouter).filter((name) =>
      REVIEW_PROCEDURE.test(name),
    );
    expect(names.filter((name) => FORBIDDEN_PROCEDURE.test(name))).toEqual([]);
    expect(names).toEqual(
      expect.arrayContaining([
        "projectTestReview",
        "setReviewSessionState",
        "setReviewItemState",
        "previewReviewClose",
        "previewReviewBulk",
        "commitReviewBulk",
      ]),
    );
  });
});
