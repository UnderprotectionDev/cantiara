// @vitest-environment happy-dom

import type { ScreenRecord } from "@cantiara/api/screens";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { ScreensView } from "../../views/screens-view";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const screen = {
  createdAt: "2026-10-01T09:00:00.000Z",
  id: "s1",
  lifecycle: "Active",
  projectId: "p1",
  revision: 1,
  title: "Checkout",
  updatedAt: "2026-10-01T09:00:00.000Z",
  wireframeVersions: [
    { createdAt: "2026-10-01T09:00:00.000Z", version: 1 },
    { createdAt: "2026-10-02T09:00:00.000Z", version: 2 },
  ],
} as ScreenRecord;
const noop = async () => undefined;

let root: Root | undefined;
afterEach(() => {
  act(() => root?.unmount());
  document.body.innerHTML = "";
});

function setValue(
  element: HTMLInputElement | HTMLSelectElement,
  value: string,
) {
  const proto =
    element instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(element, value);
  element.dispatchEvent(
    new Event(element instanceof HTMLSelectElement ? "change" : "input", {
      bubbles: true,
    }),
  );
}

async function submit(form: Element) {
  await act(async () => {
    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

function mount(
  props: Partial<Parameters<typeof ScreensView>[0]> & {
    templates: NonNullable<Parameters<typeof ScreensView>[0]["templates"]>;
  },
) {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  const cache = new QueryClient();
  return {
    host,
    render: (next: typeof props) =>
      act(() => {
        root?.render(
          <QueryClientProvider client={cache}>
            <ScreensView
              onCreate={noop}
              onSetLifecycle={noop}
              readOnly={false}
              screens={[screen]}
              {...next}
            />
          </QueryClientProvider>,
        );
      }),
    props,
  };
}

test("Save as Template stamps the chosen saved version and Create Screen from Template uses the Project", async () => {
  const save = vi.fn().mockResolvedValue(undefined);
  const create = vi.fn().mockResolvedValue(undefined);
  const view = mount({
    templates: {
      create,
      save,
      templates: [{ createdAt: "2026-10-03", id: "t1", name: "Landing" }],
    },
  });
  await view.render(view.props);

  const saveForm = view.host.querySelector(
    'form[aria-label="Save as Template"]',
  );
  expect(saveForm).not.toBeNull();
  await act(async () =>
    setValue(saveForm?.querySelector("select") as HTMLSelectElement, "1"),
  );
  await act(async () =>
    setValue(saveForm?.querySelector("input") as HTMLInputElement, "Hero"),
  );
  await submit(saveForm as Element);
  expect(save).toHaveBeenCalledWith(screen, 1, "Hero", expect.any(String));
  expect(saveForm?.textContent).toContain("Saved template Hero from v1.");

  const createForm = view.host.querySelector(
    'form[aria-label="Create Screen from Template"]',
  );
  await act(async () =>
    setValue(createForm?.querySelector("input") as HTMLInputElement, "Pricing"),
  );
  await submit(createForm as Element);
  expect(create).toHaveBeenCalledWith("t1", "Pricing");
});

test("read-only Projects and Screens without a saved version offer no template controls", async () => {
  const templates = {
    create: noop,
    save: noop,
    templates: [{ createdAt: "2026-10-03", id: "t1", name: "Landing" }],
  };
  const view = mount({ templates });
  await view.render({ readOnly: true, templates });
  expect(view.host.textContent).not.toContain("Save as Template");
  expect(view.host.textContent).not.toContain("Create Screen from Template");
  await view.render({
    screens: [{ ...screen, wireframeVersions: [] }],
    templates,
  });
  expect(view.host.textContent).not.toContain("Save as Template");
});

test("Save as Template retries the same stamp identity after a failure", async () => {
  const save = vi
    .fn()
    .mockRejectedValueOnce(new Error("Connection lost"))
    .mockResolvedValueOnce(undefined);
  const view = mount({ templates: { create: noop, save, templates: [] } });
  await view.render(view.props);

  const form = view.host.querySelector(
    'form[aria-label="Save as Template"]',
  ) as HTMLFormElement;
  await act(async () =>
    setValue(form.querySelector("input") as HTMLInputElement, "Hero"),
  );
  await submit(form);
  expect(form.textContent).toContain("Template could not be saved.");
  await submit(form);
  expect(save).toHaveBeenCalledTimes(2);
  expect(save.mock.calls[1]).toEqual(save.mock.calls[0]);
  expect(form.textContent).toContain("Saved template Hero from v2.");
});
