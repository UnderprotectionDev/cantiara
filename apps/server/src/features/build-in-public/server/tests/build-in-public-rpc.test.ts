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

  test("publication management runs as the signed-in User and maps its errors", async () => {
    const unpublish = vi.fn(async () => ({ published: false }) as never);
    await createClient({ unpublish }).unpublishBuildInPublic({
      ...envelope,
      projectId: "project-1",
    });
    expect(unpublish).toHaveBeenCalledWith("account-1", "project-1");

    const cases = [
      ["BUILD_IN_PUBLIC_SLUG_TAKEN", "CONFLICT"],
      ["BUILD_IN_PUBLIC_REDIRECT_UNCONFIRMED", "PRECONDITION_FAILED"],
    ] as const;
    await Promise.all(
      cases.map(([code, status]) =>
        expect(
          createClient({
            setSlug: () => {
              throw new BuildInPublicError(code);
            },
          }).setBuildInPublicSlug({
            ...envelope,
            confirmRedirect: false,
            projectId: "project-1",
            slug: "launch",
          }),
        ).rejects.toMatchObject({ code: status }),
      ),
    );
    await expect(
      createClient({}).setBuildInPublicSlug({
        ...envelope,
        confirmRedirect: true,
        projectId: "project-1",
        slug: "roadmap",
      }),
    ).rejects.toBeDefined();
  });

  test("approval accepts a featured record and refuses unknown fields", async () => {
    const approve = vi.fn(async () => ({ revision: 2 }) as never);
    const featured = {
      endsAt: "2027-01-01T00:00:00.000Z",
      recordId: "release-1",
    };
    await createClient({ approve }).approveBuildInPublic({
      ...approveInput,
      approval: { ...approveInput.approval, featured },
    });
    expect(approve).toHaveBeenCalledWith("account-1", {
      approval: { ...approveInput.approval, featured },
      projectId: "project-1",
    });
  });

  test("Publish/share anyway must be sent explicitly; scope approval never implies it", async () => {
    const approve = vi.fn();
    const { publishAnyway: _omitted, ...withoutAnyway } = approveInput.approval;
    await expect(
      createClient({ approve }).approveBuildInPublic({
        ...approveInput,
        approval: withoutAnyway,
      } as never),
    ).rejects.toBeDefined();
    expect(approve).not.toHaveBeenCalled();
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
