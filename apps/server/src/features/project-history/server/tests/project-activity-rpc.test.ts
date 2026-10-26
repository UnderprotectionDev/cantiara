import type { Context } from "@cantiara/api/context";
import type { ProjectActivityFacts } from "@cantiara/api/project-activity";
import { appRouter } from "@cantiara/api/routers/index";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test } from "vitest";

import { createProjectActivity } from "../project-activity";
import { createMemoryProjectActivity } from "../project-activity-memory-store";

const ACCOUNT = "account-1";
const ACTIVITY_PROCEDURE = /activity/i;
const PROVIDER_FEED_PROCEDURE = /githubactivity|digest|emaillog/i;

const facts: ProjectActivityFacts = {
  history: [
    {
      actor: { actorId: "user-1", type: "User" },
      id: "h1",
      nextValue: { work: { title: "B" } },
      occurredAt: "2026-05-01T10:00:00.000Z",
      origin: { clientIdempotencyKey: "k", kind: "human" },
      previousValue: { work: { title: "A" } },
      relation: false,
      revision: 1,
      source: { label: "TID-1 Ship", recordId: "work-1", recordType: "Work" },
    },
  ],
  unattributed: [],
  windowReached: false,
};

function setup(authenticated = true) {
  const context = {
    projectActivity: createProjectActivity(
      createMemoryProjectActivity({
        accountId: ACCOUNT,
        facts: new Map([["project-1", facts]]),
      }),
    ),
    session: authenticated
      ? { session: { id: "session" }, user: { id: ACCOUNT } }
      : null,
  } as unknown as Context;
  return createRouterClient(appRouter, { context });
}

describe("Project Activity RPC seam", () => {
  test("serves the filtered feed to the signed-in account", async () => {
    const client = setup();
    const feed = await client.projectActivity({
      eventTypes: ["Field change"],
      projectId: "project-1",
      sourceTypes: ["Work"],
    });
    expect(feed.rows).toHaveLength(1);
    expect(feed.rows[0]?.actor.kind).toBe("User");
    const none = await client.projectActivity({
      projectId: "project-1",
      sourceTypes: ["Risk"],
    });
    expect(none.rows).toEqual([]);
  });

  test("requires a signed-in account and maps a missing Project to a defined error", async () => {
    await expect(
      setup(false).projectActivity({ projectId: "project-1" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      setup().projectActivity({ projectId: "project-2" }),
    ).rejects.toMatchObject({
      data: { code: "PROJECT_ACTIVITY_PROJECT_NOT_FOUND" },
    });
  });

  test("refuses a call that carries a write, status or signal field", async () => {
    await expect(
      setup().projectActivity({
        projectId: "project-1",
        signal: true,
      } as never),
    ).rejects.toBeDefined();
  });

  test("exposes one read procedure: no write, signal, GitHub Activity or digest procedure", () => {
    const names = Object.keys(appRouter).filter((name) =>
      ACTIVITY_PROCEDURE.test(name),
    );
    expect(names).toEqual(["projectActivity"]);
    expect(
      Object.keys(appRouter).filter((name) =>
        PROVIDER_FEED_PROCEDURE.test(name),
      ),
    ).toEqual([]);
  });
});
