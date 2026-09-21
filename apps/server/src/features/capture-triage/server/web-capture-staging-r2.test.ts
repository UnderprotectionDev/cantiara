import { describe, expect, test, vi } from "vitest";
import {
  createR2CaptureInboxStagingStore,
  createR2WebCaptureStagingStore,
} from "./web-capture-staging-r2";

const NOW = new Date("2026-09-18T09:00:00.000Z");
const AUTHORIZATION_PATTERN = /^AWS4-HMAC-SHA256 Credential=access-key\//u;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;

describe("Web Capture R2 staging", () => {
  test("stores and deletes an attachment through the signed R2 boundary", async () => {
    const requests: Request[] = [];
    const fetcher = (input: string | Request | URL, init?: RequestInit) => {
      const requestInput =
        input instanceof Request ? input.url : input.toString();
      requests.push(new Request(requestInput, init));
      return Promise.resolve(new Response(null, { status: 200 }));
    };
    const staging = createR2WebCaptureStagingStore(
      {
        accessKeyId: "access-key",
        accountId: "account-id",
        bucket: "cantiara-staging",
        endpoint: "https://r2.example.test",
        secretAccessKey: "secret-key",
      },
      { fetcher, now: () => NOW },
    );

    await staging.put({
      accountId: "account-1",
      attachmentId: "web-capture:link-1:key-1",
      dataUrl: "data:image/png;base64,AA==",
    });
    await staging.delete({
      accountId: "account-1",
      attachmentId: "web-capture:link-1:key-1",
    });

    expect(requests).toHaveLength(2);
    expect(requests[0]).toMatchObject({
      method: "PUT",
      url: "https://r2.example.test/cantiara-staging/capture-staging/account-1/web-capture%3Alink-1%3Akey-1",
    });
    expect(requests[0]?.headers.get("authorization")).toMatch(
      AUTHORIZATION_PATTERN,
    );
    expect(requests[0]?.headers.get("x-amz-content-sha256")).toMatch(
      SHA256_PATTERN,
    );
    const [putRequest] = requests;
    expect(putRequest).toBeDefined();
    if (!putRequest) {
      throw new Error("The PUT request was not captured.");
    }
    expect(new Uint8Array(await putRequest.arrayBuffer())).toEqual(
      new Uint8Array([0]),
    );
    expect(requests[1]).toMatchObject({
      method: "DELETE",
      url: "https://r2.example.test/cantiara-staging/capture-staging/account-1/web-capture%3Alink-1%3Akey-1",
    });
  });

  test("reads Capture staging and deletes it only after File Attachment promotion succeeds", async () => {
    const requests: Request[] = [];
    const sourceBytes = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    ]);
    const fetcher = (input: string | Request | URL, init?: RequestInit) => {
      const requestInput =
        input instanceof Request ? input.url : input.toString();
      const request = new Request(requestInput, init);
      requests.push(request);
      return Promise.resolve(
        request.method === "GET"
          ? new Response(sourceBytes, { status: 200 })
          : new Response(null, { status: 200 }),
      );
    };
    const staging = createR2WebCaptureStagingStore(
      {
        accessKeyId: "access-key",
        accountId: "account-id",
        bucket: "cantiara-staging",
        endpoint: "https://r2.example.test",
        secretAccessKey: "secret-key",
      },
      { fetcher, now: () => NOW },
    );
    const promoteCaptureAttachment = vi
      .fn()
      .mockResolvedValue({ attachmentId: "file-attachment-1" });
    const captureStaging = createR2CaptureInboxStagingStore(staging, {
      promoteCaptureAttachment,
    });

    await expect(
      captureStaging.promote({
        accountId: "account-1",
        attachment: {
          id: "capture-1",
          mimeType: "image/jpeg",
          name: "capture.jpg",
        },
        clientIdempotencyKey: "convert-1",
        finalize: async () => ({ recordId: "record-1" }),
        item: {
          content: "Captured content",
          createdAt: "2026-09-18T09:00:00.000Z",
          fields: {},
          id: "capture-1",
          projectId: "project-1",
          template: null,
        },
        operation: "convert",
        targetScope: { kind: "project", projectId: "project-1" },
      }),
    ).resolves.toEqual({ attachmentId: "file-attachment-1" });

    expect(promoteCaptureAttachment).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "account-1",
        bytes: sourceBytes,
        clientIdempotencyKey: "convert-1",
        declaredMimeType: "image/jpeg",
        fileName: "capture.jpg",
        scope: { kind: "project", projectId: "project-1" },
      }),
    );
    expect(requests).toHaveLength(2);
    expect(requests[0]).toMatchObject({
      method: "GET",
      url: "https://r2.example.test/cantiara-staging/capture-staging/account-1/capture-1",
    });
    expect(requests[1]).toMatchObject({
      method: "DELETE",
      url: "https://r2.example.test/cantiara-staging/capture-staging/account-1/capture-1",
    });
  });

  test("keeps Capture staging when File Attachment promotion fails", async () => {
    const requests: Request[] = [];
    const fetcher = (input: string | Request | URL, init?: RequestInit) => {
      const requestInput =
        input instanceof Request ? input.url : input.toString();
      const request = new Request(requestInput, init);
      requests.push(request);
      return Promise.resolve(
        request.method === "GET"
          ? new Response(new Uint8Array([0]), { status: 200 })
          : new Response(null, { status: 200 }),
      );
    };
    const staging = createR2WebCaptureStagingStore(
      {
        accessKeyId: "access-key",
        accountId: "account-id",
        bucket: "cantiara-staging",
        endpoint: "https://r2.example.test",
        secretAccessKey: "secret-key",
      },
      { fetcher, now: () => NOW },
    );
    const captureStaging = createR2CaptureInboxStagingStore(staging, {
      promoteCaptureAttachment: vi
        .fn()
        .mockRejectedValue(new Error("quota exceeded")),
    });

    await expect(
      captureStaging.promote({
        accountId: "account-1",
        attachment: {
          id: "capture-1",
          mimeType: "image/jpeg",
          name: "capture.jpg",
        },
        clientIdempotencyKey: "convert-1",
        finalize: async () => ({ recordId: "record-1" }),
        item: {
          content: "Captured content",
          createdAt: "2026-09-18T09:00:00.000Z",
          fields: {},
          id: "capture-1",
          projectId: "project-1",
          template: null,
        },
        operation: "convert",
        targetScope: { kind: "project", projectId: "project-1" },
      }),
    ).rejects.toThrow("quota exceeded");
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ method: "GET" });
  });

  test("does not retry a committed File Attachment when staging cleanup fails", async () => {
    const requests: Request[] = [];
    const sourceBytes = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    ]);
    const fetcher = (input: string | Request | URL, init?: RequestInit) => {
      const requestInput =
        input instanceof Request ? input.url : input.toString();
      const request = new Request(requestInput, init);
      requests.push(request);
      if (request.method === "GET") {
        return Promise.resolve(new Response(sourceBytes, { status: 200 }));
      }
      return Promise.resolve(
        new Response("staging cleanup unavailable", { status: 503 }),
      );
    };
    const staging = createR2WebCaptureStagingStore(
      {
        accessKeyId: "access-key",
        accountId: "account-id",
        bucket: "cantiara-staging",
        endpoint: "https://r2.example.test",
        secretAccessKey: "secret-key",
      },
      { fetcher, now: () => NOW },
    );
    const captureStaging = createR2CaptureInboxStagingStore(staging, {
      promoteCaptureAttachment: vi
        .fn()
        .mockResolvedValue({ attachmentId: "file-attachment-1" }),
    });

    await expect(
      captureStaging.promote({
        accountId: "account-1",
        attachment: {
          id: "capture-1",
          mimeType: "image/jpeg",
          name: "capture.jpg",
        },
        clientIdempotencyKey: "convert-1",
        finalize: async () => ({ recordId: "record-1" }),
        item: {
          content: "Captured content",
          createdAt: "2026-09-18T09:00:00.000Z",
          fields: {},
          id: "capture-1",
          projectId: "project-1",
          template: null,
        },
        operation: "convert",
        targetScope: { kind: "project", projectId: "project-1" },
      }),
    ).resolves.toEqual({ attachmentId: "file-attachment-1" });
    expect(requests).toHaveLength(2);
    expect(requests[1]).toMatchObject({ method: "DELETE" });
  });
});
