// @vitest-environment happy-dom
import type {
  DocumentEvidenceBinding,
  DocumentEvidencePlan,
} from "@cantiara/api/document-evidence";
import type { Document } from "@cantiara/api/documents";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";

const noop = () => undefined;
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

import {
  EvidencePreview,
  EvidenceRoleEditor,
  EvidenceRoleHistory,
  EvidenceRow,
} from "./document-evidence-controls";

const source = {
  recordType: "Document",
  recordId: "doc",
  projectId: "project",
  revision: 1,
  componentId: null,
};
const pin = {
  source,
  start: 4,
  end: 9,
  excerpt: "local",
  before: "keep ",
  after: " exports",
};

test("previews the exact version, range and the single new record before confirmation", () => {
  const plan: DocumentEvidencePlan = {
    pin,
    mode: "create",
    target: null,
    newRecord: { type: "Assumption", projectId: "project", title: "Offline" },
    targetTitle: "Offline",
    fields: { title: "Offline", statement: "local" },
    bindingId: null,
    bindingRevision: 0,
    currentRevision: 1,
  };
  const html = renderToStaticMarkup(<EvidencePreview plan={plan} />);
  expect(html).toContain("New record");
  expect(html).toContain("Assumption: Offline");
  expect(html).toContain("Version 1");
  expect(html).toContain("Range 4–9");
  expect(html).toContain("statement");
  expect(html).toContain("Evidence Role: Unspecified");
});

test("shows Newer version exists without moving the old pin, plus the source and Origin Location", () => {
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
    origin: true,
    newerVersionExists: true,
    currentRevision: 3,
    readOnly: false,
    createdAt: "2026-10-17T09:00:00.000Z",
    actorId: "account",
  };
  const html = renderToStaticMarkup(
    <EvidenceRow binding={binding} onRebind={noop} />,
  );
  expect(html).toContain("<mark>local</mark>");
  expect(html).toContain("Version 1");
  expect(html).toContain("Newer version exists");
  expect(html).toContain("Rebind to new version");
  expect(html).toContain("Origin Location");
  expect(html).toContain("Open target record");
});

test("does not offer a link or a rebind for an unavailable archived target", () => {
  const html = renderToStaticMarkup(
    <EvidenceRow
      binding={{
        id: "bind",
        revision: 1,
        pin,
        role: "Unspecified",
        interpretation: null,
        target: {
          type: "Risk",
          recordId: "risk",
          projectId: null,
          label: null,
          brokenReason: "Permanently deleted",
          canOpenSourceRecord: false,
        },
        origin: false,
        newerVersionExists: true,
        currentRevision: 2,
        readOnly: true,
        createdAt: "2026-10-17T09:00:00.000Z",
        actorId: "account",
      }}
      onRebind={noop}
    />,
  );
  expect(html).toContain("Permanently deleted");
  expect(html).not.toContain("Open target record");
  expect(html).not.toContain("Rebind to new version");
});

test("shows Evidence Role and Founder interpretation apart from the source text, with the editor and history", () => {
  const binding: DocumentEvidenceBinding = {
    id: "bind",
    revision: 2,
    pin,
    role: "Contradicting",
    interpretation: "Customers asked for cloud sync",
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
  const html = renderToStaticMarkup(
    <EvidenceRow
      binding={binding}
      editor={
        <EvidenceRoleHistory
          entries={[
            {
              revision: 2,
              previousRole: "Unspecified",
              previousInterpretation: null,
              role: "Contradicting",
              interpretation: "Customers asked for cloud sync",
              actorId: "account",
              changedAt: "2026-10-17T10:00:00.000Z",
            },
          ]}
        />
      }
      onRebind={noop}
    />,
  );
  expect(html).toContain("Contradicting");
  expect(html).toContain(
    "Founder interpretation: Customers asked for cloud sync",
  );
  expect(html).toContain("<mark>local</mark>");
  expect(html).toContain("Unspecified → Contradicting");
});

test("shows the actor and time of each Evidence Role change", () => {
  const html = renderToStaticMarkup(
    <EvidenceRoleHistory
      entries={[
        {
          revision: 2,
          previousRole: "Unspecified",
          previousInterpretation: null,
          role: "Supporting",
          interpretation: null,
          actorId: "founder-account",
          changedAt: "2026-10-17T10:00:00.000Z",
        },
      ]}
    />,
  );
  expect(html).toContain("Unspecified → Supporting");
  expect(html).toContain("founder-account");
  expect(html).toContain("2026-10-17T10:00:00.000Z");
});

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
          <EvidenceRoleEditor
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
