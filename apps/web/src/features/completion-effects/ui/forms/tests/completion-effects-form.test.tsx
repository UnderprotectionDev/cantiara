// @vitest-environment happy-dom

import { DEFAULT_COMPLETION_EFFECTS_PREFERENCES } from "@cantiara/api/completion-effects";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { COMPLETION_EFFECT_PREVIEW_DURATION_MS } from "../../../lib/completion-effects-presentation";
import CompletionEffectsForm from "../completion-effects-form";

test("Completion Effects clears old completion timers when the sample changes or closes", () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.useFakeTimers();
  const queryClient = new QueryClient();
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  function render(open: boolean) {
    act(() =>
      root.render(
        <QueryClientProvider client={queryClient}>
          {open ? (
            <CompletionEffectsForm
              accountId="account-1"
              snapshot={{
                ...DEFAULT_COMPLETION_EFFECTS_PREFERENCES,
                isSaved: false,
                revision: 0,
                savedAt: null,
              }}
            />
          ) : null}
        </QueryClientProvider>,
      ),
    );
  }
  function click(label: string) {
    const button = [...host.querySelectorAll("button")].find(
      (item) => item.value === label || item.textContent?.trim() === label,
    );
    expect(button).toBeDefined();
    act(() => button?.click());
  }
  const previewing = () =>
    host.querySelector("[data-previewing]")?.getAttribute("data-previewing");
  try {
    render(true);
    click("Preview");
    expect(previewing()).toBe("true");
    click("Weave");
    expect(previewing()).toBe("false");
    act(() => vi.advanceTimersByTime(COMPLETION_EFFECT_PREVIEW_DURATION_MS));
    expect(host.textContent).not.toContain("Preview finished.");

    click("Preview");
    expect(previewing()).toBe("true");
    click("Knot");
    expect(previewing()).toBe("false");
    act(() => vi.advanceTimersByTime(COMPLETION_EFFECT_PREVIEW_DURATION_MS));
    expect(host.textContent).not.toContain("Preview finished.");

    click("Preview");
    render(false);
    render(true);
    act(() => vi.advanceTimersByTime(COMPLETION_EFFECT_PREVIEW_DURATION_MS));
    expect(previewing()).toBe("false");
    expect(host.textContent).not.toContain("Preview finished.");
    click("Preview");
    act(() => vi.advanceTimersByTime(COMPLETION_EFFECT_PREVIEW_DURATION_MS));
    expect(host.textContent).toContain("Preview finished.");
  } finally {
    act(() => root.unmount());
    queryClient.clear();
    host.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  }
});
