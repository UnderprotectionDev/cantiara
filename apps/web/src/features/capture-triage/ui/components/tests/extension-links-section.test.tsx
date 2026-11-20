// @vitest-environment happy-dom
import { DEFAULT_ACCOUNT_PREFERENCES } from "@cantiara/api/account-preferences";
import {
  MutationCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { orpc } from "@/utils/orpc";
import ExtensionLinksSection from "../extension-links-section";

const rpc = vi.hoisted(() => ({ createWebCapturePairingCode: vi.fn() }));
vi.mock("@/utils/orpc", async (importActual) => ({
  ...(await importActual<typeof import("@/utils/orpc")>()),
  client: rpc,
}));

test("the generated pairing code reaches Extension links without entering the mutation cache", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const code = crypto.randomUUID();
  const expiresAt = "2026-12-01T10:00:00.000Z";
  rpc.createWebCapturePairingCode.mockResolvedValue({ code, expiresAt });
  const leaked: boolean[] = [];
  const observe = (data: unknown, variables: unknown) => {
    leaked.push(JSON.stringify({ data, variables }).includes(code));
  };
  const mutationCache = new MutationCache({
    onSuccess: observe,
    onSettled: (data, _error, variables) => observe(data, variables),
  });
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Number.POSITIVE_INFINITY } },
    mutationCache,
  });
  client.setQueryData(orpc.webCaptureLinks.queryKey(), []);
  const host = document.createElement("div");
  const root = createRoot(host);
  document.body.append(host);
  try {
    act(() =>
      root.render(
        <QueryClientProvider client={client}>
          <ExtensionLinksSection
            formattingPreferences={DEFAULT_ACCOUNT_PREFERENCES}
          />
        </QueryClientProvider>,
      ),
    );
    await act(async () => {
      host.querySelector("button")?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await vi.waitFor(() =>
      expect(host.querySelector("code")?.textContent === code).toBe(true),
    );
    expect(mutationCache.getAll()[0]?.state.data).toEqual({ expiresAt });
    expect(leaked).toEqual([false, false]);
  } finally {
    act(() => root.unmount());
    host.remove();
    client.clear();
  }
});
