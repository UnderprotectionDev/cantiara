// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";

import { RemoveSurfaceControl } from "../remove-surface-control";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const { removeExternalSurface } = vi.hoisted(() => ({
  removeExternalSurface: vi.fn(),
}));
vi.mock("@/utils/orpc", () => ({
  client: { removeExternalSurface },
  orpc: {
    listExternalSurfaces: { key: () => ["listExternalSurfaces"] },
    removeExternalSurface: { mutationOptions: (options: object) => options },
  },
}));

let root: Root | null = null;
let host: HTMLElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

function mount(onRemove: () => Promise<unknown>) {
  removeExternalSurface.mockReset().mockImplementation(onRemove);
  const client = new QueryClient();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root?.render(
      <QueryClientProvider client={client}>
        <RemoveSurfaceControl sourceTitle="Plan" surfaceId="surface-1" />
      </QueryClientProvider>,
    );
  });
}

const dialog = () => document.querySelector("[role=alertdialog]");
const button = (name: string, scope: ParentNode | null = host) =>
  [...(scope?.querySelectorAll("button") ?? [])].find((el) =>
    el.textContent?.includes(name),
  );

describe("Revoke / Unpublish control", () => {
  test("asks for confirmation that says removal is permanent before it runs", async () => {
    const onRemove = vi.fn(() => Promise.resolve());
    mount(onRemove);
    act(() => button("Revoke / Unpublish")?.click());
    expect(onRemove).not.toHaveBeenCalled();
    expect(dialog()?.textContent).toContain("410 Gone");
    expect(dialog()?.textContent).toContain("not promised gone");
    await act(() =>
      Promise.resolve(button("Revoke / Unpublish", dialog())?.click()),
    );
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  test("Cancel leaves the surface alone and a failure is announced", async () => {
    const onRemove = vi.fn(() => Promise.reject(new Error("offline")));
    mount(onRemove);
    act(() => button("Revoke / Unpublish")?.click());
    act(() => button("Cancel", dialog())?.click());
    expect(onRemove).not.toHaveBeenCalled();
    act(() => button("Revoke / Unpublish")?.click());
    await act(() =>
      Promise.resolve(button("Revoke / Unpublish", dialog())?.click()),
    );
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
    expect(dialog()?.querySelector("[role=alert]")?.textContent).toContain(
      "Try again",
    );
  });
});
