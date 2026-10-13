// Credential-free entrypoint: never import services, auth, env or a database here.
import { lookup } from "node:dns/promises";
import sharp from "sharp";
// Bun's built-in `undici` shim omits dispatcher lifecycle and DNS pinning APIs.
import { Agent, request } from "undici/index.js";
import {
  createSmartLinkPreview,
  type PreviewTransport,
} from "./smart-link-preview";

sharp.cache(false);
sharp.concurrency(1);
const MAX_BYTES = 20 * 1024 * 1024;
const network: PreviewTransport = {
  resolve: async (hostname) =>
    (await lookup(hostname, { all: true })).map(({ address }) => address),
  request: async (url, address, signal, maxBytes) => {
    // A new dispatcher per hop pins the validated address, preserving Host and
    // TLS servername. No second DNS lookup or shared cookie/proxy agent occurs.
    const dispatcher = new Agent({
      autoSelectFamily: false,
      connect: {
        lookup: (_hostname, _options, callback) =>
          callback(null, address, address.includes(":") ? 6 : 4),
        timeout: 3000,
      },
      maxHeaderSize: 16 * 1024,
    });
    try {
      const response = await request(url, {
        dispatcher,
        method: "GET",
        signal,
        headersTimeout: 3000,
        bodyTimeout: 3000,
        headers: {
          accept:
            "text/html, text/plain, application/json, image/png, image/jpeg, image/webp",
          "accept-encoding": "identity",
          "user-agent": "Cantiara-Link-Preview",
        },
      });
      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(response.headers)) {
        if (typeof value === "string") {
          headers[key] = value;
        }
      }
      if (
        Number(headers["content-length"]) > Math.min(MAX_BYTES, maxBytes) ||
        (headers["content-encoding"] &&
          headers["content-encoding"] !== "identity")
      ) {
        throw new Error("Response refused");
      }
      if (response.statusCode !== 200) {
        response.body.destroy();
        return { status: response.statusCode, headers, body: new Uint8Array() };
      }
      const chunks: Uint8Array[] = [];
      let size = 0;
      for await (const chunk of response.body) {
        size += chunk.byteLength;
        if (size > Math.min(MAX_BYTES, maxBytes)) {
          throw new Error("Response too large");
        }
        chunks.push(chunk);
      }
      return {
        status: response.statusCode,
        headers,
        body: Buffer.concat(chunks),
      };
    } finally {
      await dispatcher.destroy();
    }
  },
  safeImage: async (bytes) => {
    const image = sharp(bytes, {
      limitInputPixels: 16_000_000,
      animated: false,
    });
    const info = await image.metadata();
    if (!["jpeg", "png", "webp"].includes(info.format ?? "")) {
      throw new Error("Unsupported image");
    }
    const sanitized = await image
      .resize({
        width: 512,
        height: 512,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 75 })
      .toBuffer();
    return `data:image/webp;base64,${sanitized.toString("base64")}`;
  },
};

let input = "";
for await (const chunk of process.stdin) {
  input += chunk.toString();
  if (input.length > 16_384) {
    throw new Error("Input too large");
  }
}
const value: unknown = JSON.parse(input);
if (typeof value !== "string") {
  throw new Error("URL required");
}
process.stdout.write(
  JSON.stringify(await createSmartLinkPreview(network)(value)),
);
