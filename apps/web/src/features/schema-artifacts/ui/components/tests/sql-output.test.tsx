// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { writeTextToClipboard } from "@/lib/clipboard";
import { SqlOutput } from "../sql-output";

vi.mock("@/lib/clipboard", () => ({ writeTextToClipboard: vi.fn() }));

test("SQL output ignores copy results from older attempts and closed outputs", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const old = Promise.withResolvers<void>();
  const current = Promise.withResolvers<void>();
  const late = Promise.withResolvers<void>();
  vi.mocked(writeTextToClipboard)
    .mockReturnValueOnce(old.promise)
    .mockReturnValueOnce(current.promise)
    .mockReturnValueOnce(late.promise);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  function render(sql: string) {
    act(() =>
      root.render(<SqlOutput exported={null} label="Up SQL" sql={sql} />),
    );
  }
  function copy() {
    const button = [...host.querySelectorAll("button")].find(
      (control) => control.textContent === "Copy Up SQL",
    );
    act(() => button?.click());
  }
  try {
    render("SELECT 1");
    copy();
    copy();
    await act(async () => current.resolve());
    await act(async () => old.reject(new Error("Older copy failed.")));
    expect(host.querySelector("[aria-live]")?.textContent).toBe(
      "Up SQL copied.",
    );
    copy();
    render("SELECT 2");
    await act(async () => late.resolve());
    expect(host.querySelector("[aria-live]")?.textContent).toBe("");
  } finally {
    act(() => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});
