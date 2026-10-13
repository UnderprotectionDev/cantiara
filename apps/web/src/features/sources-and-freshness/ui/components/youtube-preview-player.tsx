// biome-ignore-all lint/performance/noJsxPropsBind: The click control owns this player’s transient loading state.
import { Button } from "@cantiara/ui/components/button";
import { useEffect, useRef, useState } from "react";

interface YouTubePlayer {
  cueVideoById: (id: string) => void;
  destroy: () => void;
}
interface YouTubeApi {
  Player: new (
    target: HTMLElement,
    options: {
      host: string;
      videoId: string;
      playerVars: { autoplay: number; origin: string };
      events: {
        onReady: (event: { target: YouTubePlayer }) => void;
        onError: () => void;
      };
    },
  ) => YouTubePlayer;
}
declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
    YT?: YouTubeApi;
  }
}

let apiLoading: Promise<YouTubeApi> | null = null;
function loadYouTubeApi() {
  if (window.YT?.Player) {
    return Promise.resolve(window.YT);
  }
  if (apiLoading) {
    return apiLoading;
  }
  apiLoading = new Promise<YouTubeApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    const previousReady = window.onYouTubeIframeAPIReady;
    const timeout = window.setTimeout(fail, 10_000);
    function fail() {
      clearTimeout(timeout);
      script.remove();
      apiLoading = null;
      reject(new Error("YouTube unavailable"));
    }
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      clearTimeout(timeout);
      if (window.YT?.Player) {
        resolve(window.YT);
      } else {
        fail();
      }
    };
    script.onerror = fail;
    document.head.append(script);
  });
  return apiLoading;
}

export function YouTubePreviewPlayer({
  videoId,
  available = true,
  playerOrigin,
}: {
  videoId: string;
  available?: boolean;
  playerOrigin?: string;
}) {
  const [requested, setRequested] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!(requested && host.current)) {
      return;
    }
    const container = host.current;
    let canceled = false;
    let failed = false;
    let player: YouTubePlayer | undefined;
    const timeout = window.setTimeout(fail, 15_000);
    function fail() {
      if (canceled) {
        return;
      }
      failed = true;
      clearTimeout(timeout);
      player?.destroy();
      player = undefined;
      container.replaceChildren();
      setStatus("error");
    }
    if (playerOrigin) {
      const frame = document.createElement("iframe");
      frame.title = "YouTube live player";
      frame.allow = "fullscreen; encrypted-media";
      frame.allowFullscreen = true;
      frame.referrerPolicy = "strict-origin-when-cross-origin";
      frame.setAttribute(
        "sandbox",
        "allow-scripts allow-same-origin allow-presentation",
      );
      function receive(event: MessageEvent) {
        if (
          canceled ||
          failed ||
          event.origin !== playerOrigin ||
          event.source !== frame.contentWindow
        ) {
          return;
        }
        const data: unknown = event.data;
        if (
          !data ||
          typeof data !== "object" ||
          !("type" in data) ||
          data.type !== "cantiara-youtube-player" ||
          !("videoId" in data) ||
          data.videoId !== videoId ||
          !("status" in data)
        ) {
          return;
        }
        if (data.status === "ready") {
          clearTimeout(timeout);
          setStatus("ready");
        } else if (data.status === "error") {
          fail();
        }
      }
      frame.onerror = fail;
      window.addEventListener("message", receive);
      frame.src = `${playerOrigin}/smart-link/youtube/${encodeURIComponent(videoId)}`;
      container.append(frame);
      return () => {
        canceled = true;
        clearTimeout(timeout);
        window.removeEventListener("message", receive);
        container.replaceChildren();
      };
    }
    loadYouTubeApi()
      .then((api) => {
        if (canceled || failed) {
          return;
        }
        const target = document.createElement("div");
        container.append(target);
        player = new api.Player(target, {
          host: "https://www.youtube-nocookie.com",
          videoId,
          playerVars: { autoplay: 0, origin: window.location.origin },
          events: {
            onReady: (event) => {
              if (canceled || failed) {
                return;
              }
              clearTimeout(timeout);
              // Cue the selected video without starting playback. Errors for a
              // removed/private/restricted video remain handled after readiness.
              event.target.cueVideoById(videoId);
              setStatus("ready");
            },
            onError: fail,
          },
        });
      })
      .catch(fail);
    return () => {
      canceled = true;
      clearTimeout(timeout);
      player?.destroy();
      container.replaceChildren();
    };
  }, [requested, videoId, playerOrigin]);
  function load() {
    setStatus("loading");
    setRequested(true);
  }
  return (
    <div className="space-y-3">
      <p className="font-medium text-sm">Live external source</p>
      <p className="text-muted-foreground text-sm">
        Loading YouTube contacts a third-party service. This live player is not
        historical evidence.
      </p>
      {!requested && available && (
        <Button onClick={load} type="button" variant="outline">
          Load YouTube
        </Button>
      )}
      {status === "loading" && <p role="status">Loading YouTube…</p>}
      {status === "error" && (
        <p role="alert">Video unavailable. Open the original URL.</p>
      )}
      <div
        className={
          requested && status !== "error"
            ? "aspect-video w-full overflow-hidden [&_iframe]:h-full [&_iframe]:w-full"
            : "hidden"
        }
        ref={host}
      />
    </div>
  );
}
