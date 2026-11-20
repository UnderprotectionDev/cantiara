// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { DiagramAuthorityConversion } from "../diagram-authority-conversion-form";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

test("the conversion form waits for one preview and keeps its input when the read fails", async () => {
  const cache = new QueryClient();
  const preview = Promise.withResolvers<never>();
  const read = vi.spyOn(cache, "query").mockReturnValue(preview.promise);
  const host = document.createElement("div");
  const root = createRoot(host);

  try {
    act(() => {
      root.render(
        <QueryClientProvider client={cache}>
          <DiagramAuthorityConversion
            diagram={{
              authorityMode: "Product-authored Model",
              externalSource: null,
              id: "diagram-1",
              model: { links: [], nodes: [] },
              origins: [],
              projectId: "project-1",
              revision: 1,
              title: "Platform",
              type: "Technical Architecture",
              view: null,
            }}
          />
        </QueryClientProvider>,
      );
    });

    const form = host.querySelector("form");
    await act(() => {
      form?.dispatchEvent(new Event("submit", { bubbles: true }));
      form?.dispatchEvent(new Event("submit", { bubbles: true }));
      return Promise.resolve();
    });

    expect(read).toHaveBeenCalledTimes(1);
    expect(host.querySelector("fieldset")?.disabled).toBe(true);

    await act(() => {
      preview.reject(new Error("Could not load the conversion preview."));
      return preview.promise.catch(() => undefined);
    });
    await vi.waitFor(() => {
      expect(host.querySelector('[role="alert"]')?.textContent).toBe(
        "Could not load the conversion preview.",
      );
    });
    expect(host.querySelector("fieldset")?.disabled).toBe(false);
    expect(
      host.querySelector<HTMLInputElement>("#authority-title-diagram-1")?.value,
    ).toBe("Platform (converted)");
  } finally {
    act(() => root.unmount());
    cache.clear();
  }
});
