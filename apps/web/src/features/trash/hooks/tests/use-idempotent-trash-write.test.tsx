// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";

import { useIdempotentTrashWrite } from "../use-idempotent-trash-write";

vi.mock("@/features/web-macos-client/store/client-shell", () => ({
  runOnlineOnlyWrite: (send: () => Promise<unknown>) => send(),
}));
vi.mock("@/utils/orpc", () => ({
  orpc: {
    projectDecisions: { key: () => ["decisions"] },
    projectRisks: { key: () => ["risks"] },
    trash: { key: () => ["trash"] },
  },
}));

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLElement | null = null;
let write: ReturnType<typeof useIdempotentTrashWrite>;
const client = new QueryClient();

function Probe() {
  write = useIdempotentTrashWrite();
  return null;
}

function mount() {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root?.render(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    );
  });
}

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
  vi.restoreAllMocks();
});

describe("useIdempotentTrashWrite", () => {
  test("a failed attempt retries with the same key and a success clears it", async () => {
    mount();
    const keys: string[] = [];
    const send = (fail: boolean) => (key: string) => {
      keys.push(key);
      return fail ? Promise.reject(new Error("offline")) : Promise.resolve(1);
    };
    await expect(write("a:1", send(true))).rejects.toThrow("offline");
    await write("a:1", send(false));
    await write("a:1", send(false));

    expect(keys[1]).toBe(keys[0]);
    expect(keys[2]).not.toBe(keys[0]);
  });

  test("a changed fingerprint gets a new key", async () => {
    mount();
    const keys: string[] = [];
    const send = (key: string) => {
      keys.push(key);
      return Promise.reject(new Error("offline"));
    };
    await write("a:1", send).catch(() => undefined);
    await write("a:2", send).catch(() => undefined);

    expect(keys[1]).not.toBe(keys[0]);
  });

  test("refreshes Trash and the source lists after a failure too", async () => {
    mount();
    const invalidate = vi
      .spyOn(client, "invalidateQueries")
      .mockResolvedValue(undefined);
    await write("a:1", () => Promise.reject(new Error("x"))).catch(
      () => undefined,
    );

    expect(invalidate.mock.calls.map(([filter]) => filter?.queryKey)).toEqual([
      ["trash"],
      ["risks"],
      ["decisions"],
    ]);
  });
});
