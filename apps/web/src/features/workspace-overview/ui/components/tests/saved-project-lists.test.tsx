// @vitest-environment happy-dom
// biome-ignore-all lint/suspicious/useAwait: React act exposes asynchronous event boundaries.
import { DEFAULT_ACCOUNT_PREFERENCES } from "@cantiara/api/account-preferences";
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

vi.mock("@/components/app-link", () => ({
  AppLink: ({ href, ...props }: { href: string } & Record<string, unknown>) => (
    <a {...props} href={href} />
  ),
}));

import SavedProjectLists from "../saved-project-lists";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function SavedListLocation({ onChange }: { onChange: () => Promise<unknown> }) {
  const [editingId, selectEditor] = useState<string>();
  return (
    <SavedProjectLists
      editingId={editingId}
      formattingPreferences={DEFAULT_ACCOUNT_PREFERENCES}
      lists={[]}
      onChange={onChange}
      onEditingChange={selectEditor}
    />
  );
}

async function createList(onChange: () => Promise<unknown>) {
  await act(async () => root.render(<SavedListLocation onChange={onChange} />));
  await act(async () =>
    [...container.querySelectorAll("button")]
      .find((button) => button.textContent?.includes("New list"))
      ?.click(),
  );
  const name = container.querySelector<HTMLInputElement>("#saved-list-name");
  act(() => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set?.call(name, "Launch week");
    name?.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    container
      .querySelector("form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

test("a failed save keeps the saved list editor open with the typed name", async () => {
  const onChange = vi.fn(() => Promise.reject(new Error("save failed")));
  await createList(onChange);

  expect(onChange).toHaveBeenCalledOnce();
  expect(
    container.querySelector<HTMLInputElement>("#saved-list-name")?.value,
  ).toBe("Launch week");
});

test("a successful save closes the saved list editor", async () => {
  const onChange = vi.fn(() => Promise.resolve());
  await createList(onChange);

  expect(onChange).toHaveBeenCalledOnce();
  expect(container.querySelector("#saved-list-name")).toBeNull();
});
