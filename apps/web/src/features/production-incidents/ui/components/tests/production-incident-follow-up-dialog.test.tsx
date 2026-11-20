// @vitest-environment happy-dom

import type { ProductionIncidentFollowUpPreview } from "@cantiara/api/production-incidents";
import { ORPCError } from "@orpc/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";

import { orpc } from "@/utils/orpc";
import {
  type ProductionIncidentFollowUpActions,
  ProductionIncidentFollowUpDialog,
} from "../production-incident-follow-up-dialog";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const CREATE_LABEL = "Create follow-up work";
const preview: ProductionIncidentFollowUpPreview = {
  fingerprint: "fp-1",
  plan: {
    incident: {
      id: "incident-1",
      revision: 0,
      status: "Open",
      title: "Checkout outage",
    },
    relations: [
      {
        from: {
          id: "incident-1",
          label: "Checkout outage",
          type: "Production Incident",
        },
        kind: "Origin",
        to: { label: "Add a canary", type: "Work" },
      },
    ],
    work: {
      description: "Follow-up of Production Incident Checkout outage.",
      status: "Not Started",
      title: "Add a canary",
      type: "Task",
    },
  },
};

let root: Root | null = null;
let host: HTMLElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  document.body.innerHTML = "";
  root = null;
  host = null;
});

function mount(
  actions: ProductionIncidentFollowUpActions,
  queryClient = new QueryClient(),
) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root?.render(
      <QueryClientProvider client={queryClient}>
        <ProductionIncidentFollowUpDialog
          actions={actions}
          incident={{ title: "Checkout outage" }}
          projectId="p1"
        />
      </QueryClientProvider>,
    );
  });
}

function buttons(label: string) {
  return [...document.body.querySelectorAll("button")].filter(
    (button) => button.textContent === label,
  );
}

async function settle(work?: () => void) {
  await act(async () => {
    work?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function open() {
  return settle(() => buttons(CREATE_LABEL)[0]?.click());
}

function submitPreview() {
  return settle(() =>
    document.body
      .querySelector("form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
}

describe("Create follow-up work dialog", () => {
  test("there is nothing to commit before a preview is loaded", async () => {
    const onCreate = vi.fn<ProductionIncidentFollowUpActions["onCreate"]>(
      async () => undefined,
    );
    const onPreview = vi.fn<ProductionIncidentFollowUpActions["onPreview"]>(
      async () => preview,
    );
    mount({ onCreate, onPreview });
    await open();
    // Only the trigger carries the label; the dialog offers Preview first.
    expect(buttons(CREATE_LABEL)).toHaveLength(1);
    expect(buttons("Preview")).toHaveLength(1);
    expect(onCreate).not.toHaveBeenCalled();
    expect(onPreview).not.toHaveBeenCalled();
  });

  test("a previewed choice is committed with that preview", async () => {
    const onCreate = vi.fn<ProductionIncidentFollowUpActions["onCreate"]>(
      async () => undefined,
    );
    const onPreview = vi.fn<ProductionIncidentFollowUpActions["onPreview"]>(
      async () => preview,
    );
    const queryClient = new QueryClient();
    const keys = [
      orpc.projectWorks.key({ input: { projectId: "p1" } }),
      orpc.smartCollectionViews.key(),
    ];
    for (const key of keys) {
      queryClient.setQueryData(key, []);
    }
    mount({ onCreate, onPreview }, queryClient);
    await open();
    await submitPreview();
    expect(onPreview).toHaveBeenCalledTimes(1);
    const confirm = buttons(CREATE_LABEL).find(
      (button) => button.type === "button" && button.closest("section"),
    );
    expect(confirm).toBeDefined();
    await settle(() => confirm?.click());
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate.mock.calls[0]?.[1]).toBe(preview);
    for (const key of keys) {
      expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true);
    }
  });

  test("a failed confirmation can retry the same command and Work identity", async () => {
    const onCreate = vi
      .fn<ProductionIncidentFollowUpActions["onCreate"]>()
      .mockRejectedValueOnce(new Error("Connection interrupted"))
      .mockResolvedValueOnce(undefined);
    const onPreview = vi
      .fn<ProductionIncidentFollowUpActions["onPreview"]>()
      .mockResolvedValue(preview);
    mount({ onCreate, onPreview });
    await open();
    await submitPreview();
    const confirm = () =>
      buttons(CREATE_LABEL)
        .find((button) => button.closest("section"))
        ?.click();
    await settle(confirm);
    expect(document.body.textContent).toContain(
      "The Work could not be created",
    );
    await settle(confirm);
    expect(onCreate).toHaveBeenCalledTimes(2);
    expect(onCreate.mock.calls[1]).toEqual(onCreate.mock.calls[0]);
  });

  test("a stale commit shows Preview changed and returns to a fresh preview", async () => {
    const onCreate = vi.fn<ProductionIncidentFollowUpActions["onCreate"]>(() =>
      Promise.reject(
        new ORPCError("CONFLICT", { data: { code: "PREVIEW_STALE" } }),
      ),
    );
    const fresh = { ...preview, fingerprint: "fp-2" };
    const onPreview = vi
      .fn<ProductionIncidentFollowUpActions["onPreview"]>()
      .mockResolvedValueOnce(preview)
      .mockResolvedValueOnce(fresh);
    const queryClient = new QueryClient();
    const incidentKey = orpc.productionIncidentDetail.queryKey({
      input: { projectId: "p1", incidentId: preview.plan.incident.id },
    });
    queryClient.getQueryCache().build(queryClient, { queryKey: incidentKey });
    mount({ onCreate, onPreview }, queryClient);
    await open();
    await submitPreview();
    await settle(() =>
      buttons(CREATE_LABEL)
        .find((button) => button.closest("section"))
        ?.click(),
    );
    await vi.waitFor(async () => {
      await settle();
      expect(document.body.textContent).toContain("Preview changed");
    });
    expect(queryClient.getQueryState(incidentKey)?.isInvalidated).toBe(true);
    // The old preview cannot be committed again; the founder previews anew.
    expect(document.body.querySelector("section")).toBeNull();
    await submitPreview();
    expect(onPreview).toHaveBeenCalledTimes(2);
    await vi.waitFor(async () => {
      await settle();
      expect(document.body.querySelector("section")).not.toBeNull();
    });
    expect(onCreate).toHaveBeenCalledTimes(1);
  });
});
