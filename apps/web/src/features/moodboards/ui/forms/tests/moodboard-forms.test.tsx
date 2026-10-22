// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";

import type { useMoodboards } from "../../../hooks/use-moodboards";
import { CreateMoodboardForm } from "../create-moodboard-form";

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

function mountCreate(mutate: ReturnType<typeof vi.fn>) {
  const api = {
    createMoodboard: { isPending: false, mutate },
  } as unknown as ReturnType<typeof useMoodboards>;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root?.render(<CreateMoodboardForm api={api} projectId="project-1" />);
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

describe("Create Moodboard form", () => {
  test("sends the trimmed title and clears the field once it is saved", async () => {
    const mutate = vi.fn();
    mountCreate(mutate);
    const input = host?.querySelector("input") as HTMLInputElement;
    type(input, "  Brand  ");
    await submit();
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0]?.[0]).toEqual({ title: "Brand" });
    expect(input.value).toBe("  Brand  ");
    act(() => mutate.mock.calls[0]?.[1].onSuccess());
    expect(input.value).toBe("");
  });

  test("an empty title is refused with an alert and no write", async () => {
    const mutate = vi.fn();
    mountCreate(mutate);
    type(host?.querySelector("input") as HTMLInputElement, "   ");
    await submit();
    expect(mutate).not.toHaveBeenCalled();
    expect(host?.querySelector('[role="alert"]')).not.toBeNull();
  });
});
