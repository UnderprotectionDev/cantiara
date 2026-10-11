import {
  previewFallback,
  type SmartLinkPreviewAccess,
  smartLinkPreviewSchema,
  youtubeVideoId,
} from "@cantiara/api/smart-link-preview";
import { request } from "undici/index.js";

// The application only contacts a configured, separately deployed egress
// service. It never opens the supplied URL or imports the egress worker.
export function createSmartLinkPreviewGateway(
  endpoint: string | undefined,
): SmartLinkPreviewAccess {
  return async (url) => {
    if (!endpoint) {
      return previewFallback(url);
    }
    try {
      const response = await request(endpoint, {
        method: "POST",
        body: JSON.stringify({ url }),
        headers: { "content-type": "application/json" },
        signal: AbortSignal.timeout(15_000),
        headersTimeout: 5000,
        bodyTimeout: 5000,
      });
      if (
        response.statusCode !== 200 ||
        Number(response.headers["content-length"]) > 2 * 1024 * 1024
      ) {
        response.body.destroy();
        return previewFallback(url);
      }
      let size = 0;
      const chunks: Uint8Array[] = [];
      for await (const chunk of response.body) {
        size += chunk.byteLength;
        if (size > 2 * 1024 * 1024) {
          response.body.destroy();
          return previewFallback(url);
        }
        chunks.push(chunk);
      }
      const preview = smartLinkPreviewSchema.parse(
        JSON.parse(Buffer.concat(chunks).toString("utf8")),
      );
      if (
        preview.url !== previewFallback(url).url ||
        (preview.player && preview.player.videoId !== youtubeVideoId(url))
      ) {
        return previewFallback(url);
      }
      return preview;
    } catch {
      return previewFallback(url);
    }
  };
}
