// @vitest-environment happy-dom
import type { DocumentEvidenceBinding } from "@cantiara/api/document-evidence";
import type { Document } from "@cantiara/api/documents";
import { expect, test, vi } from "vitest";

const rpc = vi.hoisted(() => ({ setRole: vi.fn() }));

vi.mock("@/features/web-macos-client/store/client-shell", () => ({
  runOnlineOnlyWrite: (write: () => Promise<unknown>) => write(),
}));
vi.mock("@/utils/orpc", () => ({
  client: { setDocumentEvidenceRole: rpc.setRole },
  orpc: {
    documentEvidenceBindings: { key: () => ["document-evidence-bindings"] },
    documentEvidenceHistory: {
      key: () => ["document-evidence-history"],
      queryOptions: () => ({
        queryKey: ["document-evidence-history"],
        queryFn: async () => [],
      }),
    },
  },
}));

import DocumentEvidenceRoleForm from "../document-evidence-role-form";

const pin = {
  source: {
    recordType: "Document",
    recordId: "doc",
    projectId: "project",
    revision: 1,
    componentId: null,
  },
  start: 4,
  end: 9,
  excerpt: "local",
  before: "keep ",
  after: " exports",
};

test("keeps the save identity after a failed Evidence Role save so the retry replays the same command", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const { QueryClient, QueryClientProvider } = await import(
    "@tanstack/react-query"
  );
  const { act } = await import("react");
  const { createRoot } = await import("react-dom/client");
  rpc.setRole.mockReset();
  rpc.setRole
    .mockRejectedValueOnce(new Error("Network lost"))
    .mockResolvedValueOnce({});
  const binding: DocumentEvidenceBinding = {
    id: "bind",
    revision: 1,
    pin,
    role: "Unspecified",
    interpretation: null,
    target: {
      type: "Decision",
      recordId: "decision",
      projectId: "project",
      label: "Keep exports local",
      brokenReason: null,
      canOpenSourceRecord: true,
    },
    origin: false,
    newerVersionExists: false,
    currentRevision: 1,
    readOnly: false,
    createdAt: "2026-10-17T09:00:00.000Z",
    actorId: "account",
  };
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  function saveButton() {
    const button = Array.from(host.querySelectorAll("button")).find(
      (item) => item.textContent === "Save Evidence Role",
    );
    if (!button) {
      throw new Error("Save Evidence Role control required");
    }
    return button;
  }
  try {
    await act(async () =>
      root.render(
        <QueryClientProvider client={queryClient}>
          <DocumentEvidenceRoleForm
            binding={binding}
            record={{ id: "doc", projectId: "project" } as Document}
          />
        </QueryClientProvider>,
      ),
    );
    const select = host.querySelector("select");
    if (!select) {
      throw new Error("Evidence Role select required");
    }
    act(() => {
      select.value = "Supporting";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => saveButton().click());
    expect(host.textContent).toContain("Evidence Role could not be saved");
    await act(async () => saveButton().click());
    expect(rpc.setRole).toHaveBeenCalledTimes(2);
    const [first, second] = rpc.setRole.mock.calls.map(
      ([input]) => input.clientIdempotencyKey,
    );
    expect(second).toBe(first);
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
