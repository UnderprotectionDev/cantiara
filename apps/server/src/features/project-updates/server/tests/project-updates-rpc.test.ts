import type { Context } from "@cantiara/api/context";
import { appRouter } from "@cantiara/api/routers/index";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test } from "vitest";

import { createProjectUpdates } from "../project-updates";
import { createMemoryProjectUpdates } from "../project-updates-memory-store";

const ACCOUNT = "account-1";
const UPDATE_PROCEDURE = /project.?update/i;
const REWRITE_PROCEDURE =
  /^(set|update|edit|rewrite|remove|delete|restore|replace)/i;

const snapshot = {
  blocks: [],
  lifecycle: "Active",
  purpose: null,
  targetDate: null,
};
const body = {
  links: [{ targetId: "r1", targetType: "Risk" as const }],
  mark: "At Risk" as const,
  narrative: "Scope grew.",
  projectId: "project-1",
  snapshot,
  updateId: "u1",
};

function setup(authenticated = true, archived = false) {
  const harness = createMemoryProjectUpdates({
    accountId: ACCOUNT,
    projects: new Map([
      [
        "project-1",
        {
          archived,
          records: new Map([
            ["Risk:r1", { label: "Slip", status: "Open", unavailable: false }],
          ]),
        },
      ],
    ]),
  });
  const context = {
    projectUpdates: createProjectUpdates(harness.store),
    session: authenticated
      ? { session: { id: "session" }, user: { id: ACCOUNT } }
      : null,
  } as unknown as Context;
  return createRouterClient(appRouter, { context });
}

describe("Manual Project Updates RPC seam", () => {
  test("exposes only a read and a create, no rewrite or removal", () => {
    const procedures = Object.keys(appRouter).filter((name) =>
      UPDATE_PROCEDURE.test(name),
    );
    expect(procedures.sort()).toEqual([
      "createProjectUpdate",
      "projectUpdates",
    ]);
    expect(procedures.some((name) => REWRITE_PROCEDURE.test(name))).toBe(false);
  });

  test("creates and lists an entry for the signed-in account", async () => {
    const client = setup();
    await client.createProjectUpdate(body);
    const overview = await client.projectUpdates({ projectId: "project-1" });
    expect(overview.updates.map((update) => update.mark)).toEqual(["At Risk"]);
    expect(overview.updates[0]?.links[0]?.label).toBe("Slip");
  });

  test("refuses a signed-out caller, another Project and a rewrite", async () => {
    await expect(
      setup(false).projectUpdates({ projectId: "project-1" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      setup().projectUpdates({ projectId: "other" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    const client = setup();
    await client.createProjectUpdate(body);
    await expect(
      client.createProjectUpdate({ ...body, mark: "Off Track" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  test("rejects unknown fields, an invalid link and an archived Project", async () => {
    await expect(
      setup().createProjectUpdate({ ...body, score: 80 } as never),
    ).rejects.toBeDefined();
    await expect(
      setup().createProjectUpdate({
        ...body,
        links: [{ targetId: "nope", targetType: "Risk" }],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      setup(true, true).createProjectUpdate(body),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
