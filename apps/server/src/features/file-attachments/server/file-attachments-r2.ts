import type { FileAttachmentObjectStore } from "./file-attachments";

const R2_REGION = "auto";
const R2_SERVICE = "s3";
const AWS_ALGORITHM = "AWS4-HMAC-SHA256";
const AWS_TERMINATOR = "aws4_request";
const AWS_MILLISECONDS_PATTERN = /\.\d{3}/u;
const R2_ENDPOINT_TRAILING_SLASH_PATTERN = /\/$/u;

export interface R2FileAttachmentConfig {
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

function encodeObjectKey(key: string) {
  return key.split("/").map(encodePathSegment).join("/");
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

// Web crypto and fetch need a standalone ArrayBuffer; the payload-sized copy is
// avoided when the view already covers its whole backing buffer.
function standaloneBuffer(value: Uint8Array): ArrayBuffer {
  return value.byteOffset === 0 && value.byteLength === value.buffer.byteLength
    ? (value.buffer as ArrayBuffer)
    : value.slice().buffer;
}

async function sha256(value: Uint8Array) {
  return hex(await crypto.subtle.digest("SHA-256", standaloneBuffer(value)));
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

function endpointFor(config: R2FileAttachmentConfig) {
  return (
    config.endpoint?.replace(R2_ENDPOINT_TRAILING_SLASH_PATTERN, "") ??
    `https://${config.accountId}.r2.cloudflarestorage.com`
  );
}

async function signedRequest({
  acceptedStatuses,
  body,
  config,
  contentType,
  fetcher,
  headers: additionalHeaders = {},
  key,
  method,
  now,
}: {
  body?: Uint8Array;
  config: R2FileAttachmentConfig;
  contentType?: string;
  fetcher: R2Fetch;
  headers?: Record<string, string>;
  key: string;
  method: "DELETE" | "GET" | "HEAD" | "PUT";
  now: () => Date;
  acceptedStatuses?: readonly number[];
}) {
  const endpoint = endpointFor(config);
  const url = `${endpoint}/${encodePathSegment(config.bucket)}/${encodeObjectKey(key)}`;
  const parsedUrl = new URL(url);
  const payload = body ?? new Uint8Array();
  const payloadHash = await sha256(payload);
  const timestamp = awsDate(now());
  const date = timestamp.slice(0, 8);
  const headers = new Map<string, string>([
    ["host", parsedUrl.host],
    ["x-amz-content-sha256", payloadHash],
    ["x-amz-date", timestamp],
  ]);
  if (contentType) {
    headers.set("content-type", contentType);
  }
  for (const [name, value] of Object.entries(additionalHeaders)) {
    headers.set(name.toLocaleLowerCase("en-US"), value);
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
    ...additionalHeaders,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": timestamp,
  });
  const response = await fetcher(parsedUrl, {
    body: method === "PUT" ? standaloneBuffer(payload) : undefined,
    headers: requestHeaders,
    method,
  });
  if (!(response.ok || acceptedStatuses?.includes(response.status))) {
    throw new Error(
      `R2 File Attachment request failed with ${response.status}: ${await response.text()}`,
    );
  }
  return response;
}

function temporaryObjectKey(accountId: string, uploadId: string) {
  return `file-attachments-temporary/${accountId}/${uploadId}`;
}

export function createR2FileAttachmentObjectStore(
  config: R2FileAttachmentConfig,
  options: { fetcher?: R2Fetch; now?: () => Date } = {},
): FileAttachmentObjectStore {
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? (() => new Date());

  return {
    async delete(key) {
      await signedRequest({
        config,
        fetcher,
        key,
        method: "DELETE",
        now,
      });
    },

    async has(key) {
      const response = await signedRequest({
        acceptedStatuses: [404],
        config,
        fetcher,
        key,
        method: "HEAD",
        now,
      });
      return response.ok;
    },

    async putImmutable({ bytes, contentType, key }) {
      const response = await signedRequest({
        acceptedStatuses: [412],
        body: bytes,
        config,
        contentType,
        fetcher,
        headers: { "if-none-match": "*" },
        key,
        method: "PUT",
        now,
      });
      return response.status === 412 ? "existing" : "created";
    },

    async promote({ permanentKey, temporaryKey }) {
      await signedRequest({
        config,
        fetcher,
        headers: {
          "x-amz-copy-source": `/${encodePathSegment(config.bucket)}/${encodeObjectKey(temporaryKey)}`,
        },
        key: permanentKey,
        method: "PUT",
        now,
      });
    },

    async putTemporary({ accountId, bytes, contentType, uploadId }) {
      const key = temporaryObjectKey(accountId, uploadId);
      await signedRequest({
        body: bytes,
        config,
        contentType,
        fetcher,
        key,
        method: "PUT",
        now,
      });
      return { key };
    },

    async read(key) {
      const response = await signedRequest({
        config,
        fetcher,
        key,
        method: "GET",
        now,
      });
      const body = await response.arrayBuffer();
      return new Uint8Array(body);
    },
  };
}
