// @vitest-environment happy-dom

import type {
  ConvertAndBindPlan,
  ScreenBlockOriginView,
} from "@cantiara/api/screen-origins";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { ConvertAndBindPanel } from "../convert-and-bind-form";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const plan: ConvertAndBindPlan = {
  body: "Start trial",
  originLocation: {
    blockId: "b-cta",
    ownerScreenId: "screen-1",
    wireframeVersion: 3,
  },
  projectId: "project-1",
  recordCount: 1,
  relation: "Origin",
  screenId: "screen-1",
  screenTitle: "Pricing",
  targetProject: { id: "project-1", name: "Cantiara" },
  targetType: "Decision",
  title: "Start trial",
  workType: null,
};

const created: ScreenBlockOriginView = {
  createdAt: "2026-10-01T09:00:00.000Z",
  id: "origin-1",
  location: {
    blockId: "b-cta",
    label: null,
    ownerScreenId: "screen-1",
    state: "resolved",
    wireframeVersion: 3,
  },
  relation: "Origin",
  screen: {
    lifecycle: "Active",
    screenId: "screen-1",
    state: "resolved",
    title: "Pricing",
  },
  supersededAt: null,
  supersedesId: null,
  target: {
    projectId: "project-1",
    recordId: "record-1",
    title: "Start trial",
    type: "Decision",
  },
};

let root: Root | undefined;
let host: HTMLDivElement | undefined;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});

function mount(actions: Parameters<typeof ConvertAndBindPanel>[0]["actions"]) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root?.render(
      <QueryClientProvider client={new QueryClient()}>
        <ConvertAndBindPanel actions={actions} blockId="b-cta" />
      </QueryClientProvider>,
    );
  });
}

function click(label: string) {
  const button = [...document.querySelectorAll("button")].find(
    (item) => item.textContent === label,
  );
  if (!button) {
    throw new Error(`No ${label} button`);
  }
  return act(async () => {
    button.click();
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

test("the preview names the target, Project, Kökeni and Origin Location and creates nothing", async () => {
  const preview = vi.fn().mockResolvedValue(plan);
  const confirm = vi.fn().mockResolvedValue(created);
  mount({ confirm, preview });

  await click("Convert and Bind");
  const options = [...document.querySelectorAll("option")].map(
    (option) => option.textContent,
  );
  expect(options).toEqual(["Work", "Decision", "Risk", "Open Question"]);
  expect(options).not.toContain("Screen");

  await click("Preview");
  expect(preview).toHaveBeenCalledWith({
    blockId: "b-cta",
    targetType: "Decision",
  });
  const text = document.body.textContent ?? "";
  expect(text).toContain("Target type: Decision");
  expect(text).toContain("Project: Cantiara");
  expect(text).toContain("Origin: Pricing");
  expect(text).toContain("Wireframe version 3");
  expect(confirm).not.toHaveBeenCalled();
});

test("Confirm creates exactly one record from the previewed plan", async () => {
  const preview = vi.fn().mockResolvedValue(plan);
  const confirm = vi.fn().mockResolvedValue(created);
  mount({ confirm, preview });

  await click("Convert and Bind");
  await click("Preview");
  await click("Confirm");

  expect(confirm).toHaveBeenCalledTimes(1);
  expect(confirm).toHaveBeenCalledWith(
    expect.objectContaining({
      plan,
      projectId: plan.projectId,
      screenId: plan.screenId,
    }),
  );
  expect(document.body.textContent).toContain("Created Decision: Start trial");
});

test("a stale preview reports an error and keeps the block untouched", async () => {
  const preview = vi.fn().mockResolvedValue(plan);
  const confirm = vi.fn().mockRejectedValue(new Error("stale"));
  mount({ confirm, preview });

  await click("Convert and Bind");
  await click("Preview");
  await click("Confirm");

  expect(document.body.textContent).toContain(
    "The preview is out of date. Preview again.",
  );
});

function enterTitle(title: string) {
  const input = document.querySelector("#convert-title") as HTMLInputElement;
  return act(() => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set?.call(input, title);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    return Promise.resolve();
  });
}

test("an over-long title is rejected by the form schema and nothing is previewed", async () => {
  const preview = vi.fn().mockResolvedValue(plan);
  mount({ confirm: vi.fn(), preview });

  await click("Convert and Bind");
  await enterTitle("x".repeat(256));
  await click("Preview");

  expect(preview).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain("Preview is unavailable.");
});

test("retrying Confirm reuses both IDs for the same previewed plan", async () => {
  const preview = vi.fn().mockResolvedValue(plan);
  const confirm = vi
    .fn()
    .mockRejectedValueOnce(new Error("network"))
    .mockResolvedValueOnce(created);
  mount({ confirm, preview });

  await click("Convert and Bind");
  await enterTitle("Start trial");
  await click("Preview");
  await click("Confirm");
  expect(
    document.querySelector<HTMLInputElement>("#convert-title")?.value,
  ).toBe("Start trial");
  await click("Confirm");

  expect(confirm).toHaveBeenCalledTimes(2);
  expect(confirm.mock.calls[0]?.[0]).toEqual(confirm.mock.calls[1]?.[0]);
  expect(document.body.textContent).toContain("Created Decision: Start trial");

  await click("Convert and Bind");
  expect(
    document.querySelector<HTMLInputElement>("#convert-title")?.value,
  ).toBe("");
});
