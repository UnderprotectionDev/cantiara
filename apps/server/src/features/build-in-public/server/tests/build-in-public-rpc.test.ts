import {
  type BuildInPublicAccess,
  BuildInPublicError,
} from "@cantiara/api/build-in-public";
import type { Context } from "@cantiara/api/context";
import { appRouter } from "@cantiara/api/routers/index";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test, vi } from "vitest";

function createClient(access: Partial<BuildInPublicAccess>) {
  const context = {
    auth: null,
    buildInPublic: access as BuildInPublicAccess,
    db: {} as Context["db"],
    githubAvailability: { getStatus: () => "available" },
    session: {
      session: { id: "session-1" },
      user: { id: "account-1" },
    } as Context["session"],
  } as Context;
  return createRouterClient(appRouter, { context });
}

const envelope = { baseRevision: 1, clientIdempotencyKey: "key-1" };
const approveInput = {
  ...envelope,
  approval: {
    approvedItemIds: ["work:work-1"],
    fingerprint: "fp",
    publishAnyway: false,
  },
  projectId: "project-1",
};

describe("Build in Public RPC", () => {
  test("approves as the signed-in User without the mutation envelope", async () => {
    const approve = vi.fn(async () => ({ revision: 1 }) as never);
    await createClient({ approve }).approveBuildInPublic(approveInput);

    expect(approve).toHaveBeenCalledWith("account-1", {
      approval: approveInput.approval,
      projectId: "project-1",
    });
  });

  test("maps typed errors to RPC status codes", async () => {
    const cases = [
      ["BUILD_IN_PUBLIC_DISABLED", "PRECONDITION_FAILED"],
      ["BUILD_IN_PUBLIC_PREVIEW_STALE", "PRECONDITION_FAILED"],
      ["BUILD_IN_PUBLIC_LABEL_REQUIRED", "CONFLICT"],
      ["BUILD_IN_PUBLIC_PLACEHOLDERS_UNRESOLVED", "CONFLICT"],
    ] as const;
    await Promise.all(
      cases.map(([code, status]) => {
        const client = createClient({
          approve: () => {
            throw new BuildInPublicError(code);
          },
        });
        return expect(
          client.approveBuildInPublic(approveInput),
        ).rejects.toMatchObject({ code: status });
      }),
    );
  });

  test("an unavailable Project is NOT_FOUND", async () => {
    const client = createClient({
      preview: async () => null,
      settings: async () => null,
    });
    await expect(
      client.previewBuildInPublic({ projectId: "none" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      client.buildInPublicSettings({ projectId: "none" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("refuses an internal status name as a Public Status Label", async () => {
    const setWorkCopy = vi.fn();
    await expect(
      createClient({ setWorkCopy }).setBuildInPublicWorkCopy({
        ...envelope,
        projectId: "project-1",
        publicStatusLabel: "Blocked",
        publicSummary: null,
        publicTitle: null,
        workId: "work-1",
      }),
    ).rejects.toBeDefined();
    expect(setWorkCopy).not.toHaveBeenCalled();
  });

  test("rejects an unknown approval field", async () => {
    const approve = vi.fn();
    await expect(
      createClient({ approve }).approveBuildInPublic({
        ...approveInput,
        approval: { ...approveInput.approval, slug: "x" },
      } as never),
    ).rejects.toBeDefined();
    expect(approve).not.toHaveBeenCalled();
  });
});
