// @vitest-environment happy-dom
import type { TrashEarlyDeletePreview } from "@cantiara/api/trash-early-delete";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";

import { PermanentlyDeleteForm } from "../permanently-delete-form";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const noop = () => undefined;
const preview: TrashEarlyDeletePreview = {
  blockers: [],
  entryId: "e1",
  groupId: null,
  keepApprovedSurface: { available: false, reason: "never" },
  members: [],
  typedNameTarget: { kind: "Project", name: "Atlas" },
};

let root: Root | null = null;
let host: HTMLElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

function mount(grant: string | null, onSubmit: (typedName: string) => void) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root?.render(
      <PermanentlyDeleteForm
        busy={false}
        error={null}
        grant={grant}
        identityPending={false}
        onCancel={noop}
        onConfirmIdentity={noop}
        onSubmit={onSubmit}
        preview={preview}
      />,
    );
  });
}

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

describe("PermanentlyDeleteForm submit validation", () => {
  test("an empty typed name is refused with an alert and no delete request", async () => {
    const onSubmit = vi.fn();
    mount("grant", onSubmit);
    await submit();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(host?.querySelector('[role="alert"]')).not.toBeNull();
  });

  test("a missing grant is refused with an alert and no delete request", async () => {
    const onSubmit = vi.fn();
    mount(null, onSubmit);
    type(host?.querySelector("input") as HTMLInputElement, "Atlas");
    await submit();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(host?.querySelector('[role="alert"]')).not.toBeNull();
  });

  test("a valid name and grant reach the delete request", async () => {
    const onSubmit = vi.fn();
    mount("grant", onSubmit);
    type(host?.querySelector("input") as HTMLInputElement, "Atlas");
    await submit();
    expect(onSubmit).toHaveBeenCalledWith("Atlas");
    expect(host?.querySelector('[role="alert"]')).toBeNull();
  });
});
