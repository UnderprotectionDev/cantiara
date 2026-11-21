// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { WebCaptureView } from "../web-capture-view";

vi.mock("wxt/browser", () => ({
  browser: {
    storage: {
      local: {
        get: async () => ({
          webCaptureLink: {
            browser: "Chrome",
            device: "Test browser",
            id: "link-1",
            lastSuccessfulSave: null,
            token: "test-token",
          },
        }),
      },
    },
    tabs: {
      query: async () => [
        { id: 1, title: "Example", url: "https://example.org" },
      ],
    },
  },
}));

test("Search Inbox debounces requests, ignores a late response, and cancels on popup close", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const older = Promise.withResolvers<Response>();
  const response = (name: string) =>
    Response.json({
      targets: [
        { id: name, label: "Project Capture Inbox", name, projectId: name },
      ],
    });
  const fetchTargets = vi.fn((url: string, _init: RequestInit) => {
    const term = new URL(url).searchParams.get("search");
    return term === "old"
      ? older.promise
      : Promise.resolve(
          response(term === "new" ? "Fresh Inbox" : "Initial Inbox"),
        );
  });
  vi.stubGlobal("fetch", fetchTargets);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const cache = new QueryClient();
  const advance = (ms: number) =>
    act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });

  try {
    await act(() =>
      root.render(
        <QueryClientProvider client={cache}>
          <WebCaptureView />
        </QueryClientProvider>,
      ),
    );
    await act(() =>
      [...host.querySelectorAll("button")]
        .find((button) => button.textContent === "Capture URL")
        ?.click(),
    );
    const field = host.querySelector<HTMLInputElement>(
      '[aria-label="Search Inbox"]',
    );
    if (!field) {
      throw new Error("Search Inbox is missing");
    }
    const type = (value: string) =>
      act(() => {
        Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value",
        )?.set?.call(field, value);
        field.dispatchEvent(new Event("input", { bubbles: true }));
      });

    await advance(10);
    expect(fetchTargets).toHaveBeenCalledTimes(1);
    await type("o");
    await advance(100);
    expect(fetchTargets).toHaveBeenCalledTimes(1);
    await type(" old ");
    await advance(260);
    expect(fetchTargets).toHaveBeenCalledTimes(2);
    expect(fetchTargets.mock.calls[1]?.[0]).toContain("search=old");
    await type("new");
    expect(fetchTargets.mock.calls[1]?.[1].signal?.aborted).toBe(true);
    await act(() => older.resolve(response("Superseded Inbox")));
    await advance(100);
    expect(host.textContent).not.toContain("Superseded Inbox");
    await advance(160);
    await advance(10);
    expect(host.textContent).toContain("Fresh Inbox");

    await type("discarded");
    await act(() => root.unmount());
    await advance(300);
    expect(fetchTargets).toHaveBeenCalledTimes(3);
  } finally {
    await act(() => root.unmount());
    cache.clear();
    host.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  }
});
