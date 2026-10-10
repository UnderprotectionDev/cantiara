// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import ValidationRecordsSurface from "./validation-records-surface";
import {
  ValidationRecordEditor,
  ValidationRecordsView,
} from "./validation-records-view";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const rpc = vi.hoisted(() => ({
  list: vi.fn(),
  sources: vi.fn(),
  update: vi.fn(),
}));
vi.mock("@/utils/orpc", () => ({
  client: { updateProjectSourceRecord: rpc.update },
  orpc: {
    projectValidationRecords: {
      queryOptions: () => ({
        queryKey: ["validation-records"],
        queryFn: rpc.list,
      }),
    },
    projectSourceRecords: {
      queryOptions: () => ({
        queryKey: ["source-records"],
        queryFn: rpc.sources,
      }),
      key: () => ["source-records"],
    },
    projectSourceRecord: { key: () => ["source-record"] },
  },
}));

const record = {
  sourceType: "Validation Record" as const,
  id: "v1",
  projectId: "p1",
  title: "Export interviews",
  method: "Interview five founders",
  result: "Four need CSV",
  context: [{ sourceType: "Assumption" as const, sourceId: "a1" }],
  status: "Active" as const,
  revision: 1,
  createdAt: "2026-10-10T10:00:00.000Z",
  updatedAt: "2026-10-10T10:00:00.000Z",
};
const cancel = () => undefined;
const save = async () => undefined;
test("Validation Records exposes method, result and keyboard-addressable context without a status outcome gate", () => {
  const html = renderToStaticMarkup(
    <ValidationRecordsView
      counterparts={[]}
      onSave={save}
      onTransition={save}
      readOnly={false}
      records={[record]}
      selectedId="v1"
    />,
  );
  expect(html).toContain("Interview five founders");
  expect(html).toContain("Four need CSV");
  expect(html).toContain("Record unavailable");
  expect(html).not.toContain("Confirmed");
  expect(html).not.toContain("Publish");
  expect(html).not.toContain("Survey");
});
test("Validation Record editor labels its fields and archived Projects hide writes", () => {
  const editor = renderToStaticMarkup(
    <ValidationRecordEditor
      counterparts={[]}
      onCancel={cancel}
      onSave={save}
    />,
  );
  expect(editor).toContain('for="validation-method"');
  expect(editor).toContain('for="validation-result"');
  expect(editor).toContain("Related");
  const archived = renderToStaticMarkup(
    <ValidationRecordsView
      counterparts={[]}
      onSave={save}
      onTransition={save}
      readOnly
      records={[record]}
    />,
  );
  expect(archived).not.toContain(">Create</button>");
  expect(archived).not.toContain(">Edit</button>");
});

test("Validation Record detail navigation ignores the previous list status filter", async () => {
  const host = document.createElement("div");
  const root = createRoot(host);
  const props = {
    counterparts: [],
    onSave: save,
    onTransition: save,
    readOnly: false,
    records: [record, { ...record, id: "v2", status: "Archived" as const }],
  };
  try {
    await act(async () => root.render(<ValidationRecordsView {...props} />));
    const status = host.querySelector("select");
    if (!status) {
      throw new Error("Status control required");
    }
    await act(() => {
      status.value = "Archived";
      status.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () =>
      root.render(<ValidationRecordsView {...props} selectedId="v1" />),
    );
    expect(host.querySelector("article")?.textContent).toContain(
      "Four need CSV",
    );
    expect(host.querySelector("select")?.value).toBe("Active");
    expect(host.querySelector("article a")?.getAttribute("href")).toBe(
      "#source-validation-record-v1",
    );
    await act(async () =>
      root.render(<ValidationRecordsView {...props} selectedId="v2" />),
    );
    expect(host.querySelector("article a")?.getAttribute("href")).toBe(
      "#source-validation-record-v2",
    );
    await act(async () => root.render(<ValidationRecordsView {...props} />));
    expect(host.querySelector("select")?.value).toBe("Archived");
    expect(host.querySelectorAll("article")).toHaveLength(1);
  } finally {
    await act(async () => root.unmount());
  }
});

test("Validation Record conflict preserves the draft and reopens the latest record before saving", async () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const latest = { ...record, revision: 2, result: "Updated in another tab" };
  rpc.list.mockResolvedValue({ records: [record], readOnly: false });
  rpc.sources.mockResolvedValue([]);
  rpc.update
    .mockImplementationOnce(() => {
      rpc.list.mockResolvedValue({ records: [latest], readOnly: false });
      return Promise.reject(
        Object.assign(new Error("Record changed"), { code: "CONFLICT" }),
      );
    })
    .mockResolvedValue(latest);
  function button(label: string) {
    const target = Array.from(host.querySelectorAll("button")).find(
      (item) => item.textContent === label,
    );
    if (!target) {
      throw new Error(`${label} control required`);
    }
    return target;
  }
  try {
    await act(async () =>
      root.render(
        <QueryClientProvider client={queryClient}>
          <ValidationRecordsSurface projectId="p1" />
        </QueryClientProvider>,
      ),
    );
    await vi.waitFor(async () => {
      await act(async () => undefined);
      expect(host.querySelector("article")).not.toBeNull();
    });
    await act(async () => button("Edit").click());
    const result =
      host.querySelector<HTMLTextAreaElement>("#validation-result");
    if (!result) {
      throw new Error("Result field required");
    }
    const setter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )?.set;
    await act(() => {
      setter?.call(result, "My unsaved result");
      result.dispatchEvent(new Event("input", { bubbles: true }));
      button("Save").click();
    });
    await vi.waitFor(async () => {
      await act(async () => undefined);
      expect(host.querySelector('[role="alert"]')?.textContent).toContain(
        "Cancel and reopen",
      );
    });
    expect(result.value).toBe("My unsaved result");
    await act(async () => button("Cancel").click());
    await act(async () => button("Edit").click());
    expect(
      host.querySelector<HTMLTextAreaElement>("#validation-result")?.value,
    ).toBe("Updated in another tab");
    await act(async () => button("Save").click());
    await vi.waitFor(async () => {
      await act(async () => undefined);
      expect(host.querySelector('[role="status"]')?.textContent).toBe(
        "Validation Record saved.",
      );
    });
    expect(rpc.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ baseRevision: 2 }),
    );
  } finally {
    await act(async () => root.unmount());
    queryClient.clear();
    host.remove();
    vi.clearAllMocks();
  }
});
