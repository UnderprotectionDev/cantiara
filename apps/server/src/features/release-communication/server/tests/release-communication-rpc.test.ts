import type { Context } from "@cantiara/api/context";
import type { ReleaseCommunicationAccess } from "@cantiara/api/release-communication";
import { appRouter } from "@cantiara/api/routers/index";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test, vi } from "vitest";

function createClient(access: Partial<ReleaseCommunicationAccess>) {
  const context = {
    auth: null,
    db: {} as Context["db"],
    githubAvailability: { getStatus: () => "available" },
    releaseCommunication: access as ReleaseCommunicationAccess,
    session: {
      session: { id: "session-1" },
      user: { id: "account-1" },
    } as Context["session"],
  } as Context;
  return createRouterClient(appRouter, { context });
}

const approval = {
  buildInPublicEventIds: [],
  changelogLinkHrefs: [],
  fingerprint: "fp",
  publicLabels: [],
  whyTrail: [],
};

describe("Release Communication RPC", () => {
  test("saves a draft as the signed-in User without the idempotency key", async () => {
    const saveDraft = vi.fn(async () => ({ id: "note-1" }) as never);
    const client = createClient({ saveDraft });

    await client.saveReleaseNoteDraft({
      baseRevision: 0,
      body: "Shipped.",
      clientIdempotencyKey: "key-1",
      releaseId: "release-1",
      scopeWorkIds: ["work-1"],
    });

    expect(saveDraft).toHaveBeenCalledWith("account-1", {
      baseRevision: 0,
      body: "Shipped.",
      releaseId: "release-1",
      scopeWorkIds: ["work-1"],
      tagIds: [],
      whyTrail: [],
    });
  });

  test("rejects notes without a scope bind and GitHub Release text", async () => {
    const saveDraft = vi.fn();
    const client = createClient({ saveDraft });

    await expect(
      client.saveReleaseNoteDraft({
        baseRevision: 0,
        body: "Shipped.",
        clientIdempotencyKey: "key-1",
        releaseId: "release-1",
        scopeWorkIds: [],
      }),
    ).rejects.toThrow();
    await expect(
      client.saveReleaseNoteDraft({
        baseRevision: 0,
        body: "Shipped.",
        clientIdempotencyKey: "key-1",
        githubReleaseBody: "from GitHub",
        releaseId: "release-1",
        scopeWorkIds: ["work-1"],
      } as never),
    ).rejects.toThrow();
    expect(saveDraft).not.toHaveBeenCalled();
  });

  test("maps typed errors and unavailable Releases", async () => {
    const client = createClient({
      publish: () =>
        Promise.reject(
          Object.assign(new Error("stale"), {
            code: "RELEASE_COMMUNICATION_PREVIEW_STALE",
          }),
        ),
      reassessment: () => Promise.resolve(null),
      startReassessment: () =>
        Promise.reject(
          Object.assign(new Error("not published"), {
            code: "RELEASE_COMMUNICATION_NOT_PUBLISHED",
          }),
        ),
    });

    await expect(
      client.publishReleaseNote({
        approval,
        baseRevision: 0,
        clientIdempotencyKey: "key-2",
        noteId: "note-1",
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(
      client.releaseReassessment({ releaseId: "missing" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      client.startReleaseReassessment({
        baseRevision: 0,
        clientIdempotencyKey: "key-3",
        releaseId: "release-1",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  test("an observation needs one of the four assessments", async () => {
    const recordObservation = vi.fn(async () => ({ id: "round-1" }) as never);
    const client = createClient({ recordObservation });

    await expect(
      client.recordReleaseObservation({
        assessment: "Succeeded" as never,
        baseRevision: 0,
        clientIdempotencyKey: "key-4",
        kind: "access",
        roundId: "round-1",
      }),
    ).rejects.toThrow();
    await client.recordReleaseObservation({
      assessment: "Could not learn",
      baseRevision: 0,
      clientIdempotencyKey: "key-4",
      kind: "outcome",
      roundId: "round-1",
    });
    expect(recordObservation).toHaveBeenCalledTimes(1);
  });
});
