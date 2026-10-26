import type { Context } from "@cantiara/api/context";
import { appRouter } from "@cantiara/api/routers/index";
import {
  deriveValueChain,
  type ValueChainAccess,
} from "@cantiara/api/value-chain";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test } from "vitest";

const ACCOUNT = "account-1";
const VALUE_CHAIN_PROCEDURE = /valuechain/i;

function setup(authenticated = true) {
  const access: ValueChainAccess = {
    chain: (accountId, input) =>
      Promise.resolve(
        accountId === ACCOUNT && input.goalId === "goal-1"
          ? deriveValueChain({
              associations: [],
              edges: [
                {
                  child: { id: "work-1", type: "Work" },
                  parent: { id: "goal-1", type: "Project Goal" },
                  relation: { id: "r1", label: "Contributes to Goal" },
                },
              ],
              goal: { id: "goal-1", title: "Goal", unavailable: null },
              nodes: [
                {
                  id: "work-1",
                  status: "Open",
                  title: "Work",
                  type: "Work",
                  unavailable: null,
                },
              ],
            })
          : null,
      ),
  };
  const context = {
    session: authenticated
      ? { session: { id: "session" }, user: { id: ACCOUNT } }
      : null,
    valueChain: access,
  } as unknown as Context;
  return createRouterClient(appRouter, { context });
}

describe("Value Chain RPC seam", () => {
  test("serves the derived chain to the signed-in account", async () => {
    const chain = await setup().projectValueChain({
      goalId: "goal-1",
      projectId: "project-1",
    });
    expect(chain.branches.map((branch) => branch.id)).toEqual(["work-1"]);
  });

  test("answers NOT_FOUND for a missing Goal and refuses a signed-out caller", async () => {
    await expect(
      setup().projectValueChain({ goalId: "nope", projectId: "project-1" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      setup(false).projectValueChain({
        goalId: "goal-1",
        projectId: "project-1",
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  test("refuses unknown input fields and exposes only one read procedure", async () => {
    await expect(
      setup().projectValueChain({
        goalId: "goal-1",
        health: "good",
        projectId: "project-1",
      } as never),
    ).rejects.toBeTruthy();
    expect(
      Object.keys(appRouter).filter((name) => VALUE_CHAIN_PROCEDURE.test(name)),
    ).toEqual(["projectValueChain"]);
  });
});
