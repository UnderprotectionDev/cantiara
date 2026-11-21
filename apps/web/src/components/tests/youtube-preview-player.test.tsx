// @vitest-environment happy-dom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { YouTubePreviewPlayer } from "../youtube-preview-player";

test("Retry replaces the failed YouTube player and ignores its late events", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const players: Player[] = [];
  class Player {
    readonly cueVideoById = vi.fn();
    readonly destroy = vi.fn();
    readonly options: ConstructorParameters<
      NonNullable<Window["YT"]>["Player"]
    >[1];

    constructor(_target: HTMLElement, options: Player["options"]) {
      this.options = options;
      players.push(this);
    }
  }
  vi.stubGlobal("YT", { Player });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const button = () => host.querySelector("button");

  try {
    act(() => root.render(<YouTubePreviewPlayer videoId="original" />));
    await act(async () => button()?.click());
    const [first] = players;
    if (!first) {
      throw new Error("YouTube did not create a player.");
    }
    act(() => first.options.events.onError());
    expect(first.destroy).toHaveBeenCalledOnce();
    expect(button()?.textContent).toBe("Retry");

    await act(async () => button()?.click());
    const [, second] = players;
    if (!second) {
      throw new Error("YouTube did not create a replacement player.");
    }
    act(() => first.options.events.onReady({ target: first }));
    expect(first.cueVideoById).not.toHaveBeenCalled();
    expect(host.querySelector('[role="status"]')?.textContent).toContain(
      "Loading YouTube",
    );

    act(() => second.options.events.onReady({ target: second }));
    expect(second.cueVideoById).toHaveBeenCalledExactlyOnceWith("original");
    expect(host.querySelector('[role="status"]')).toBeNull();

    act(() => root.render(<YouTubePreviewPlayer videoId="replacement" />));
    expect(second.destroy).toHaveBeenCalledOnce();
    act(() => second.options.events.onError());
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(button()?.textContent).toBe("Load YouTube");

    await act(async () => button()?.click());
    const [, , active] = players;
    expect(active?.options.videoId).toBe("replacement");
  } finally {
    act(() => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
  const [, , active] = players;
  expect(active?.destroy).toHaveBeenCalledOnce();
});
