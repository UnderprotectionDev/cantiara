// @vitest-environment happy-dom
import { DEFAULT_ACCOUNT_PREFERENCES } from "@cantiara/api/account-preferences";
import type { ShareScopePreview } from "@cantiara/api/link-sharing";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { orpc } from "@/utils/orpc";
import LinkSharingSurface from "../link-sharing-surface";

const rpc = vi.hoisted(() => ({
  rotateShareToken: vi.fn(),
  approveShareScope: vi.fn(),
  reshareShareLink: vi.fn(),
}));
vi.mock("@/utils/orpc", async (importActual) => {
  const actual = await importActual<typeof import("@/utils/orpc")>();
  return { ...actual, client: { ...actual.client, ...rpc } };
});

test.each([
  ["Rotate link", "rotateShareToken", "Active"],
  ["Approve scope", "approveShareScope", null],
  ["Reshare with a new link", "reshareShareLink", "Expired"],
] as const)(
  "%s displays the link without exposing its token to the mutation cache or global callbacks",
  async (label, procedure, initialState) => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const record = {
      id: "share-record",
      kind: "Document",
      title: "Guide",
    } as const;
    const surface = {
      expiresAt: null,
      label: "Approved snapshot",
      lastApprovedAt: "2026-09-01T00:00:00Z",
      passwordProtected: false,
      revision: 1,
      state: "Active",
      surfaceId: "share-surface",
    } satisfies NonNullable<ShareScopePreview["surface"]>;
    const preview: ShareScopePreview = {
      blockers: [],
      diff: null,
      items: [],
      placeholders: [],
      projectId: "p1",
      root: record,
      surface: initialState ? { ...surface, state: initialState } : null,
    };
    const queryClient = new QueryClient({
      defaultOptions: { queries: { staleTime: Number.POSITIVE_INFINITY } },
    });
    const key = orpc.previewShareScope.queryKey({
      input: { root: { id: record.id, kind: record.kind } },
    });
    queryClient.setQueryData(key, preview);
    queryClient.setQueryData(
      orpc.shareRoots.queryKey({ input: { projectId: "p1" } }),
      [record],
    );
    queryClient.setQueryData(orpc.accountPreferences.queryKey(), {
      ...DEFAULT_ACCOUNT_PREFERENCES,
      isSaved: false,
      revision: 0,
      savedAt: null,
    });
    const token = crypto.randomUUID();
    const updatedSurface = {
      ...surface,
      surfaceId:
        procedure === "rotateShareToken"
          ? surface.surfaceId
          : "new-share-surface",
    };
    const request = rpc[procedure];
    request.mockClear();
    request.mockResolvedValue({
      ...updatedSurface,
      ...(procedure === "rotateShareToken"
        ? { token }
        : { accessToken: token }),
    });
    const cache = queryClient.getMutationCache();
    const observed: boolean[] = [];
    const recordResult = (data: unknown) => {
      observed.push(JSON.stringify({ data }).includes(token));
    };
    cache.config.onSuccess = (data, variables) =>
      recordResult([data, variables]);
    cache.config.onSettled = (data, error, variables) =>
      recordResult([data, error, variables]);
    const unsubscribe = cache.subscribe(({ mutation }) => {
      if (mutation) {
        recordResult(mutation.state);
      }
    });
    const invalidate = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockImplementation(async () => {
        await Promise.resolve();
        queryClient.setQueryData(key, { ...preview, surface: updatedSurface });
      });
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    try {
      await act(async () => {
        await Promise.resolve();
        root.render(
          <QueryClientProvider client={queryClient}>
            <LinkSharingSurface projectId="p1" />
          </QueryClientProvider>,
        );
      });
      await act(async () => {
        await Promise.resolve();
        const select = host.querySelector("select");
        if (!select) {
          throw new Error("Share record picker did not render");
        }
        select.value = "Document:share-record";
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await act(async () => {
        await Promise.resolve();
        [...host.querySelectorAll("button")]
          .find((button) => button.textContent === label)
          ?.click();
      });
      expect(
        host
          .querySelector<HTMLInputElement>("#share-visitor-link")
          ?.value.endsWith(token),
      ).toBe(true);
      expect(request).toHaveBeenCalledOnce();
      expect(observed.length).toBeGreaterThan(2);
      expect(observed.includes(true)).toBe(false);
      expect(invalidate).toHaveBeenCalledTimes(1);
      expect(invalidate).toHaveBeenCalledWith({ queryKey: key });
    } finally {
      act(() => root.unmount());
      host.remove();
      unsubscribe();
      queryClient.clear();
    }
  },
);
