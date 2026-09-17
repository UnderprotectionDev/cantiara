import {
  CAPTURE_TEMPLATE_FIELD_LABELS,
  type CaptureInboxItem,
} from "@cantiara/api/capture-triage";
import { describe, expect, test, vi } from "vitest";

import { type CaptureInboxStore, createCaptureInbox } from "./capture-inbox";

function createMemoryStore(initial: CaptureInboxItem[] = []) {
  const itemsByAccount = new Map([["account-1", [...initial]]]);
  let nextId = initial.length + 1;

  const store: CaptureInboxStore = {
    list: (accountId) => Promise.resolve(itemsByAccount.get(accountId) ?? []),
    insert: (accountId, input) => {
      const items = itemsByAccount.get(accountId) ?? [];
      itemsByAccount.set(accountId, items);
      const id = `capture-${nextId}`;
      nextId += 1;
      const item: CaptureInboxItem = {
        content: input.content,
        createdAt: "2026-09-16T09:00:00.000Z",
        fields: input.fields,
        id,
        projectId: input.projectId,
        template: input.template,
      };
      items.push(item);
      return Promise.resolve(item);
    },
  };

  return { items: itemsByAccount.get("account-1") ?? [], store };
}

describe("Capture Inbox seam", () => {
  test("saves freeform text to the Workspace Capture Inbox without a main record", async () => {
    const { items, store } = createMemoryStore();
    const workCreate = { createBug: vi.fn() };
    const captureInbox = createCaptureInbox({ store, workCreate });

    const saved = await captureInbox.create("account-1", {
      content: "Investigate the slow preview",
    });
    const inbox = await captureInbox.list("account-1");

    expect(saved).toMatchObject({
      content: "Investigate the slow preview",
      fields: {},
      projectId: null,
      template: null,
    });
    expect(items).toHaveLength(1);
    expect(workCreate.createBug).not.toHaveBeenCalled();
    expect(inbox.groups).toEqual([
      expect.objectContaining({
        itemIds: [saved.id],
        kind: "workspace",
        label: "Workspace Capture Inbox",
      }),
    ]);
    expect(saved).not.toHaveProperty("expiresAt");
  });

  test("keeps every mini-template field optional and closed to its catalog", async () => {
    const { store } = createMemoryStore();
    const captureInbox = createCaptureInbox({
      store,
      workCreate: { createBug: vi.fn() },
    });

    await expect(
      captureInbox.create("account-1", {
        content: "",
        fields: { "Observed Behavior": "Only this field is known" },
        template: "Bug Capture",
      }),
    ).resolves.toMatchObject({
      fields: { "Observed Behavior": "Only this field is known" },
      template: "Bug Capture",
    });
    await expect(
      captureInbox.create("account-1", {
        content: "Customer quote",
        template: "Feedback Capture",
      }),
    ).resolves.toMatchObject({ fields: {}, template: "Feedback Capture" });
    await expect(
      captureInbox.create("account-1", {
        content: "A paper to revisit",
        fields: { "Source Context": "Search notes" },
        template: "Research Fragment",
      }),
    ).resolves.toMatchObject({
      fields: { "Source Context": "Search notes" },
      template: "Research Fragment",
    });

    expect(CAPTURE_TEMPLATE_FIELD_LABELS).toEqual({
      "Bug Capture": [
        "Observed Behavior",
        "Expected Behavior",
        "Reproduction Context",
      ],
      "Feedback Capture": ["Feedback", "Channel", "Contact"],
      "Research Fragment": ["Note or Excerpt", "Source Context"],
    });
    await expect(
      captureInbox.create("account-1", {
        content: "Wrong field",
        fields: { Channel: "email" },
        template: "Bug Capture",
      }),
    ).rejects.toMatchObject({ code: "UNKNOWN_CAPTURE_FIELD" });
  });

  test("keeps Project captures grouped and does not delete them as time advances", async () => {
    const { store } = createMemoryStore([
      {
        content: "Old project note",
        createdAt: "2020-01-01T00:00:00.000Z",
        fields: {},
        id: "capture-old",
        projectId: "cantiara",
        template: null,
      },
    ]);
    const captureInbox = createCaptureInbox({
      store,
      workCreate: { createBug: vi.fn() },
    });

    const inbox = await captureInbox.list("account-1");

    expect(inbox.items).toHaveLength(1);
    expect(inbox.groups[0]).toMatchObject({
      itemIds: ["capture-old"],
      kind: "project",
      label: "Project Capture Inbox",
      projectId: "cantiara",
    });
  });

  test("does not expose one account's captures to another account", async () => {
    const { store } = createMemoryStore([
      {
        content: "Private workspace thought",
        createdAt: "2026-09-16T09:00:00.000Z",
        fields: {},
        id: "capture-private",
        projectId: null,
        template: null,
      },
    ]);
    const captureInbox = createCaptureInbox({
      store,
      workCreate: { createBug: vi.fn() },
    });

    await expect(captureInbox.list("account-2")).resolves.toEqual({
      groups: [],
      items: [],
    });
  });

  test("groups Project captures without requiring matching capitalization", async () => {
    const { store } = createMemoryStore([
      {
        content: "First project note",
        createdAt: "2026-09-16T09:00:00.000Z",
        fields: {},
        id: "capture-first",
        projectId: "Cantiara",
        template: null,
      },
      {
        content: "Second project note",
        createdAt: "2026-09-16T09:01:00.000Z",
        fields: {},
        id: "capture-second",
        projectId: "cantiara",
        template: null,
      },
    ]);
    const captureInbox = createCaptureInbox({
      store,
      workCreate: { createBug: vi.fn() },
    });

    const inbox = await captureInbox.list("account-1");

    expect(inbox.groups).toHaveLength(1);
    expect(inbox.groups[0]?.items).toHaveLength(2);
  });

  test("calls Work create directly for an eligible Create Bug without leaving an Inbox item", async () => {
    const { items, store } = createMemoryStore();
    const createBug = vi.fn().mockResolvedValue({ workId: "work-1" });
    const captureInbox = createCaptureInbox({
      store,
      workCreate: { createBug },
    });

    const result = await captureInbox.createBug("account-1", {
      content: "Preview is blank after refresh",
      fields: { "Observed Behavior": "Blank screen" },
      projectId: "project-1",
      template: "Bug Capture",
    });

    expect(result).toEqual({ workId: "work-1" });
    expect(createBug).toHaveBeenCalledWith({
      accountId: "account-1",
      content: "Preview is blank after refresh",
      fields: { "Observed Behavior": "Blank screen" },
      projectId: "project-1",
      template: "Bug Capture",
    });
    expect(items).toEqual([]);
  });

  test("calls Work create directly when a Project is set without a template", async () => {
    const { items, store } = createMemoryStore();
    const createBug = vi.fn().mockResolvedValue({});
    const captureInbox = createCaptureInbox({
      store,
      workCreate: { createBug },
    });

    await captureInbox.createBug("account-1", {
      content: "Project-specific bug without a chosen type",
      projectId: "project-1",
    });

    expect(createBug).toHaveBeenCalledWith({
      accountId: "account-1",
      content: "Project-specific bug without a chosen type",
      fields: {},
      projectId: "project-1",
      template: null,
    });
    expect(items).toEqual([]);
  });

  test("refuses Create Bug when Project or type is not eligible", async () => {
    const { items, store } = createMemoryStore();
    const createBug = vi.fn();
    const captureInbox = createCaptureInbox({
      store,
      workCreate: { createBug },
    });

    await expect(
      captureInbox.createBug("account-1", {
        content: "No project yet",
      }),
    ).rejects.toMatchObject({ code: "PROJECT_REQUIRED_FOR_CREATE_BUG" });
    await expect(
      captureInbox.createBug("account-1", {
        content: "Feedback is not a Bug",
        projectId: "project-1",
        template: "Feedback Capture",
      }),
    ).rejects.toMatchObject({ code: "CREATE_BUG_TEMPLATE_UNSUPPORTED" });

    expect(createBug).not.toHaveBeenCalled();
    expect(items).toEqual([]);
  });
});
