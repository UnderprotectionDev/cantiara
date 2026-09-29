import type { Document } from "@cantiara/api/documents";
import { describe, expect, it, vi } from "vitest";

import { createClientShell } from "../../web-macos-client/store/client-shell";
import { createDocumentEditSession } from "./document-edit-session";

const source: Document = {
  id: "document-1",
  projectId: "project-1",
  title: "Architecture",
  type: "General",
  body: "Saved",
  revision: 2,
  createdAt: "2026-09-29T10:00:00.000Z",
  updatedAt: "2026-09-29T10:00:00.000Z",
};

describe("Documents disconnected edit session", () => {
  it("keeps rejected reconnect text separate and never retries an unresolved draft", async () => {
    const shell = createClientShell();
    const draft = {
      id: "draft-1",
      documentId: source.id,
      projectId: source.projectId,
      baseRevision: 2,
      title: source.title,
      type: source.type,
      body: "Rejected",
      createdAt: source.updatedAt,
    };
    const write = vi.fn().mockRejectedValue(
      Object.assign(new Error("Stale base"), {
        data: { conflictDraft: draft },
      }),
    );
    const session = createDocumentEditSession({ record: source, shell, write });
    const stop = session.connect();
    session.edit({ ...source, body: "Rejected" });
    shell.setConnectionState("offline");
    shell.setConnectionState("online");
    await vi.waitFor(() => expect(session.get().conflictDraft).toEqual(draft));
    expect(session.get()).toMatchObject({
      baseRevision: 2,
      dirty: true,
      editable: false,
      buffer: { body: "Rejected" },
      lastSavedAt: source.updatedAt,
    });
    shell.setConnectionState("offline");
    shell.setConnectionState("online");
    await expect(session.save()).rejects.toThrow("Resolve the Conflict Draft");
    expect(write).toHaveBeenCalledTimes(1);
    session.accept({ ...source, body: "Merged", revision: 4 });
    expect(session.get()).toMatchObject({
      baseRevision: 4,
      dirty: false,
      editable: true,
      conflictDraft: null,
    });
    stop();
  });

  it("reuses the same command after a failed response but not after editing", async () => {
    const shell = createClientShell();
    const write = vi.fn().mockRejectedValue(new Error("Response lost"));
    const session = createDocumentEditSession({ record: source, shell, write });
    session.edit({ ...source, body: "Unwritten" });
    await expect(session.save()).rejects.toThrow("Response lost");
    await expect(session.save()).rejects.toThrow("Response lost");
    expect(write.mock.calls[0]?.[0]).toEqual(write.mock.calls[1]?.[0]);
    session.edit({ ...source, body: "Changed" });
    await expect(session.save()).rejects.toThrow("Response lost");
    expect(write.mock.calls[2]?.[0].clientIdempotencyKey).not.toBe(
      write.mock.calls[0]?.[0].clientIdempotencyKey,
    );
  });

  it("does not create a second write when reconnecting during an outstanding save", async () => {
    const shell = createClientShell();
    let finish: ((document: Document) => void) | undefined;
    const write = vi.fn(
      () =>
        new Promise<Document>((resolve) => {
          finish = resolve;
        }),
    );
    const session = createDocumentEditSession({ record: source, shell, write });
    const stop = session.connect();
    session.edit({ ...source, body: "Pending" });
    const pending = session.save();
    shell.setConnectionState("offline");
    shell.setConnectionState("online");
    expect(session.edit({ ...source, body: "No queue" })).toBe(false);
    expect(write).toHaveBeenCalledTimes(1);
    finish?.({ ...source, body: "Pending", revision: 3 });
    await pending;
    expect(session.get()).toMatchObject({
      dirty: false,
      pending: false,
      baseRevision: 3,
    });
    stop();
  });

  it("freezes one memory buffer and reconnects once against the last saved base without a queue", async () => {
    const shell = createClientShell();
    const write = vi.fn().mockResolvedValue({
      ...source,
      body: "Unwritten",
      revision: 3,
      updatedAt: "2026-09-29T10:01:00.000Z",
    });
    const session = createDocumentEditSession({ record: source, shell, write });
    const stop = session.connect();
    session.edit({ title: source.title, type: source.type, body: "Unwritten" });
    shell.setConnectionState("offline");
    expect(
      session.edit({
        title: source.title,
        type: source.type,
        body: "Must not queue",
      }),
    ).toBe(false);
    expect(session.get()).toMatchObject({
      buffer: { body: "Unwritten" },
      lastSavedAt: source.updatedAt,
      dirty: true,
      editable: false,
    });
    await expect(session.save()).rejects.toThrow("internet connection");
    expect(write).not.toHaveBeenCalled();
    shell.setConnectionState("online");
    await vi.waitFor(() => expect(session.get().dirty).toBe(false));
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith(
      expect.objectContaining({ body: "Unwritten", baseRevision: 2 }),
    );
    shell.setConnectionState("online");
    expect(write).toHaveBeenCalledTimes(1);
    stop();
  });
});
