// @vitest-environment happy-dom
// @vitest-environment-options {"settings":{"navigation":{"disableChildFrameNavigation":true}}}
// biome-ignore-all lint/suspicious/useAwait: React act and asynchronous provider doubles expose promise-based public boundaries.

import { DEFAULT_ACCOUNT_PREFERENCES } from "@cantiara/api/account-preferences";
import {
  previewFallback,
  type SmartLinkPreview,
} from "@cantiara/api/smart-link-preview";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";
import { SmartLinkComposer } from "./smart-link-preview";

const containers: HTMLElement[] = [];
afterEach(() => {
  for (const container of containers.splice(0)) {
    container.remove();
  }
  window.YT = undefined;
  vi.useRealTimers();
});
function requireElement<T>(value: T | null | undefined): T {
  if (!value) {
    throw new Error("Visible control required");
  }
  return value;
}
function paste(input: HTMLInputElement, url: string) {
  const event = new Event("paste", { bubbles: true });
  Object.defineProperty(event, "clipboardData", {
    value: { getData: () => url },
  });
  input.dispatchEvent(event);
}
function createSurface() {
  const container = document.createElement("div");
  document.body.append(container);
  containers.push(container);
  return { container, root: createRoot(container) };
}
function youtubePreview(url: string): Promise<SmartLinkPreview> {
  return Promise.resolve({
    ...previewFallback(url),
    kind: "preview",
    title: "Research video",
    error: null,
    capturedContent: "Original finding",
    player: { provider: "YouTube", videoId: "dQw4w9WgXcQ" },
  });
}
function button(container: HTMLElement, label: string) {
  return requireElement(
    Array.from(container.querySelectorAll("button")).find(
      (item) => item.textContent === label,
    ),
  );
}

describe("Sources and Freshness preview surface", () => {
  test("formats capture time with Account Preferences without changing the saved instant", async () => {
    const { container, root } = createSurface();
    const accessedAt = "2026-10-11T22:30:00Z";
    const captured = {
      ...(await youtubePreview("https://youtu.be/dQw4w9WgXcQ")),
      accessedAt,
    };
    const saved: string[] = [];
    const onPreview = () => Promise.resolve(captured);
    const onSave = (value: SmartLinkPreview) => {
      saved.push(value.accessedAt);
      return Promise.resolve();
    };
    await act(async () =>
      root.render(
        <SmartLinkComposer
          onPreview={onPreview}
          onSave={onSave}
          preferences={{
            ...DEFAULT_ACCOUNT_PREFERENCES,
            dateFormat: "dd/MM/yyyy",
          }}
        />,
      ),
    );
    await act(async () =>
      paste(requireElement(container.querySelector("input")), captured.url),
    );
    expect(container.textContent).toContain("12/10/2026 01:30");
    await act(async () =>
      root.render(
        <SmartLinkComposer
          onPreview={onPreview}
          onSave={onSave}
          preferences={{
            ...DEFAULT_ACCOUNT_PREFERENCES,
            locale: "en-US",
            timeZone: "America/New_York",
            dateFormat: "MM/dd/yyyy",
          }}
        />,
      ),
    );
    expect(container.textContent).toContain("10/11/2026 6:30 PM");
    await act(async () => button(container, "Save as Source").click());
    expect(saved).toEqual([accessedAt]);
    await act(async () => root.unmount());
  });
  test("keeps a pasted preview transient until Save as Source and never loads a player before click", async () => {
    const { container, root } = createSurface();
    const saved: string[] = [];
    function save(preview: SmartLinkPreview) {
      saved.push(preview.capturedContent);
      return Promise.resolve();
    }
    await act(async () => {
      root.render(
        <SmartLinkComposer onPreview={youtubePreview} onSave={save} />,
      );
    });
    await act(async () => {
      paste(
        requireElement(container.querySelector("input")),
        "https://youtu.be/dQw4w9WgXcQ",
      );
    });
    expect(container.textContent).toContain("Live preview");
    expect(container.textContent).toContain("Live external source");
    expect(container.textContent).toContain("third-party");
    expect(container.querySelector("iframe")).toBeNull();
    expect(
      document.querySelector(
        'script[src="https://www.youtube.com/iframe_api"]',
      ),
    ).toBeNull();
    expect(saved).toEqual([]);
    await act(async () => {
      button(container, "Save as Source").click();
    });
    expect(saved).toEqual(["Original finding"]);
    await act(async () => root.unmount());
  });
  test("loads only on click without autoplay and removes a restricted video while keeping its link and warning", async () => {
    const { container, root } = createSurface();
    let options:
      | ConstructorParameters<NonNullable<Window["YT"]>["Player"]>[1]
      | undefined;
    class ProviderPlayer {
      frame: HTMLIFrameElement;
      constructor(target: HTMLElement, config: NonNullable<typeof options>) {
        options = config;
        this.frame = document.createElement("iframe");
        target.replaceWith(this.frame);
      }
      destroy() {
        this.frame.remove();
      }
      cueVideoById() {
        /* No playback method exists in this boundary double. */
      }
    }
    window.YT = { Player: ProviderPlayer };
    function save() {
      return Promise.resolve();
    }
    await act(async () => {
      root.render(
        <SmartLinkComposer onPreview={youtubePreview} onSave={save} />,
      );
    });
    await act(async () => {
      paste(
        requireElement(container.querySelector("input")),
        "https://youtu.be/dQw4w9WgXcQ",
      );
    });
    await act(async () => {
      button(container, "Load YouTube").click();
    });
    expect(container.querySelector("iframe")).not.toBeNull();
    expect(options).toMatchObject({
      host: "https://www.youtube-nocookie.com",
      videoId: "dQw4w9WgXcQ",
      playerVars: { autoplay: 0 },
    });
    await act(async () => {
      requireElement(options).events.onError();
    });
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.textContent).toContain(
      "Video unavailable. Open the original URL.",
    );
    expect(container.textContent).toContain("third-party");
    expect(container.querySelector("a")?.href).toBe(
      "https://youtu.be/dQw4w9WgXcQ",
    );
    await act(async () => root.unmount());
  });
  test("native player uses the hosted document after click and ignores forged provider messages", async () => {
    const { container, root } = createSurface();
    const onSave = () => Promise.resolve();
    await act(async () =>
      root.render(
        <SmartLinkComposer
          onPreview={youtubePreview}
          onSave={onSave}
          youtubePlayerOrigin="https://api.example.org"
        />,
      ),
    );
    await act(async () =>
      paste(
        requireElement(container.querySelector("input")),
        "https://youtu.be/dQw4w9WgXcQ",
      ),
    );
    expect(container.querySelector("iframe")).toBeNull();
    await act(async () => button(container, "Load YouTube").click());
    const frame = requireElement(container.querySelector("iframe"));
    expect(frame.src).toBe(
      "https://api.example.org/smart-link/youtube/dQw4w9WgXcQ",
    );
    expect(frame.referrerPolicy).toBe("strict-origin-when-cross-origin");
    const data = {
      type: "cantiara-youtube-player",
      videoId: "dQw4w9WgXcQ",
      status: "error",
    };
    for (const event of [
      new MessageEvent("message", {
        data,
        origin: "https://evil.example",
        source: frame.contentWindow,
      }),
      new MessageEvent("message", {
        data,
        origin: "https://api.example.org",
        source: window,
      }),
      new MessageEvent("message", {
        data: { ...data, videoId: "otherVideo1" },
        origin: "https://api.example.org",
        source: frame.contentWindow,
      }),
    ]) {
      // biome-ignore lint/performance/noAwaitInLoops: Each forged message is independently observed at the player boundary.
      await act(async () => window.dispatchEvent(event));
      expect(container.querySelector("iframe")).toBe(frame);
    }
    await act(async () =>
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { ...data, status: "ready" },
          origin: "https://api.example.org",
          source: frame.contentWindow,
        }),
      ),
    );
    expect(container.textContent).not.toContain("Loading YouTube…");
    await act(async () =>
      window.dispatchEvent(
        new MessageEvent("message", {
          data,
          origin: "https://api.example.org",
          source: frame.contentWindow,
        }),
      ),
    );
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.textContent).toContain(
      "Video unavailable. Open the original URL.",
    );
    expect(container.textContent).toContain("third-party");
    expect(container.querySelector("a")?.href).toBe(
      "https://youtu.be/dQw4w9WgXcQ",
    );
    await act(async () => root.unmount());
  });
  test("native player timeout removes the frame and retains the original link", async () => {
    vi.useFakeTimers();
    const onSave = () => Promise.resolve();
    const { container, root } = createSurface();
    await act(async () =>
      root.render(
        <SmartLinkComposer
          onPreview={youtubePreview}
          onSave={onSave}
          youtubePlayerOrigin="https://api.example.org"
        />,
      ),
    );
    await act(async () =>
      paste(
        requireElement(container.querySelector("input")),
        "https://youtu.be/dQw4w9WgXcQ",
      ),
    );
    await act(async () => button(container, "Load YouTube").click());
    expect(container.querySelector("iframe")).not.toBeNull();
    await act(async () => vi.advanceTimersByTime(15_000));
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.textContent).toContain(
      "Video unavailable. Open the original URL.",
    );
    expect(container.querySelector("a")?.href).toBe(
      "https://youtu.be/dQw4w9WgXcQ",
    );
    await act(async () => root.unmount());
  });
  test("invalid embed text exposes neither a link, player nor Source save", async () => {
    const { container, root } = createSurface();
    function preview(url: string) {
      return Promise.resolve(previewFallback(url));
    }
    function save() {
      return Promise.resolve();
    }
    await act(async () => {
      root.render(<SmartLinkComposer onPreview={preview} onSave={save} />);
    });
    await act(async () => {
      paste(
        requireElement(container.querySelector("input")),
        '<iframe src="https://youtube.com/embed/dQw4w9WgXcQ"></iframe>',
      );
    });
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).not.toContain("Save as Source");
    await act(async () => root.unmount());
  });
});
