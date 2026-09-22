import type { Context } from "@cantiara/api/context";
import { appRouter } from "@cantiara/api/routers/index";
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import type {
  WorkDuplicatePreview,
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

const duplicatePreview: WorkDuplicatePreview = {
  customFields: [],
  fields: [
    {
      key: "title",
      label: "Title",
      selectedByDefault: true,
      value: "Prepare launch",
    },
  ],
  previewId: "duplicate-preview-1",
  sourceWork: {
    id: "work-1",
    key: "REL-1",
    revision: 3,
    title: "Prepare launch",
  },
};

const duplicatedWork: WorkProfile = {
  archivedAt: null,
  captureProvenance: null,
  checklist: [],
  closureReason: null,
  closureResult: null,
  createdAt: "2026-09-22T09:00:00.000Z",
  description: null,
  effort: null,
  featureHealthHistory: [],
  id: "work-2",
  key: "REL-2",
  number: 2,
  primaryFeatureId: null,
  primarySpecId: null,
  projectId: "project-1",
  recreatedFrom: null,
  revision: 1,
  status: "Not Started",
  targetDate: null,
  title: "Prepare launch",
  type: "Task",
  updatedAt: "2026-09-22T09:00:00.000Z",
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
      duplicate: vi.fn().mockResolvedValue(duplicatedWork),
      list: vi.fn().mockResolvedValue([template]),
      previewDuplicate: vi.fn().mockResolvedValue(duplicatePreview),
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
    await expect(
      client.workDuplicatePreview({ sourceWorkId: "work-1" }),
    ).resolves.toEqual(duplicatePreview);
    await expect(
      client.duplicateWork({
        baseRevision: 0,
        clientIdempotencyKey: "duplicate-work-1",
        previewId: duplicatePreview.previewId,
        selectedCustomFieldIds: [],
        selectedFields: ["title"],
        sourceWorkId: "work-1",
      }),
    ).resolves.toEqual(duplicatedWork);

    expect(access.create).toHaveBeenCalledWith("account-1", {
      checklist: template.checklist,
      customFieldDefaults: [],
      descriptionSkeleton: template.descriptionSkeleton,
      name: template.name,
      projectId: template.projectId,
      relativeDates: template.relativeDates,
      type: template.type,
    });
    expect(access.update).toHaveBeenCalledWith(
      "account-1",
      template.id,
      1,
      expect.objectContaining({ name: "Launch preparation" }),
    );
    expect(access.trash).toHaveBeenCalledWith("account-1", template.id, 2);
    expect(access.previewDuplicate).toHaveBeenCalledWith("account-1", "work-1");
    expect(access.duplicate).toHaveBeenCalledWith(
      "account-1",
      expect.objectContaining({ previewId: duplicatePreview.previewId }),
    );
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
      duplicate: () => {
        throw Object.assign(
          new Error("A current Duplicate Work preview is required."),
          { code: "WORK_DUPLICATE_PREVIEW_REQUIRED" },
        );
      },
      list: async () => [template],
      previewDuplicate: async () => duplicatePreview,
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

    await expect(
      client.duplicateWork({
        baseRevision: 0,
        clientIdempotencyKey: "stale-duplicate",
        previewId: duplicatePreview.previewId,
        selectedCustomFieldIds: [],
        selectedFields: ["title"],
        sourceWorkId: "work-1",
      }),
    ).rejects.toThrow("Duplicate Work preview changed. Preview and try again.");
  });
});
