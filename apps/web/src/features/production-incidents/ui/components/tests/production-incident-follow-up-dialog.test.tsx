// @vitest-environment happy-dom
import type { ProductionIncidentFollowUpPreview } from "@cantiara/api/production-incidents";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";

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

function mount(actions: ProductionIncidentFollowUpActions) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root?.render(
      <ProductionIncidentFollowUpDialog
        actions={actions}
        incident={{ title: "Checkout outage" }}
      />,
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
    mount({ onCreate, onPreview });
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
  });

  test("a stale commit shows Preview changed and returns to a fresh preview", async () => {
    const onCreate = vi.fn<ProductionIncidentFollowUpActions["onCreate"]>(() =>
      Promise.reject(new Error("PREVIEW_STALE")),
    );
    const fresh = { ...preview, fingerprint: "fp-2" };
    const onPreview = vi
      .fn<ProductionIncidentFollowUpActions["onPreview"]>()
      .mockResolvedValueOnce(preview)
      .mockResolvedValueOnce(fresh);
    mount({ onCreate, onPreview });
    await open();
    await submitPreview();
    await settle(() =>
      buttons(CREATE_LABEL)
        .find((button) => button.closest("section"))
        ?.click(),
    );
    expect(document.body.textContent).toContain("Preview changed");
    // The old preview cannot be committed again; the founder previews anew.
    expect(document.body.querySelector("section")).toBeNull();
    await submitPreview();
    expect(onPreview).toHaveBeenCalledTimes(2);
    expect(document.body.querySelector("section")).not.toBeNull();
    expect(onCreate).toHaveBeenCalledTimes(1);
  });
});
