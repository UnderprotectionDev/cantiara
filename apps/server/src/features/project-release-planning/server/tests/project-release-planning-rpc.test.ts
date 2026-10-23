import type { Context } from "@cantiara/api/context";
import {
  type ProjectReleasePlanningAccess,
  ProjectReleasePlanningConflictError,
} from "@cantiara/api/project-release-planning";
import { appRouter } from "@cantiara/api/routers/index";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test, vi } from "vitest";

// Planning RPCs only; Release Evidence (spec 64) owns the Evidence Pack and scope signal RPCs.
const PROJECT_RELEASE_RPC = /ProjectRelease(?!Evidence|OpenScopeSignal)/i;

function setup(authenticated = true) {
  const projectReleasePlanning: ProjectReleasePlanningAccess = {
    detail: vi.fn().mockResolvedValue({ release: { id: "release-1" } }),
    overview: vi.fn().mockResolvedValue({ readOnly: false, releases: [] }),
    setAudience: vi.fn().mockResolvedValue({ id: "audience-1" }),
    setLink: vi.fn().mockResolvedValue({ id: "link-1" }),
    setScope: vi.fn().mockResolvedValue({ id: "scope-1" }),
  };
  const context = {
    projectReleasePlanning,
    session: authenticated
      ? { session: { id: "session" }, user: { id: "founder" } }
      : null,
  } as Context;
  return {
    client: createRouterClient(appRouter, { context }),
    projectReleasePlanning,
  };
}

const scope = {
  attached: true,
  baseRevision: 0,
  clientIdempotencyKey: "scope-add",
  projectId: "project-1",
  releaseId: "release-1",
  workId: "work-1",
};
const link = {
  attached: true,
  baseRevision: 0,
  clientIdempotencyKey: "link-add",
  kind: "Release" as const,
  label: "v1.1.0",
  projectId: "project-1",
  releaseId: "release-1",
  repositoryLinkId: "repository-1",
  url: "https://github.com/acme/tidekit/releases/tag/v1.1.0",
};
const audience = {
  attached: true,
  baseRevision: 0,
  clientIdempotencyKey: "audience-add",
  projectId: "project-1",
  releaseId: "release-1",
  targetId: "persona-1",
  targetType: "Persona" as const,
};

describe("Project Release Planning RPC seam", () => {
  test("reads the overview and Planning detail for the authenticated account", async () => {
    const { client, projectReleasePlanning } = setup();
    await client.projectReleases({ projectId: "project-1" });
    expect(projectReleasePlanning.overview).toHaveBeenCalledWith(
      "founder",
      "project-1",
    );
    await client.projectReleasePlanning({
      projectId: "project-1",
      releaseId: "release-1",
    });
    expect(projectReleasePlanning.detail).toHaveBeenCalledWith("founder", {
      projectId: "project-1",
      releaseId: "release-1",
    });
  });

  test("passes scope, link and audience commands through unchanged", async () => {
    const { client, projectReleasePlanning } = setup();
    await client.setProjectReleaseScope(scope);
    expect(projectReleasePlanning.setScope).toHaveBeenCalledWith(
      "founder",
      scope,
    );
    await client.setProjectReleaseLink(link);
    expect(projectReleasePlanning.setLink).toHaveBeenCalledWith(
      "founder",
      link,
    );
    await client.setProjectReleaseAudience(audience);
    expect(projectReleasePlanning.setAudience).toHaveBeenCalledWith(
      "founder",
      audience,
    );
  });

  test("exposes the GitHub Release suggestion read-only: no planning RPC writes a status", async () => {
    const suggestion = {
      linkId: "link-1",
      reason: "GitHub Release v1.0.0 was published.",
      status: "Published",
    };
    const { client, projectReleasePlanning } = setup();
    vi.mocked(projectReleasePlanning.detail).mockResolvedValue({
      release: { id: "release-1", status: "Preparing" },
      suggestion,
    } as never);
    await expect(
      client.projectReleasePlanning({
        projectId: "project-1",
        releaseId: "release-1",
      }),
    ).resolves.toMatchObject({ release: { status: "Preparing" }, suggestion });
    expect(
      Object.keys(appRouter)
        .filter((name) => PROJECT_RELEASE_RPC.test(name))
        .sort(),
    ).toEqual([
      "projectReleasePlanning",
      "projectReleases",
      "setProjectReleaseAudience",
      "setProjectReleaseLink",
      "setProjectReleaseScope",
    ]);
  });

  test("blocks anonymous access before reaching Project Release Planning", async () => {
    const { client, projectReleasePlanning } = setup(false);
    await expect(
      client.projectReleases({ projectId: "project-1" }),
    ).rejects.toThrow();
    await expect(client.setProjectReleaseScope(scope)).rejects.toThrow();
    expect(projectReleasePlanning.overview).not.toHaveBeenCalled();
    expect(projectReleasePlanning.setScope).not.toHaveBeenCalled();
  });

  test("rejects a status, a publish date or a bulk scope fill before the seam", async () => {
    const { client, projectReleasePlanning } = setup();
    await expect(
      client.setProjectReleaseLink({
        ...link,
        status: "Published",
      } as typeof link),
    ).rejects.toThrow();
    await expect(
      client.setProjectReleaseLink({
        ...link,
        publishedAt: "2026-11-01T10:00:00.000Z",
      } as typeof link),
    ).rejects.toThrow();
    await expect(
      client.setProjectReleaseScope({
        ...scope,
        workIds: ["work-1", "work-2"],
      } as typeof scope),
    ).rejects.toThrow();
    expect(projectReleasePlanning.setLink).not.toHaveBeenCalled();
    expect(projectReleasePlanning.setScope).not.toHaveBeenCalled();
  });

  test("reports cross-Project or missing records as NOT_FOUND and stale writes as CONFLICT", async () => {
    const { client, projectReleasePlanning } = setup();
    vi.mocked(projectReleasePlanning.setScope).mockResolvedValue(null);
    await expect(client.setProjectReleaseScope(scope)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    vi.mocked(projectReleasePlanning.detail).mockResolvedValue(null);
    await expect(
      client.projectReleasePlanning({
        projectId: "project-2",
        releaseId: "release-1",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    vi.mocked(projectReleasePlanning.setScope).mockRejectedValue(
      new ProjectReleasePlanningConflictError("scope-1"),
    );
    await expect(client.setProjectReleaseScope(scope)).rejects.toMatchObject({
      code: "CONFLICT",
      data: { code: "CONFLICT", targetId: "release-1" },
    });
  });
});
