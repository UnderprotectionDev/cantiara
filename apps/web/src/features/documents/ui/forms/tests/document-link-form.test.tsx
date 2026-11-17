// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { DocumentLinkPopover } from "../document-link-form";

function fakeEditor() {
  const run = vi.fn();
  const setLink = vi.fn(() => ({ run }));
  const chain = {
    command: vi.fn(() => chain),
    extendMarkRange: vi.fn(() => ({ setLink })),
    focus: vi.fn(() => chain),
    unsetLink: vi.fn(() => ({ run })),
  };
  return {
    editor: {
      chain: () => chain,
      getAttributes: () => ({}),
      state: { selection: null },
    },
    run,
    setLink,
  };
}

function type(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

async function submitLink(value: string) {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const { editor, run, setLink } = fakeEditor();
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(<DocumentLinkPopover active={false} editor={editor as any} />),
  );
  await act(async () =>
    host.querySelector<HTMLButtonElement>('button[aria-label="Link"]')?.click(),
  );
  const input = document.body.querySelector<HTMLInputElement>(
    "#document-link-url",
  ) as HTMLInputElement;
  await act(async () => type(input, value));
  const form = document.body.querySelector("form") as HTMLFormElement;
  await act(() => {
    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    return Promise.resolve();
  });
  const alert = document.body.querySelector('[role="alert"]')?.textContent;
  await act(async () => root.unmount());
  host.remove();
  return { alert, run, setLink };
}

test("an invalid link shows the schema message and does not touch the editor", async () => {
  const { alert, run, setLink } = await submitLink("ftp://example.com");
  expect(alert).toBe("Use an http, https, or mailto URL.");
  expect(setLink).not.toHaveBeenCalled();
  expect(run).not.toHaveBeenCalled();
});

test("a valid link is applied trimmed", async () => {
  const { alert, setLink } = await submitLink("  https://example.com/a  ");
  expect(alert).toBeUndefined();
  expect(setLink).toHaveBeenCalledWith({ href: "https://example.com/a" });
});
