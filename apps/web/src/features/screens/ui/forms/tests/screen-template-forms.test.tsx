// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";

import { CreateScreenFromTemplate } from "../create-screen-from-template-form";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

function type(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  act(() => {
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function submit() {
  await act(async () => {
    host
      ?.querySelector("form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

test("Create Screen from Template uses the first template, trims the title and clears it", async () => {
  const create = vi.fn().mockResolvedValue(undefined);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root?.render(
      <CreateScreenFromTemplate
        actions={{
          create,
          templates: [
            { createdAt: "2026-10-01T00:00:00.000Z", id: "t1", name: "One" },
            { createdAt: "2026-10-01T00:00:00.000Z", id: "t2", name: "Two" },
          ],
        }}
      />,
    );
  });
  const title = host.querySelector("input") as HTMLInputElement;

  await submit();
  expect(create).not.toHaveBeenCalled();
  expect(host.querySelector('[role="alert"]')?.textContent).toBe(
    "Title is required.",
  );

  type(title, "  Pay  ");
  await submit();
  expect(create).toHaveBeenCalledWith("t1", "Pay");
  expect(title.value).toBe("");
});
