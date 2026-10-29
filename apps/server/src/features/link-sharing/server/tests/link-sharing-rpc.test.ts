import type { Context } from "@cantiara/api/context";
import { appRouter } from "@cantiara/api/routers/index";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test } from "vitest";

import { createLinkSharing, type ShareSource } from "../link-sharing";
import { createMemoryLinkSharing } from "../link-sharing-memory-store";

const ACCOUNT = "account-1";
const SHARE_PROCEDURE = /share/i;
const VISITOR_OR_LIFECYCLE =
  /(visitor|session|password|token|expire|expiry|revoke|reshare|reopen)/i;

const root = { id: "d1", kind: "Document" as const };
const source: ShareSource = {
  blockers: [],
  members: [],
  projectId: "project-1",
  record: {
    fields: [
      {
        key: "body",
        kind: "markdown",
        label: "Body",
        value: "Hi {{alan_adı}}",
      },
      { key: "key", kind: "secret", label: "Key", value: "sk-live-9" },
    ],
    id: "d1",
    kind: "Document",
    parts: [],
    title: "Plan",
  },
};

function setup(authenticated = true) {
  const harness = createMemoryLinkSharing({
    accountId: ACCOUNT,
    sources: [{ root, source }],
  });
  const context = {
    linkSharing: createLinkSharing(harness.store),
    session: authenticated
      ? { session: { id: "session" }, user: { id: ACCOUNT } }
      : null,
  } as unknown as Context;
  return { client: createRouterClient(appRouter, { context }), harness };
}

const selection = [
  "record:Document:d1",
  "field:Document:d1:title",
  "field:Document:d1:body",
];

describe("Link Sharing RPC seam", () => {
  test("exposes the roots, the preview and the approval only (no visitor, expiry or revoke yet)", () => {
    const procedures = Object.keys(appRouter).filter((name) =>
      SHARE_PROCEDURE.test(name),
    );
    expect(procedures.sort()).toEqual([
      "approveShareScope",
      "previewShareScope",
      "shareRoots",
    ]);
    expect(procedures.some((name) => VISITOR_OR_LIFECYCLE.test(name))).toBe(
      false,
    );
  });

  test("previews the exact closed world with no Secret and lists the placeholder", async () => {
    const { client } = setup();
    const preview = await client.previewShareScope({ root });
    expect(preview.placeholders).toHaveLength(1);
    expect(JSON.stringify(preview)).not.toContain("sk-live-9");
    expect(
      (await client.shareRoots({ projectId: "project-1" }))[0]?.title,
    ).toBe("Plan");
  });

  test("approval needs the separate Publish/share anyway confirmation", async () => {
    const { client, harness } = setup();
    const base = {
      approvalId: "a1",
      approvedItemIds: selection,
      liveItemIds: [],
      root,
    };
    await expect(
      client.approveShareScope({ ...base, publishAnyway: false }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      data: { code: "PLACEHOLDERS_UNRESOLVED", count: 1 },
    });
    expect(harness.surfaces).toHaveLength(0);
    const approved = await client.approveShareScope({
      ...base,
      publishAnyway: true,
    });
    expect(approved).toMatchObject({ label: "Approved snapshot", revision: 1 });
  });

  test("refuses a signed-out caller, another account's root, a stale selection and a changed retry", async () => {
    await expect(
      setup(false).client.previewShareScope({ root }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      setup().client.previewShareScope({
        root: { id: "nope", kind: "Document" },
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    const { client } = setup();
    await expect(
      client.approveShareScope({
        approvalId: "a1",
        approvedItemIds: [...selection, "record:Work:private"],
        liveItemIds: [],
        publishAnyway: true,
        root,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    const ok = {
      approvalId: "a2",
      approvedItemIds: selection,
      liveItemIds: [],
      publishAnyway: true,
      root,
    };
    await client.approveShareScope(ok);
    await expect(
      client.approveShareScope({
        ...ok,
        approvedItemIds: selection.slice(0, 2),
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  test("rejects unknown fields", async () => {
    await expect(
      setup().client.approveShareScope({
        approvalId: "a1",
        approvedItemIds: selection,
        liveItemIds: [],
        password: "x",
        publishAnyway: true,
        root,
      } as never),
    ).rejects.toBeDefined();
  });
});
