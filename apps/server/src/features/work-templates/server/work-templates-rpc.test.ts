import type { Context } from "@cantiara/api/context";
import { appRouter } from "@cantiara/api/routers/index";
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import type {
  WorkTemplate,
  WorkTemplatesAccess,
} from "@cantiara/api/work-templates";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test, vi } from "vitest";

const template: WorkTemplate = {
  checklist: [{ id: "check-1", text: "Draft release notes" }],
  createdAt: "2026-09-22T09:00:00.000Z",
  customFieldDefaults: [],
  descriptionSkeleton: "## Outcome",
  id: "template-1",
  name: "Release preparation",
  projectId: "project-1",
  relativeDates: { target: { offsetDays: 10 } },
  revision: 1,
  trashedAt: null,
  type: "Task",
  updatedAt: "2026-09-22T09:00:00.000Z",
};

const instantiatedWork: WorkProfile = {
  archivedAt: null,
  captureProvenance: null,
  checklist: [{ completed: false, id: "check-1", text: "Draft release notes" }],
  closureReason: null,
  closureResult: null,
  createdAt: "2026-09-22T09:05:00.000Z",
  description: "## Outcome",
  effort: null,
  featureHealthHistory: [],
  id: "work-1",
  key: "CAT-1",
  number: 1,
  primaryFeatureId: null,
  primarySpecId: null,
  projectId: "project-1",
  recreatedFrom: null,
  revision: 1,
  status: "Not Started",
  targetDate: "2026-10-02",
  title: "Prepare the October release",
  type: "Task",
  updatedAt: "2026-09-22T09:05:00.000Z",
};

function createContext(workTemplates: WorkTemplatesAccess): Context {
  return {
    accountAccess: {
      listSessions: async () => [],
      revokeOtherSessions: async () => undefined,
      revokeSession: async () => undefined,
    },
    accountPreferences: {
      get: () => Promise.reject(new Error("Not part of this test.")),
    },
    auth: null,
    db: {} as Context["db"],
    githubAvailability: { getStatus: () => "available" },
    session: {
      session: { id: "session-1" },
      user: { id: "account-1" },
    } as Context["session"],
    workTemplates,
  };
}

describe("Work Templates RPC", () => {
  test("defines, edits, lists, and trashes Project Work Templates", async () => {
    const access: WorkTemplatesAccess = {
      create: vi.fn().mockResolvedValue(template),
      instantiate: vi.fn().mockResolvedValue(instantiatedWork),
      list: vi.fn().mockResolvedValue([template]),
      trash: vi.fn().mockResolvedValue({
        ...template,
        revision: 3,
        trashedAt: template.updatedAt,
      }),
      update: vi.fn().mockResolvedValue({
        ...template,
        name: "Launch preparation",
        revision: 2,
      }),
    };
    const client = createRouterClient(appRouter, {
      context: createContext(access),
    });

    await expect(
      client.createWorkTemplate({
        baseRevision: 0,
        checklist: template.checklist,
        clientIdempotencyKey: "create-template-1",
        customFieldDefaults: [],
        descriptionSkeleton: template.descriptionSkeleton,
        name: template.name,
        projectId: template.projectId,
        relativeDates: template.relativeDates,
        type: template.type,
      }),
    ).resolves.toEqual(template);
    await expect(
      client.instantiateWorkTemplate({
        baseRevision: template.revision,
        clientIdempotencyKey: "instantiate-template-1",
        createDate: "2026-09-22",
        templateId: template.id,
        title: instantiatedWork.title,
      }),
    ).resolves.toEqual(instantiatedWork);
    await expect(
      client.workTemplates({ projectId: template.projectId }),
    ).resolves.toEqual([template]);
    await expect(
      client.updateWorkTemplate({
        baseRevision: 1,
        checklist: template.checklist,
        clientIdempotencyKey: "update-template-1",
        customFieldDefaults: [],
        descriptionSkeleton: template.descriptionSkeleton,
        name: "Launch preparation",
        relativeDates: template.relativeDates,
        templateId: template.id,
        type: template.type,
      }),
    ).resolves.toMatchObject({ name: "Launch preparation", revision: 2 });
    await expect(
      client.trashWorkTemplate({
        baseRevision: 2,
        clientIdempotencyKey: "trash-template-1",
        templateId: template.id,
      }),
    ).resolves.toMatchObject({ revision: 3, trashedAt: template.updatedAt });

    expect(access.create).toHaveBeenCalledWith("account-1", {
      checklist: template.checklist,
      customFieldDefaults: [],
      descriptionSkeleton: template.descriptionSkeleton,
      name: template.name,
      projectId: template.projectId,
      relativeDates: template.relativeDates,
      type: template.type,
    });
    expect(access.instantiate).toHaveBeenCalledWith("account-1", {
      baseRevision: template.revision,
      clientIdempotencyKey: "instantiate-template-1",
      createDate: "2026-09-22",
      templateId: template.id,
      title: instantiatedWork.title,
    });
    expect(access.update).toHaveBeenCalledWith(
      "account-1",
      template.id,
      1,
      expect.objectContaining({ name: "Launch preparation" }),
    );
    expect(access.trash).toHaveBeenCalledWith("account-1", template.id, 2);
  });

  test("maps Work Template domain errors onto the shared error contract", async () => {
    const failing: WorkTemplatesAccess = {
      create: () => {
        throw Object.assign(
          new Error(
            "A Work Template named Release preparation already exists in this Project.",
          ),
          { code: "WORK_TEMPLATE_NAME_CONFLICT" },
        );
      },
      instantiate: () => {
        throw Object.assign(new Error("Work creation could not be applied."), {
          cause: {
            code: "WORK_TEMPLATE_STALE_REVISION",
            message: "Work Template changed after this command started.",
          },
          code: "APPLY_FAILED",
        });
      },
      list: async () => [template],
      trash: () => {
        throw Object.assign(
          new Error("Work Template changed after this command started."),
          { code: "WORK_TEMPLATE_STALE_REVISION" },
        );
      },
      update: () => {
        throw Object.assign(
          new Error(
            "Custom field field-1 is unavailable for this Work Template.",
          ),
          { code: "WORK_TEMPLATE_CUSTOM_FIELD_UNAVAILABLE" },
        );
      },
    };
    const client = createRouterClient(appRouter, {
      context: createContext(failing),
    });

    await expect(
      client.createWorkTemplate({
        baseRevision: 0,
        checklist: [],
        clientIdempotencyKey: "conflict-create",
        customFieldDefaults: [],
        descriptionSkeleton: null,
        name: template.name,
        projectId: template.projectId,
        relativeDates: {},
        type: "Task",
      }),
    ).rejects.toThrow(
      "A Work Template named Release preparation already exists in this Project.",
    );
    await expect(
      client.instantiateWorkTemplate({
        baseRevision: template.revision,
        clientIdempotencyKey: "stale-instantiate",
        createDate: "2026-09-22",
        templateId: template.id,
        title: instantiatedWork.title,
      }),
    ).rejects.toThrow("Work Template changed. Reload and try again.");
    await expect(
      client.updateWorkTemplate({
        baseRevision: 1,
        checklist: [],
        clientIdempotencyKey: "unavailable-field-update",
        customFieldDefaults: [],
        descriptionSkeleton: null,
        name: template.name,
        relativeDates: {},
        templateId: template.id,
        type: "Task",
      }),
    ).rejects.toThrow(
      "Custom field field-1 is unavailable for this Work Template.",
    );
    await expect(
      client.trashWorkTemplate({
        baseRevision: 1,
        clientIdempotencyKey: "stale-trash",
        templateId: template.id,
      }),
    ).rejects.toThrow("Work Template changed. Reload and try again.");

    let staleErrorCode: string | undefined;
    try {
      await client.trashWorkTemplate({
        baseRevision: 1,
        clientIdempotencyKey: "stale-trash-status",
        templateId: template.id,
      });
    } catch (error) {
      staleErrorCode = (error as { code?: string }).code;
    }
    expect(staleErrorCode).toBe("PRECONDITION_FAILED");
  });

  test("maps a changed-payload instantiate retry to CONFLICT", async () => {
    const access: WorkTemplatesAccess = {
      create: vi.fn(),
      instantiate: () => {
        throw Object.assign(new Error("Work creation payload changed."), {
          code: "WORK_CREATION_CONFLICT",
        });
      },
      list: vi.fn(),
      trash: vi.fn(),
      update: vi.fn(),
    };
    const client = createRouterClient(appRouter, {
      context: createContext(access),
    });

    let errorCode: string | undefined;
    try {
      await client.instantiateWorkTemplate({
        baseRevision: template.revision,
        clientIdempotencyKey: "changed-payload-retry",
        createDate: "2026-09-22",
        templateId: template.id,
        title: "Changed retry title",
      });
    } catch (error) {
      errorCode = (error as { code?: string }).code;
    }
    expect(errorCode).toBe("CONFLICT");
  });
});
