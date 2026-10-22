import type { Context } from "@cantiara/api/context";
import { appRouter } from "@cantiara/api/routers/index";
import type {
  WorkAutomationAccess,
  WorkAutomationRule,
} from "@cantiara/api/work-automation";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test, vi } from "vitest";

const rule: WorkAutomationRule = {
  createdAt: "2026-10-22T09:00:00.000Z",
  definition: {
    actions: [{ kind: "set-work-status", status: "In Progress" }],
    conditions: [],
    trigger: { kind: "work-created" },
  },
  enabled: false,
  id: "rule-1",
  name: "Start new Work",
  projectId: "project-1",
  revision: 1,
  trashedAt: null,
  updatedAt: "2026-10-22T09:00:00.000Z",
  version: 1,
};

function createClient(workAutomation: Partial<WorkAutomationAccess>) {
  const context = {
    auth: null,
    db: {} as Context["db"],
    githubAvailability: { getStatus: () => "available" },
    session: {
      session: { id: "session-1" },
      user: { id: "account-1" },
    } as Context["session"],
    workAutomation: workAutomation as WorkAutomationAccess,
  } as Context;
  return createRouterClient(appRouter, { context });
}

describe("Work Automation RPC", () => {
  test("creates a disabled rule as the signed-in User", async () => {
    const create = vi.fn(async () => rule);
    const client = createClient({ create });

    const created = await client.createWorkAutomationRule({
      baseRevision: 0,
      clientIdempotencyKey: "key-1",
      definition: rule.definition,
      name: rule.name,
      projectId: "project-1",
    });

    expect(created.enabled).toBe(false);
    expect(create).toHaveBeenCalledWith("account-1", {
      definition: rule.definition,
      name: rule.name,
      projectId: "project-1",
    });
  });

  test("rejects definitions outside the closed catalog", async () => {
    const create = vi.fn(async () => rule);
    const client = createClient({ create });

    const triggers = [
      { kind: "http-webhook" },
      { event: "pull_request.opened", kind: "github-event" },
    ];
    await Promise.all(
      triggers.map((trigger) =>
        expect(
          client.createWorkAutomationRule({
            baseRevision: 0,
            clientIdempotencyKey: "key-2",
            definition: { ...rule.definition, trigger } as never,
            name: rule.name,
            projectId: "project-1",
          }),
        ).rejects.toThrow(),
      ),
    );
    expect(create).not.toHaveBeenCalled();
  });

  test("reports stale and unavailable rules as typed errors", async () => {
    const client = createClient({
      setEnabled: () =>
        Promise.reject(
          Object.assign(new Error("stale"), {
            code: "WORK_AUTOMATION_STALE_REVISION",
          }),
        ),
      trash: () => Promise.resolve(null),
    });

    await expect(
      client.setWorkAutomationRuleEnabled({
        baseRevision: 1,
        clientIdempotencyKey: "key-3",
        enabled: true,
        ruleId: "rule-1",
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(
      client.trashWorkAutomationRule({
        baseRevision: 1,
        clientIdempotencyKey: "key-4",
        ruleId: "missing",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("creates the prepared PR-merge rule through its own procedure", async () => {
    const createRequiredPrMergeRule = vi.fn(async () => ({
      ...rule,
      definition: {
        actions: [{ kind: "complete-work" as const }],
        conditions: [],
        trigger: { kind: "required-prs-merged" as const },
      },
      name: "When required PRs merge, mark Work Completed",
    }));
    const client = createClient({ createRequiredPrMergeRule });

    const created = await client.createWorkAutomationRequiredPrMergeRule({
      baseRevision: 0,
      clientIdempotencyKey: "key-5",
      projectId: "project-1",
    });

    expect(created.enabled).toBe(false);
    expect(createRequiredPrMergeRule).toHaveBeenCalledWith(
      "account-1",
      "project-1",
    );
  });
});
