import type { CaptureInboxItem } from "@cantiara/api/capture-triage";
import type {
  WorkLifecycleAccess,
  WorkProfile,
} from "@cantiara/api/work-lifecycle";
import { describe, expect, test, vi } from "vitest";

import { createCaptureInboxWorkCreate } from "./capture-work-create";

const capture: CaptureInboxItem = {
  attachment: { id: "staging-1", name: "screenshot.png" },
  content: "The preview is blank",
  createdAt: "2026-09-16T09:00:00.000Z",
  fields: { "Observed Behavior": "Blank" },
  id: "capture-1",
  link: "https://example.com/issue",
  origin: { kind: "Web Capture", url: "https://example.com/issue" },
  projectId: "project-1",
  template: "Bug Capture",
};

describe("Capture Inbox Work adapter", () => {
  test("hands conversion provenance to Work Lifecycle", async () => {
    const create = vi.fn().mockResolvedValue({
      id: "work-1",
    } as WorkProfile);
    const workLifecycle = { create } as unknown as WorkLifecycleAccess;
    const adapter = createCaptureInboxWorkCreate(workLifecycle);

    if (!adapter.createWork) {
      throw new Error("Expected Capture Inbox Work creation to be available.");
    }

    await expect(
      adapter.createWork({
        accountId: "account-1",
        clientIdempotencyKey: "convert-1",
        fields: capture.fields,
        item: capture,
        projectId: capture.projectId,
        recordType: "Work",
        title: "The preview is blank",
      }),
    ).resolves.toEqual({ id: "work-1", recordType: "Work" });

    expect(create).toHaveBeenCalledWith("account-1", {
      baseRevision: 0,
      captureProvenance: {
        attachment: capture.attachment,
        captureId: capture.id,
        capturedAt: capture.createdAt,
        content: capture.content,
        fields: capture.fields,
        link: capture.link,
        origin: capture.origin,
        template: capture.template,
      },
      clientIdempotencyKey: "convert-1",
      projectId: "project-1",
      title: "The preview is blank",
      type: "Task",
    });
  });

  test("requires a target Project for Workspace Work conversion", async () => {
    const create = vi.fn();
    const workLifecycle = { create } as unknown as WorkLifecycleAccess;
    const adapter = createCaptureInboxWorkCreate(workLifecycle);

    if (!adapter.createWork) {
      throw new Error("Expected Capture Inbox Work creation to be available.");
    }

    await expect(
      adapter.createWork({
        accountId: "account-1",
        clientIdempotencyKey: "convert-workspace",
        fields: {},
        item: { ...capture, projectId: null },
        projectId: null,
        recordType: "Work",
        title: capture.content,
      }),
    ).rejects.toMatchObject({ code: "PROJECT_REQUIRED_FOR_WORK_CONVERSION" });
    expect(create).not.toHaveBeenCalled();
  });
});
