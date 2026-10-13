import { Hono } from "hono";

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/u;

// A static, public player document supplies HTTP Referer on local Tauri
// WebViews. It has no account context, persistence or server-side URL fetch.
export const youtubePlayerRoutes = new Hono().get("/:videoId", (c) => {
  const videoId = c.req.param("videoId");
  if (!VIDEO_ID.test(videoId)) {
    return c.text("Invalid YouTube video id", 400);
  }
  const nonce = crypto.randomUUID();
  return c.html(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="referrer" content="strict-origin-when-cross-origin"><title>YouTube live player</title><style nonce="${nonce}">html,body,#player{width:100%;height:100%;margin:0;background:#000}</style></head><body><div id="player"></div><script nonce="${nonce}">
let player;
let failed = false;
function report(status) {
  // Status and a public video id are the only messages sent to the local parent.
  window.parent.postMessage({ type: "cantiara-youtube-player", videoId: "${videoId}", status }, "*");
}
function fail() {
  if (failed) return;
  failed = true;
  clearTimeout(timeout);
  player?.destroy();
  document.body.replaceChildren();
  report("error");
}
const timeout = setTimeout(fail, 15000);
window.onYouTubeIframeAPIReady = function() {
  if (failed) return;
  player = new YT.Player("player", {
    host: "https://www.youtube-nocookie.com",
    videoId: "${videoId}",
    playerVars: { autoplay: 0, origin: window.location.origin },
    events: {
      onReady: function(event) {
        if (failed) return;
        clearTimeout(timeout);
        event.target.cueVideoById("${videoId}");
        report("ready");
      },
      onError: fail
    }
  });
};
const script = document.createElement("script");
script.src = "https://www.youtube.com/iframe_api";
script.onerror = fail;
document.head.append(script);
</script></body></html>`,
    200,
    {
      "Cache-Control": "no-store",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}' https://www.youtube.com https://s.ytimg.com; style-src 'nonce-${nonce}'; frame-src https://www.youtube-nocookie.com; base-uri 'none'; form-action 'none'`,
    },
  );
});
