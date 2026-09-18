import { describe, expect, test } from "vitest";
import { createR2WebCaptureStagingStore } from "./web-capture-staging-r2";

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
});
