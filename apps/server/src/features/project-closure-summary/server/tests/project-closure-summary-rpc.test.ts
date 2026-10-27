import type { Context } from "@cantiara/api/context";
import { appRouter } from "@cantiara/api/routers/index";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test } from "vitest";

import { createProjectClosureSummary } from "../project-closure-summary";
import { createMemoryProjectClosureSummary } from "../project-closure-summary-memory-store";

const ACCOUNT = "account-1";
const CLOSURE_PROCEDURE = /closuresummary/i;
const WRITE_PROCEDURE =
  /^(add|set|remove|create|update|delete|close|write|save)/i;

function setup(authenticated = true, status = "Completed") {
  const context = {
    projectClosureSummary: createProjectClosureSummary(
      createMemoryProjectClosureSummary({
        accountId: ACCOUNT,
        projects: new Map([
          [
            "project-1",
            {
              candidates: [
                { label: "Alpha", recordId: "d1", recordType: "Decision" },
              ],
              status,
            },
          ],
        ]),
      }),
    ),
    session: authenticated
      ? { session: { id: "session" }, user: { id: ACCOUNT } }
      : null,
  } as unknown as Context;
  return createRouterClient(appRouter, { context });
}

describe("Project Closure Summary RPC seam", () => {
  test("lists sources and previews the draft for the signed-in account", async () => {
    const client = setup();
    const sources = await client.projectClosureSummarySources({
      projectId: "project-1",
    });
    expect(sources.groups[0]?.candidates.map((c) => c.label)).toEqual([
      "Alpha",
    ]);
    const draft = await client.projectClosureSummaryDraft({
      projectId: "project-1",
      sources: [{ recordId: "d1", recordType: "Decision" }],
    });
    expect(draft.sections).toEqual([
      {
        heading: "Decisions",
        recordType: "Decision",
        sources: [{ label: "Alpha", recordId: "d1", recordType: "Decision" }],
      },
    ]);
  });

  test("refuses signed-out, foreign Project, open Project and foreign source", async () => {
    await expect(
      setup(false).projectClosureSummarySources({ projectId: "project-1" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      setup().projectClosureSummarySources({ projectId: "other" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      setup(true, "Active").projectClosureSummaryDraft({
        projectId: "project-1",
        sources: [],
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(
      setup().projectClosureSummaryDraft({
        projectId: "project-1",
        sources: [{ recordId: "foreign", recordType: "Decision" }],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  test("rejects smuggled narrative fields on the strict input", async () => {
    await expect(
      setup().projectClosureSummaryDraft({
        projectId: "project-1",
        sources: [],
        summary: "Everything went great",
      } as never),
    ).rejects.toBeDefined();
  });

  test("the surface has read procedures only and no save or persist", () => {
    const names = Object.keys(appRouter).filter((name) =>
      CLOSURE_PROCEDURE.test(name),
    );
    expect(names.sort()).toEqual([
      "projectClosureSummaryDraft",
      "projectClosureSummarySources",
    ]);
    expect(names.filter((name) => WRITE_PROCEDURE.test(name))).toEqual([]);
  });
});
