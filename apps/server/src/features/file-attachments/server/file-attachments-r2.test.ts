import { describe, expect, test } from "vitest";

import { createR2FileAttachmentObjectStore } from "./file-attachments-r2";

const NOW = new Date("2026-09-18T09:00:00.000Z");
const AUTHORIZATION_PATTERN = /^AWS4-HMAC-SHA256 Credential=access-key\//u;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;

describe("File Attachments R2 boundary", () => {
  test("keeps temporary and permanent object operations behind signed requests", async () => {
    const requests: Request[] = [];
    const fetcher = (input: string | Request | URL, init?: RequestInit) => {
      const requestInput =
        input instanceof Request ? input.url : input.toString();
      const request = new Request(requestInput, init);
      requests.push(request);
      return Promise.resolve(
        request.method === "GET"
          ? new Response(new Uint8Array([1, 2, 3]), { status: 200 })
          : new Response(null, { status: 200 }),
      );
    };
    const store = createR2FileAttachmentObjectStore(
      {
        accessKeyId: "access-key",
        accountId: "account-id",
        bucket: "cantiara-files",
        endpoint: "https://r2.example.test",
        secretAccessKey: "secret-key",
      },
      { fetcher, now: () => NOW },
    );
    const bytes = new Uint8Array([0, 1, 2, 3, 4]).subarray(1, 4);

    const temporary = await store.putTemporary({
      accountId: "account-1",
      bytes,
      contentType: "image/jpeg",
      uploadId: "upload-1",
    });
    await store.promote({
      permanentKey: "file-attachments/workspace-1/attachment-1/version-1",
      temporaryKey: temporary.key,
    });
    await expect(store.read(temporary.key)).resolves.toEqual(
      new Uint8Array([1, 2, 3]),
    );
    await store.delete(temporary.key);

    expect(requests).toHaveLength(4);
    for (const request of requests) {
      expect(request.headers.get("authorization")).toMatch(
        AUTHORIZATION_PATTERN,
      );
      expect(request.headers.get("x-amz-content-sha256")).toMatch(
        SHA256_PATTERN,
      );
      expect(request.url).not.toContain("r2.cloudflarestorage.com");
    }
    expect(requests[0]).toMatchObject({
      method: "PUT",
      url: "https://r2.example.test/cantiara-files/file-attachments-temporary/account-1/upload-1",
    });
    await expect(requests[0]?.arrayBuffer()).resolves.toEqual(
      bytes.slice().buffer,
    );
    expect(requests[1]).toMatchObject({
      method: "PUT",
      url: "https://r2.example.test/cantiara-files/file-attachments/workspace-1/attachment-1/version-1",
    });
    expect(requests[1]?.headers.get("x-amz-copy-source")).toBe(
      "/cantiara-files/file-attachments-temporary/account-1/upload-1",
    );
    expect(requests[2]?.method).toBe("GET");
    expect(requests[3]?.method).toBe("DELETE");
  });
});
