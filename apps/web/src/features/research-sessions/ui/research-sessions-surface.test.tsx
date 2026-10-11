// @vitest-environment happy-dom
import {
  type ResearchSessionRecord,
  researchSessionRecordSchema,
  type SaveResearchSessionInput,
  type SaveResearchSessionNoteInput,
} from "@cantiara/api/research-sessions";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import ResearchSessionsSurface from "./research-sessions-surface";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const rpc = vi.hoisted(() => ({
  list: vi.fn(),
  save: vi.fn(),
  saveNote: vi.fn(),
}));
vi.mock("@/utils/orpc", () => ({
  client: {
    saveResearchSession: rpc.save,
    saveResearchSessionNote: rpc.saveNote,
  },
  accountPreferencesQueryOptions: () => ({
    queryKey: ["preferences"],
    queryFn: async () => ({ timeZone: "Europe/Istanbul" }),
  }),
  orpc: {
    projectResearchSessions: {
      queryOptions: () => ({
        queryKey: ["research-sessions"],
        queryFn: rpc.list,
      }),
    },
  },
}));

async function openSurface() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <QueryClientProvider client={queryClient}>
        <ResearchSessionsSurface projectId="p1" />
      </QueryClientProvider>,
    ),
  );
  function button(label: string) {
    const target = Array.from(host.querySelectorAll("button")).find(
      (item) => item.textContent === label,
    );
    if (!target) {
      throw new Error(`${label} control required`);
    }
    return target;
  }
  await vi.waitFor(async () => {
    await act(async () => undefined);
    if (!host.textContent?.includes("Create Research Session")) {
      throw new Error("Research Sessions has not loaded");
    }
  });
  return {
    host,
    button,
    async fill(label: string, value: string) {
      const fieldLabel = Array.from(host.querySelectorAll("label")).find(
        (item) => item.textContent === label,
      );
      const field = fieldLabel
        ? document.getElementById(fieldLabel.htmlFor)
        : null;
      if (
        !(
          field instanceof HTMLInputElement ||
          field instanceof HTMLTextAreaElement
        )
      ) {
        throw new Error(`${label} field required`);
      }
      const setter = Object.getOwnPropertyDescriptor(
        field instanceof HTMLInputElement
          ? HTMLInputElement.prototype
          : HTMLTextAreaElement.prototype,
        "value",
      )?.set;
      await act(() => {
        setter?.call(field, value);
        field.dispatchEvent(new Event("input", { bubbles: true }));
      });
    },
    async close() {
      await act(async () => root.unmount());
      queryClient.clear();
      host.remove();
      vi.resetAllMocks();
    },
  };
}

test("Research Session edited retry after a lost create response does not fork the record", async () => {
  const records = new Map<string, ResearchSessionRecord>();
  rpc.list.mockImplementation(async () => ({
    records: [...records.values()],
    readOnly: false,
  }));
  rpc.save.mockImplementation((input: SaveResearchSessionInput) => {
    if (records.has(input.id)) {
      return Promise.reject(
        Object.assign(new Error("Record changed"), { code: "CONFLICT" }),
      );
    }
    const record = researchSessionRecordSchema.parse({
      ...input.fields,
      id: input.id,
      projectId: input.projectId,
      revision: 1,
      sourceType: "Research Session",
      createdAt: "2026-10-10T10:00:00.000Z",
      updatedAt: "2026-10-10T10:00:00.000Z",
      consentRecordedBy: "founder",
      consentRecordedAt: "2026-10-10T10:00:00.000Z",
    });
    records.set(record.id, record);
    return Promise.reject(new Error("Committed response was lost"));
  });
  const surface = await openSurface();
  try {
    await act(async () => surface.button("Create Research Session").click());
    await surface.fill("Title", "Export interview");
    await surface.fill("Purpose", "Export needs");
    await act(async () => surface.button("Save").click());
    await vi.waitFor(async () => {
      await act(async () => undefined);
      expect(surface.host.textContent).toContain("could not be saved");
    });
    await surface.fill("Purpose", "Updated export needs");
    await act(async () => surface.button("Retry").click());
    await vi.waitFor(async () => {
      await act(async () => undefined);
      expect(rpc.save).toHaveBeenCalledTimes(2);
      expect(
        surface.host.querySelector('[role="alert"]')?.textContent,
      ).toContain("Cancel and reopen");
    });
    expect(records.size).toBe(1);
    expect(surface.host.querySelector('[role="alert"]')?.textContent).toContain(
      "Cancel and reopen",
    );
    await act(async () => surface.button("Cancel").click());
    await act(async () => surface.button("Create Research Session").click());
    await surface.fill("Title", "Another interview");
    await surface.fill("Purpose", "Another research question");
    await act(async () => surface.button("Save").click());
    await vi.waitFor(async () => {
      await act(async () => undefined);
      expect(surface.host.textContent).toContain("could not be saved");
    });
    expect(records.size).toBe(2);
  } finally {
    await surface.close();
  }
});

test("Research Session conflict retains the draft and reopens the current revision", async () => {
  const record = researchSessionRecordSchema.parse({
    id: "session-1",
    projectId: "p1",
    title: "Export interview",
    purpose: "Export needs",
    revision: 1,
    sourceType: "Research Session",
    createdAt: "2026-10-10T10:00:00.000Z",
    updatedAt: "2026-10-10T10:00:00.000Z",
    consentRecordedBy: "founder",
    consentRecordedAt: "2026-10-10T10:00:00.000Z",
  });
  const latest = { ...record, revision: 2, purpose: "Updated in another tab" };
  rpc.list.mockResolvedValue({ records: [record], readOnly: false });
  rpc.save
    .mockImplementationOnce(() => {
      rpc.list.mockResolvedValue({ records: [latest], readOnly: false });
      return Promise.reject(
        Object.assign(new Error("Record changed"), { code: "CONFLICT" }),
      );
    })
    .mockResolvedValue({ ...latest, revision: 3 });
  const surface = await openSurface();
  try {
    await act(async () => surface.button("Edit").click());
    await surface.fill("Purpose", "My retained draft");
    await act(async () => surface.button("Save").click());
    await vi.waitFor(async () => {
      await act(async () => undefined);
      expect(surface.host.textContent).toContain("Cancel and reopen");
    });
    expect(
      Array.from(surface.host.querySelectorAll("textarea")).some(
        (field) => field.value === "My retained draft",
      ),
    ).toBe(true);
    await act(async () => surface.button("Cancel").click());
    await act(async () => surface.button("Edit").click());
    expect(
      Array.from(surface.host.querySelectorAll("textarea")).some(
        (field) => field.value === "Updated in another tab",
      ),
    ).toBe(true);
    await act(async () => surface.button("Save").click());
    await vi.waitFor(async () => {
      await act(async () => undefined);
      expect(surface.host.textContent).toContain("Research Session saved.");
    });
    expect(rpc.save).toHaveBeenLastCalledWith(
      expect.objectContaining({ baseRevision: 2 }),
    );
  } finally {
    await surface.close();
  }
});

test("a lost note response retries the same identity, while an edited retry retains its draft through conflict", async () => {
  let record = researchSessionRecordSchema.parse({
    id: "session",
    projectId: "p1",
    title: "Typed interview",
    purpose: "Export",
    consent: "Allowed",
    revision: 1,
    sourceType: "Research Session",
    createdAt: "2026-10-10T10:00:00.000Z",
    updatedAt: "2026-10-10T10:00:00.000Z",
    consentRecordedBy: "founder",
    consentRecordedAt: "2026-10-10T10:00:00.000Z",
  });
  const receipts = new Map<string, ResearchSessionRecord>();
  rpc.list.mockImplementation(async () => ({
    records: [record],
    readOnly: false,
  }));
  rpc.saveNote.mockImplementation((input: SaveResearchSessionNoteInput) => {
    const receipt = receipts.get(input.clientIdempotencyKey);
    if (receipt) {
      return Promise.resolve(receipt);
    }
    if (input.baseRevision !== record.revision) {
      return Promise.reject(
        Object.assign(new Error("Changed"), { code: "CONFLICT" }),
      );
    }
    record = researchSessionRecordSchema.parse({
      ...record,
      revision: record.revision + 1,
      content: [
        ...record.content,
        { consentAtCapture: "Allowed", content: input.note },
      ],
    });
    receipts.set(input.clientIdempotencyKey, record);
    return Promise.reject(new Error("Committed response lost"));
  });
  const surface = await openSurface();
  async function start() {
    await act(async () => surface.button("Add note").click());
    const select = surface.host.querySelector("select");
    if (!select) {
      throw new Error("Note type required");
    }
    await act(() => {
      select.value = "Founder interpretation";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await surface.fill("Founder interpretation", "A shorter menu may help");
    await act(async () => surface.button("Save").click());
    await vi.waitFor(() =>
      expect(surface.host.textContent).toContain("could not be saved"),
    );
  }
  try {
    await start();
    // Opening another editor must not discard this note's committed receipt identity.
    await act(async () => surface.button("Edit").click());
    await act(async () => surface.button("Cancel").click());
    await act(async () => surface.button("Retry").click());
    await vi.waitFor(() =>
      expect(surface.host.textContent).toContain("Note saved."),
    );
    expect(record.content).toHaveLength(1);
    expect(rpc.saveNote.mock.calls[0]?.[0]).toEqual(
      rpc.saveNote.mock.calls[1]?.[0],
    );
    await start();
    await surface.fill("Founder interpretation", "Edited retry text");
    await act(async () => surface.button("Retry").click());
    await vi.waitFor(() =>
      expect(surface.host.textContent).toContain("Cancel and reopen"),
    );
    expect(surface.host.querySelector("textarea")?.value).toBe(
      "Edited retry text",
    );
    expect(record.content).toHaveLength(2);
    await act(async () => surface.button("Cancel").click());
    expect(surface.host.textContent).not.toContain("Edited retry text");
    expect(surface.host.querySelectorAll("article")).toHaveLength(2);
  } finally {
    await surface.close();
  }
});
