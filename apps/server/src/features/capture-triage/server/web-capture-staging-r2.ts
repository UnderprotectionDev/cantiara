import type { CaptureAttachment } from "@cantiara/api/capture-triage";
import type { CaptureInboxStagingStore } from "./capture-inbox";
import type { WebCaptureStagingStore } from "./web-capture";

const R2_REGION = "auto";
const R2_SERVICE = "s3";
const AWS_ALGORITHM = "AWS4-HMAC-SHA256";
const AWS_TERMINATOR = "aws4_request";
const AWS_MILLISECONDS_PATTERN = /\.\d{3}/u;
const DATA_URL_PATTERN =
  /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/u;
const R2_ENDPOINT_TRAILING_SLASH_PATTERN = /\/$/u;

export interface R2StagingConfig {
  accessKeyId: string;
  accountId: string;
  bucket: string;
  endpoint?: string;
  secretAccessKey: string;
}

type R2Fetch = (
  input: string | Request | URL,
  init?: RequestInit,
) => Promise<Response>;

function encodePathSegment(value: string) {
  return encodeURIComponent(value).replace(
    /[!'()*]/gu,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function objectKey(accountId: string, attachmentId: string) {
  return `capture-staging/${encodePathSegment(accountId)}/${encodePathSegment(attachmentId)}`;
}

function hex(value: ArrayBuffer | Uint8Array) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function copyBytes(value: Uint8Array) {
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy;
}

async function sha256(value: Uint8Array) {
  return hex(await crypto.subtle.digest("SHA-256", copyBytes(value)));
}

async function hmac(key: Uint8Array, value: string | Uint8Array) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    copyBytes(key),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  const encoded =
    typeof value === "string" ? new TextEncoder().encode(value) : value;
  return new Uint8Array(
    await crypto.subtle.sign("HMAC", cryptoKey, copyBytes(encoded)),
  );
}

function awsDate(value: Date) {
  return value
    .toISOString()
    .replace(/[-:]/gu, "")
    .replace(AWS_MILLISECONDS_PATTERN, "");
}

function shortDate(value: string) {
  return value.slice(0, 8);
}

function decodeDataUrl(dataUrl: string) {
  const match = DATA_URL_PATTERN.exec(dataUrl);
  if (!match) {
    throw new Error(
      "Web Capture staging only accepts supported image data URLs.",
    );
  }
  const [, contentType, encoded] = match;
  if (!(contentType && encoded)) {
    throw new Error("Web Capture staging data URL is incomplete.");
  }
  const decoded = Buffer.from(encoded, "base64");
  const bytes = new Uint8Array(decoded.byteLength);
  bytes.set(decoded);
  return {
    bytes,
    contentType,
  };
}

function endpointFor(config: R2StagingConfig) {
  return (
    config.endpoint?.replace(R2_ENDPOINT_TRAILING_SLASH_PATTERN, "") ??
    `https://${config.accountId}.r2.cloudflarestorage.com`
  );
}

async function signedRequest({
  body,
  config,
  contentType,
  fetcher,
  key,
  method,
  now,
}: {
  body?: Uint8Array;
  config: R2StagingConfig;
  contentType?: string;
  fetcher: R2Fetch;
  key: string;
  method: "DELETE" | "PUT";
  now: () => Date;
}) {
  const endpoint = endpointFor(config);
  const url = `${endpoint}/${encodePathSegment(config.bucket)}/${key}`;
  const parsedUrl = new URL(url);
  const payload = body ?? new Uint8Array();
  const payloadHash = await sha256(payload);
  const timestamp = awsDate(now());
  const date = shortDate(timestamp);
  const headers = new Map<string, string>([
    ["host", parsedUrl.host],
    ["x-amz-content-sha256", payloadHash],
    ["x-amz-date", timestamp],
  ]);
  if (contentType) {
    headers.set("content-type", contentType);
  }
  const signedHeaders = [...headers.keys()].sort();
  const canonicalHeaders = signedHeaders
    .map((name) => `${name}:${headers.get(name)?.trim() ?? ""}\n`)
    .join("");
  const canonicalRequest = [
    method,
    parsedUrl.pathname,
    "",
    canonicalHeaders,
    signedHeaders.join(";"),
    payloadHash,
  ].join("\n");
  const credentialScope = `${date}/${R2_REGION}/${R2_SERVICE}/${AWS_TERMINATOR}`;
  const stringToSign = [
    AWS_ALGORITHM,
    timestamp,
    credentialScope,
    await sha256(new TextEncoder().encode(canonicalRequest)),
  ].join("\n");
  const dateKey = await hmac(
    new TextEncoder().encode(`AWS4${config.secretAccessKey}`),
    date,
  );
  const regionKey = await hmac(dateKey, R2_REGION);
  const serviceKey = await hmac(regionKey, R2_SERVICE);
  const signingKey = await hmac(serviceKey, AWS_TERMINATOR);
  const signature = hex(await hmac(signingKey, stringToSign));
  const authorization = `${AWS_ALGORITHM} Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders.join(";")}, Signature=${signature}`;
  const requestHeaders = new Headers({
    authorization,
    ...(contentType ? { "content-type": contentType } : {}),
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": timestamp,
  });
  const response = await fetcher(parsedUrl, {
    body: method === "PUT" ? payload.buffer : undefined,
    headers: requestHeaders,
    method,
  });
  if (!response.ok) {
    throw new Error(
      `R2 staging request failed with ${response.status}: ${await response.text()}`,
    );
  }
}

export function createR2WebCaptureStagingStore(
  config: R2StagingConfig,
  options: { fetcher?: R2Fetch; now?: () => Date } = {},
): WebCaptureStagingStore {
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? (() => new Date());

  return {
    async delete({ accountId, attachmentId }) {
      await signedRequest({
        config,
        fetcher,
        key: objectKey(accountId, attachmentId),
        method: "DELETE",
        now,
      });
    },
    async put({ accountId, attachmentId, dataUrl }) {
      const { bytes, contentType } = decodeDataUrl(dataUrl);
      await signedRequest({
        body: bytes,
        config,
        contentType,
        fetcher,
        key: objectKey(accountId, attachmentId),
        method: "PUT",
        now,
      });
    },
  };
}

export function createR2CaptureInboxStagingStore(
  staging: WebCaptureStagingStore,
): CaptureInboxStagingStore {
  return {
    delete: ({ accountId, attachment }) =>
      staging.delete({
        accountId,
        attachmentId: (attachment as CaptureAttachment).id,
      }),
  };
}
