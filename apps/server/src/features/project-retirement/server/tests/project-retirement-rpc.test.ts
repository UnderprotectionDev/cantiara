import type { Context } from "@cantiara/api/context";
import type { RetirementProject } from "@cantiara/api/project-retirement";
import { appRouter } from "@cantiara/api/routers/index";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test } from "vitest";

import { createProjectRetirement } from "../project-retirement";

const ACCOUNT = "account-1";
const RETIREMENT_PROCEDURE =
  /archiveProject|ArchivedProjects|ArchiveProject|^(preview)?(D|d)eleteProject$/;
const PROJECT_DELETE_PROCEDURE = /^(trash|restore)Project$/i;

function setup(authenticated = true) {
  let current: RetirementProject = {
    archivedAt: null,
    id: "project-1",
    name: "Atlas",
    revision: 0,
    shortCode: "ATL",
    status: "Abandoned",
  };
  const retirement = createProjectRetirement({
    deleteGroup: {
      members: () => Promise.resolve([]),
      relations: () => Promise.resolve([]),
      revokeSurface: () => Promise.resolve(null),
    },
    trash: { moveGroup: () => Promise.resolve(null) },
    inFlight: () => Promise.resolve([]),
    integrations: () => Promise.resolve([]),
    store: {
      find: (_account, id) =>
        Promise.resolve(id === current.id ? current : null),
      listArchived: () => Promise.resolve(current.archivedAt ? [current] : []),
      transition: (_account, input) => {
        if (input.baseRevision !== current.revision) {
          return Promise.reject(
            Object.assign(new Error("stale"), {
              code: "STALE_BASE_REVISION",
              currentRevision: current.revision,
            }),
          );
        }
        current = {
          ...current,
          archivedAt: input.archived ? "2026-11-02T00:00:00.000Z" : null,
          revision: current.revision + 1,
        };
        return Promise.resolve(current);
      },
    },
    surfaces: () => Promise.resolve([]),
  });
  const context = {
    projectRetirement: retirement,
    session: authenticated
      ? { session: { id: "session" }, user: { id: ACCOUNT } }
      : null,
  } as unknown as Context;
  return createRouterClient(appRouter, { context });
}

describe("Project Retirement RPC seam", () => {
  test("exposes archive, delete-from-archive, preview, list and unarchive, and no Trash or restore shortcut", () => {
    const names = Object.keys(appRouter).filter((name) =>
      RETIREMENT_PROCEDURE.test(name),
    );
    expect(names.sort()).toEqual([
      "archiveProject",
      "deleteProject",
      "listArchivedProjects",
      "previewArchiveProject",
      "previewDeleteProject",
      "unarchiveProject",
    ]);
    expect(
      Object.keys(appRouter).some((name) =>
        PROJECT_DELETE_PROCEDURE.test(name),
      ),
    ).toBe(false);
  });

  test("answers delete of an Active Project as CONFLICT and rejects Keep approved surface", async () => {
    const client = setup();
    await expect(
      client.deleteProject({
        baseRevision: 0,
        clientIdempotencyKey: "k-del",
        projectId: "project-1",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      client.deleteProject({
        baseRevision: 0,
        clientIdempotencyKey: "k-keep",
        projectId: "project-1",
        surfaceDisposition: "keep",
      } as never),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  test("archives, lists, and unarchives while the status stays Abandoned", async () => {
    const client = setup();
    const archived = await client.archiveProject({
      baseRevision: 0,
      clientIdempotencyKey: "k-1",
      projectId: "project-1",
    });
    expect(archived.status).toBe("Abandoned");
    expect((await client.listArchivedProjects({})).projects).toHaveLength(1);

    const restored = await client.unarchiveProject({
      baseRevision: 1,
      clientIdempotencyKey: "k-2",
      projectId: "project-1",
    });
    expect(restored.archivedAt).toBeNull();
    expect(restored.status).toBe("Abandoned");
  });

  test("answers a stale base revision as PRECONDITION_FAILED and a second archive as CONFLICT", async () => {
    const client = setup();
    await expect(
      client.archiveProject({
        baseRevision: 9,
        clientIdempotencyKey: "k-stale",
        projectId: "project-1",
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });

    await client.archiveProject({
      baseRevision: 0,
      clientIdempotencyKey: "k-1",
      projectId: "project-1",
    });
    await expect(
      client.archiveProject({
        baseRevision: 1,
        clientIdempotencyKey: "k-2",
        projectId: "project-1",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  test("answers an unknown Project as NOT_FOUND and a signed-out caller as UNAUTHORIZED", async () => {
    await expect(
      setup().previewArchiveProject({ projectId: "missing" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(setup(false).listArchivedProjects({})).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});
