// @vitest-environment happy-dom
// biome-ignore-all lint/suspicious/useAwait: React act exposes asynchronous event boundaries.
import type { ProjectProfile } from "@cantiara/api/project-shell";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import ProjectShortCodeForm from "../project-short-code-form";

const save = vi.hoisted(() => vi.fn());
vi.mock("../../../hooks/use-project-short-code", () => ({
  useProjectShortCode: () => ({
    clearError: () => undefined,
    error: null,
    isPending: false,
    saveShortCode: save,
  }),
}));

test("an invalid Short code shows the schema message and is not sent", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const project = {
    id: "p1",
    shortCode: "PAY",
    shortCodeLocked: false,
  } as ProjectProfile;
  await act(async () =>
    root.render(<ProjectShortCodeForm project={project} />),
  );
  await act(async () =>
    container.querySelector<HTMLButtonElement>("button")?.click(),
  );
  const input = container.querySelector("input") as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  await act(async () => {
    setter?.call(input, "1bad!");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    container
      .querySelector("form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  expect(container.querySelector('[role="alert"]')?.textContent).toContain(
    "Short code must start with a letter",
  );
  expect(save).not.toHaveBeenCalled();
  root.unmount();
});
