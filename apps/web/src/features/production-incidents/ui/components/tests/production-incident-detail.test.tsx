// @vitest-environment happy-dom

import { DEFAULT_ACCOUNT_PREFERENCES } from "@cantiara/api/account-preferences";
import type { ProductionIncidentDetail as Detail } from "@cantiara/api/production-incidents";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { orpc } from "@/utils/orpc";
import { ProductionIncidentDetail } from "../production-incident-detail";
import { ProductionIncidentSurface } from "../production-incident-surface";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const rpc = vi.hoisted(() => ({ load: vi.fn(), write: vi.fn() }));

vi.mock("@/utils/orpc", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/orpc")>();
  const procedure = actual.orpc.productionIncidentDetail;
  return {
    ...actual,
    client: { updateProjectSourceRecord: rpc.write },
    orpc: new Proxy(actual.orpc, {
      get(target, key) {
        if (key !== "productionIncidentDetail") {
          return Reflect.get(target, key);
        }
        return {
          key: procedure.key,
          queryKey: procedure.queryKey,
          queryOptions: (
            ...args: Parameters<typeof procedure.queryOptions>
          ) => ({
            ...procedure.queryOptions(...args),
            queryFn: rpc.load,
          }),
        };
      },
    }),
  };
});

const FORBIDDEN_COPY =
  /on-call|status page|downtime|\bTTR\b|\bTTD\b|\bTTI\b|reliability/i;

vi.mock("@/components/app-link", () => ({
  AppLink: ({ href, ...props }: { href: string } & Record<string, unknown>) => (
    <a {...props} href={href} />
  ),
}));

const noop = async () => undefined;
const isNotSaving = () => false;
const actions = {
  onAddLink: noop,
  onChangeStatus: noop,
  onCreate: noop,
  onPreview: () => Promise.reject(new Error("not used")),
  onRemoveLink: noop,
  onSave: noop,
};

function detail(overrides: Partial<Detail> = {}): Detail {
  return {
    candidates: [
      {
        id: "risk-2",
        label: "Data loss",
        status: "Open",
        type: "Risk",
        unavailable: false,
      },
    ],
    incident: {
      createdAt: "2026-10-20T10:00:00.000Z",
      detectedHow: "Customer email",
      id: "incident-1",
      impact: "Checkout failed for 20 minutes",
      learning: "Add a canary",
      occurredAt: "2026-10-19T08:00:00.000Z",
      projectId: "project-1",
      resolution: null,
      revision: 2,
      rootCause: "Pool exhausted",
      sourceType: "Production Incident",
      status: "Watching",
      title: "Checkout outage",
      updatedAt: "2026-10-20T10:00:00.000Z",
    },
    links: [
      {
        attached: true,
        id: "link-1",
        revision: 1,
        target: {
          id: "work-1",
          label: "TK-1 Checkout 500s",
          status: "In Progress",
          type: "Bug",
          unavailable: false,
        },
      },
      {
        attached: true,
        id: "link-2",
        revision: 1,
        target: {
          id: "pr-1",
          label: "tidekit#42 Fix checkout",
          status: "merged",
          type: "GitHub PR",
          unavailable: false,
        },
      },
      {
        attached: false,
        id: "link-3",
        revision: 2,
        target: {
          id: "risk-1",
          label: "Removed risk",
          status: "Open",
          type: "Risk",
          unavailable: false,
        },
      },
    ],
    followUps: [],
    readOnly: false,
    ...overrides,
  };
}

function render(value: Detail) {
  return renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <ProductionIncidentDetail
        actions={actions}
        detail={value}
        formatting={DEFAULT_ACCOUNT_PREFERENCES}
        isSaving={isNotSaving}
        projectId="project-1"
      />
    </QueryClientProvider>,
  );
}

describe("Production Incident detail", () => {
  test("shows the timeline fields, the three statuses and the linked records read-only", () => {
    const html = render(detail());
    for (const text of [
      "Production Incident",
      "Checkout outage",
      "Occurred at",
      "Impact",
      "Detected how",
      "Resolution",
      "Root cause",
      "Learning",
      "Checkout failed for 20 minutes",
      "Pool exhausted",
      "Open",
      "Watching",
      "Resolved",
      "TK-1 Checkout 500s",
      "In Progress",
      "tidekit#42 Fix checkout",
      "Link record",
      "Edit incident",
    ]) {
      expect(html).toContain(text);
    }
    expect(html).toContain('aria-pressed="true"');
    expect(html).not.toContain("Removed risk");
    expect(html).toContain("#work-work-1");
  });

  test("states that status and links change no other record, and offers no follow-up or paging", () => {
    const html = render(detail());
    expect(html).toContain("pages no one and changes no linked");
    expect(html).not.toMatch(FORBIDDEN_COPY);
  });

  test("offers Create follow-up work as an action that opens a preview, and lists created follow-up with its Origin", () => {
    const html = render(
      detail({
        followUps: [
          {
            createdAt: "2026-10-20T10:00:00.000Z",
            id: "work-9",
            work: {
              id: "work-9",
              key: "TK-9",
              status: "Not Started",
              title: "Add a canary",
              type: "Task",
              unavailable: false,
            },
          },
        ],
      }),
    );
    expect(html).toContain("Create follow-up work");
    expect(html).toContain("TK-9 Add a canary");
    expect(html).toContain("Origin: this Production Incident");
    // The incident stays Watching: the follow-up never moves its status.
    expect(html).toContain('aria-pressed="true"');
    expect(render(detail())).toContain("only created after you review a");
  });

  test("an archived Project hides every write control", () => {
    const html = render(detail({ readOnly: true }));
    expect(html).not.toContain("Edit incident");
    expect(html).not.toContain("Link record");
    expect(html).not.toContain("Create follow-up work</button>");
    expect(html).not.toContain("Remove link");
    expect(html).toContain("Checkout outage");
  });

  test("an archived or trashed target stays listed without its content", () => {
    const html = render(
      detail({
        links: [
          {
            attached: true,
            id: "link-1",
            revision: 1,
            target: {
              id: "work-1",
              label: null,
              status: null,
              type: "Bug",
              unavailable: true,
            },
          },
        ],
      }),
    );
    expect(html).toContain("Unavailable record");
    expect(html).not.toContain("TK-1");
  });
});

test("an in-flight incident edit stays open and a rejected save can be retried", async () => {
  const value = detail();
  const { id: incidentId, projectId } = value.incident;
  const queryClient = new QueryClient();
  const request = Promise.withResolvers<typeof value.incident>();
  rpc.write
    .mockImplementationOnce(() => request.promise)
    .mockResolvedValueOnce(value.incident);
  rpc.load.mockResolvedValue(value);
  queryClient.setQueryData(
    orpc.productionIncidentDetail.queryKey({
      input: { incidentId, projectId },
    }),
    value,
  );
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  function button(label: string, parent: ParentNode = host) {
    return Array.from(parent.querySelectorAll("button")).find(
      (candidate) => candidate.textContent?.trim() === label,
    );
  }
  const dialog = () =>
    document.body.querySelector<HTMLElement>('[role="dialog"]');
  try {
    await act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <ProductionIncidentSurface
            formatting={DEFAULT_ACCOUNT_PREFERENCES}
            incidentId={incidentId}
            projectId={projectId}
          />
        </QueryClientProvider>,
      );
    });
    await act(() => button("Edit incident")?.click());
    expect(dialog()).not.toBeNull();
    const title = dialog()?.querySelector<HTMLInputElement>(
      'input[name="title"]',
    );
    if (!title) {
      throw new Error("The incident edit form has no title field.");
    }
    await act(() => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set?.call(title, "Updated outage");
      title.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(() => button("Save changes", document.body)?.click());
    expect(rpc.write).toHaveBeenCalledTimes(1);
    await act(() => {
      dialog()?.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }),
      );
    });
    expect(dialog()).not.toBeNull();
    await act(() => button("Cancel", document.body)?.click());
    expect(dialog()).not.toBeNull();

    await act(() => request.reject(new Error("Connection interrupted.")));
    await vi.waitFor(() =>
      expect(dialog()?.textContent).toContain(
        "Production Incident could not be saved.",
      ),
    );
    expect(title.value).toBe("Updated outage");
    await act(() => button("Save changes", document.body)?.click());
    await vi.waitFor(() => expect(dialog()).toBeNull());
    expect(rpc.write).toHaveBeenCalledTimes(2);
    expect(rpc.write.mock.calls[1]).toEqual(rpc.write.mock.calls[0]);
  } finally {
    await act(() => root.unmount());
    host.remove();
    queryClient.clear();
    rpc.load.mockReset();
    rpc.write.mockReset();
  }
});
