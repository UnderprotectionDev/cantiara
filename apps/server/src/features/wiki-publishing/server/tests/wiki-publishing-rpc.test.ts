import type { Context } from "@cantiara/api/context";
import { appRouter } from "@cantiara/api/routers/index";
import {
  type WikiPublishingAccess,
  WikiPublishingError,
} from "@cantiara/api/wiki-publishing";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test, vi } from "vitest";

function createClient(access: Partial<WikiPublishingAccess>) {
  const context = {
    auth: null,
    db: {} as Context["db"],
    githubAvailability: { getStatus: () => "available" },
    session: {
      session: { id: "session-1" },
      user: { id: "account-1" },
    } as Context["session"],
    wikiPublishing: access as WikiPublishingAccess,
  } as Context;
  return createRouterClient(appRouter, { context });
}

const input = {
  approval: {
    approvedEmbedIds: ["child:wiki-2"],
    fingerprint: "fp",
    publishAnyway: false,
  },
  baseRevision: 1,
  clientIdempotencyKey: "key-1",
  documentId: "wiki-1",
};

describe("Wiki Publishing RPC", () => {
  test("publishes as the signed-in User without the mutation envelope", async () => {
    const publish = vi.fn(async () => ({ revision: 1 }) as never);
    await createClient({ publish }).publishWikiDocument(input);

    expect(publish).toHaveBeenCalledWith("account-1", {
      approval: input.approval,
      documentId: "wiki-1",
    });
  });

  test("maps a missing Wiki Document, stale preview and open placeholders", async () => {
    const missing = createClient({ preview: async () => null });
    await expect(
      missing.previewWikiPublish({ documentId: "none" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    const stale = createClient({
      publish: () => {
        throw new WikiPublishingError("WIKI_PUBLISHING_PREVIEW_STALE", "x");
      },
    });
    await expect(stale.publishWikiDocument(input)).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });

    const open = createClient({
      publish: () => {
        throw new WikiPublishingError(
          "WIKI_PUBLISHING_PLACEHOLDERS_UNRESOLVED",
          "x",
        );
      },
    });
    await expect(open.publishWikiDocument(input)).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  test("rejects an unknown approval field", async () => {
    const publish = vi.fn();
    await expect(
      createClient({ publish }).publishWikiDocument({
        ...input,
        approval: { ...input.approval, projectId: "project-1" },
      } as never),
    ).rejects.toThrow();
    expect(publish).not.toHaveBeenCalled();
  });
});
