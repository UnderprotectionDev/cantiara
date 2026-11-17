// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";

import { ShareExpiryForm } from "../share-expiry-form";

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

function mount(
  initial: string,
  onSubmit: (actionId: string, expiresAt: string | null) => Promise<unknown>,
) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root?.render(
      <ShareExpiryForm
        actions={[
          { id: "set", label: "Save expiry" },
          { clears: true, id: "clear", label: "Remove expiry" },
        ]}
        defaultActionId="set"
        initial={initial}
        legend="Link expiry"
        onSubmit={onSubmit}
        timeZone="UTC"
      />,
    );
  });
}

async function click(label: string) {
  const button = [...(host?.querySelectorAll("button") ?? [])].find(
    (candidate) => candidate.textContent === label,
  );
  await act(async () => {
    button?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("ShareExpiryForm", () => {
  test("a past expiry shows the schema message and sends nothing", async () => {
    const onSubmit = vi.fn(
      async (_id: string, _at: string | null) => undefined,
    );
    mount("2020-01-01T10:00", onSubmit);
    await click("Save expiry");
    expect(host?.querySelector('[role="alert"]')?.textContent).toBe(
      "Choose a time in the future.",
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("a clearing action sends no expiry without validating the picker", async () => {
    const onSubmit = vi.fn(
      async (_id: string, _at: string | null) => undefined,
    );
    mount("2020-01-01T10:00", onSubmit);
    await click("Remove expiry");
    expect(onSubmit).toHaveBeenCalledWith("clear", null);
  });

  test("a failed write keeps the form with the retry message", async () => {
    const onSubmit = vi.fn((_id: string, _at: string | null) =>
      Promise.reject(new Error("failed")),
    );
    mount("2099-01-01T10:00", onSubmit);
    await click("Save expiry");
    expect(onSubmit).toHaveBeenCalledWith("set", "2099-01-01T10:00:00.000Z");
    expect(host?.querySelector('[role="alert"]')?.textContent).toBe(
      "That did not work. Try again.",
    );
  });
});
