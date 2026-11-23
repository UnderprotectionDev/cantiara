// @vitest-environment happy-dom
import { DEFAULT_ACCOUNT_PREFERENCES } from "@cantiara/api/account-preferences";
import type { ShareScopePreview } from "@cantiara/api/link-sharing";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, type ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, onTestFinished, test, vi } from "vitest";
import { orpc } from "@/utils/orpc";
import LinkSharingSurface from "../link-sharing-surface";

const rpc = vi.hoisted(() => ({
  rotateShareToken: vi.fn(),
  approveShareScope: vi.fn(),
  reshareShareLink: vi.fn(),
  revokeShareLink: vi.fn(),
}));
const useRouteContext = vi.hoisted(() => vi.fn());
vi.mock("@tanstack/react-router", () => ({ useRouteContext }));

vi.mock("@/utils/orpc", async (importActual) => {
  const actual = await importActual<typeof import("@/utils/orpc")>();
  return { ...actual, client: { ...actual.client, ...rpc } };
});

const guide = { id: "guide", kind: "Document", title: "Guide" } as const;
const notes = { id: "notes", kind: "Document", title: "Notes" } as const;
const guideKey = "Document:guide";
const notesKey = "Document:notes";
const surface = {
  expiresAt: null,
  label: "Approved snapshot",
  lastApprovedAt: "2026-09-01T00:00:00Z",
  passwordProtected: false,
  revision: 1,
  state: "Active",
  surfaceId: "guide-share",
} satisfies NonNullable<ShareScopePreview["surface"]>;
const previewKey = ({ id, kind }: ShareScopePreview["root"]) =>
  orpc.previewShareScope.queryKey({ input: { root: { id, kind } } });

function mountShare(initialState: "Active" | "Expired" | null = "Active") {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  function setAccount(accountId: string) {
    useRouteContext.mockReturnValue({
      session: { data: { user: { id: accountId } } },
    });
  }
  setAccount("account");
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: Number.POSITIVE_INFINITY } },
  });
  const preview: ShareScopePreview = {
    blockers: [],
    diff: null,
    items: [],
    placeholders: [],
    projectId: "p1",
    root: guide,
    surface: initialState ? { ...surface, state: initialState } : null,
  };
  const setPreview = (next: ShareScopePreview["surface"]) => {
    queryClient.setQueryData(previewKey(guide), { ...preview, surface: next });
  };
  setPreview(preview.surface);
  queryClient.setQueryData(previewKey(notes), {
    ...preview,
    root: notes,
    surface: { ...surface, surfaceId: "notes-share" },
  });
  for (const projectId of ["p1", "p2"]) {
    queryClient.setQueryData(
      orpc.shareRoots.queryKey({ input: { projectId } }),
      [guide, notes],
    );
  }
  queryClient.setQueryData(orpc.accountPreferences.queryKey(), {
    ...DEFAULT_ACCOUNT_PREFERENCES,
    isSaved: false,
    revision: 0,
    savedAt: null,
  });
  const invalidate = vi
    .spyOn(queryClient, "invalidateQueries")
    .mockResolvedValue(undefined);
  const refetch = vi
    .spyOn(queryClient, "refetchQueries")
    .mockResolvedValue(undefined);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  let props: ComponentProps<typeof LinkSharingSurface> = {
    onSelectRoot: (selectedKey) => render({ selectedKey }),
    projectId: "p1",
    selectedKey: guideKey,
  };

  function render(next: Partial<typeof props> = {}) {
    props = { ...props, ...next };
    root.render(
      <QueryClientProvider client={queryClient}>
        <LinkSharingSurface {...props} />
      </QueryClientProvider>,
    );
  }

  act(() => render());
  onTestFinished(() => {
    act(() => root.unmount());
    host.remove();
    queryClient.clear();
  });
  return {
    click: (label: string, inDialog = false) =>
      act(async () => {
        const container = inDialog
          ? document.querySelector('[role="alertdialog"]')
          : host;
        const button = [...(container?.querySelectorAll("button") ?? [])].find(
          (candidate) => candidate.textContent === label && !candidate.disabled,
        );
        if (!button) {
          throw new Error(`Enabled Share button not found: ${label}`);
        }
        button.click();
        await Promise.resolve();
      }),
    close: () => act(() => root.render(null)),
    switchAccount: () => {
      setAccount("other-account");
      act(() => render());
    },
    host,
    invalidate,
    link: () =>
      host.querySelector<HTMLInputElement>("#share-visitor-link")?.value,
    token: () =>
      host
        .querySelector<HTMLInputElement>("#share-visitor-link")
        ?.value.split("/s/")[1],
    queryClient,
    refetch,
    render: (next?: Partial<typeof props>) => act(() => render(next)),
    select: (key: string) =>
      act(async () => {
        const select = host.querySelector("select");
        if (!select) {
          throw new Error("Record to share picker did not render");
        }
        select.value = key;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        await Promise.resolve();
      }),
    setPreview,
    button: (label: string) =>
      [...host.querySelectorAll("button")].find(
        (button) => button.textContent === label,
      ),
  };
}

afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

test("returning to a Share root leaves its previously issued link hidden", async () => {
  const share = mountShare();
  rpc.rotateShareToken.mockResolvedValue({ ...surface, token: "guide-token" });
  await share.click("Rotate link");
  expect(share.token()).toBe("guide-token");

  await share.select(notesKey);
  await share.select(guideKey);
  expect(share.link()).toBeUndefined();
});

test("a Share reload after the record picker became unavailable leaves the link hidden", async () => {
  const share = mountShare();
  rpc.rotateShareToken.mockResolvedValueOnce({
    ...surface,
    token: "previous-link",
  });
  await share.click("Rotate link");
  await vi.waitFor(() => expect(share.token()).toBe("previous-link"));

  const queryKey = orpc.shareRoots.queryKey({ input: { projectId: "p1" } });
  await act(async () => {
    await expect(
      share.queryClient.fetchQuery({
        queryFn: () => Promise.reject(new Error("Share is unavailable")),
        queryKey,
        staleTime: 0,
      }),
    ).rejects.toThrow("Share is unavailable");
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await vi.waitFor(() =>
    expect(share.host.textContent).toContain("Share is unavailable."),
  );

  await act(async () => {
    share.queryClient.setQueryData(queryKey, [guide, notes]);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await vi.waitFor(() => expect(share.button("Rotate link")).toBeDefined());
  expect(share.link()).toBeUndefined();
});

test.each([
  ["Rotate link", "rotateShareToken", "Active"],
  ["Approve scope", "approveShareScope", null],
  ["Reshare with a new link", "reshareShareLink", "Expired"],
  ["Rotate link after a retry", "rotateShareToken", "Active"],
] as const)(
  "%s displays the link without exposing its token to the mutation cache or global callbacks",
  async (label, procedure, initialState) => {
    const share = mountShare(initialState);
    const token = crypto.randomUUID();
    const updatedSurface = {
      ...surface,
      surfaceId:
        procedure === "rotateShareToken"
          ? surface.surfaceId
          : "new-share-surface",
    };
    const request = rpc[procedure];
    request.mockResolvedValue({
      ...updatedSurface,
      ...(procedure === "rotateShareToken"
        ? { token }
        : { accessToken: token }),
    });
    const retry = label === "Rotate link after a retry";
    if (retry) {
      request.mockRejectedValueOnce(new Error("The link was not rotated."));
    }
    const cache = share.queryClient.getMutationCache();
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
        recordResult({
          key: mutation.options.mutationKey,
          state: mutation.state,
        });
      }
    });
    try {
      share.invalidate.mockImplementation(() => {
        if (!retry || request.mock.calls.length > 1) {
          share.setPreview(updatedSurface);
        }
        return Promise.resolve();
      });
      await share.click(retry ? "Rotate link" : label);
      if (retry) {
        await vi.waitFor(() =>
          expect(share.host.querySelector('[role="alert"]')?.textContent).toBe(
            "That did not work. Try again.",
          ),
        );
        expect(share.link()).toBeUndefined();
        const mutation = cache.getAll().at(-1);
        if (!mutation) {
          throw new Error("Rotate link did not register its mutation");
        }
        await act(async () => {
          await mutation.execute(mutation.state.variables);
        });
        await vi.waitFor(() =>
          expect(share.host.textContent).toContain(
            "New link created. The old link and every open visit ended.",
          ),
        );
        expect(share.host.querySelector('[role="alert"]')).toBeNull();
      }
      await vi.waitFor(() => expect(share.link()?.endsWith(token)).toBe(true));
      const attempts = retry ? 2 : 1;
      expect(request).toHaveBeenCalledTimes(attempts);
      expect(observed.length).toBeGreaterThan(2);
      expect(observed).not.toContain(true);
      expect(
        JSON.stringify(
          share.queryClient
            .getQueryCache()
            .getAll()
            .map(({ queryKey, state }) => ({ queryKey, state })),
        ),
      ).not.toContain(token);
      expect(share.invalidate).toHaveBeenCalledTimes(attempts);
      expect(share.invalidate).toHaveBeenCalledWith({
        queryKey: previewKey(guide),
      });
    } finally {
      unsubscribe();
    }
  },
);

async function resolveResult<T>(request: PromiseWithResolvers<T>, result: T) {
  await act(async () => {
    request.resolve(result);
    await request.promise;
  });
}

test.each([
  ["Rotate link", rpc.rotateShareToken, "Active"],
  ["Approve scope", rpc.approveShareScope, null],
  ["Reshare with a new link", rpc.reshareShareLink, "Expired"],
] as const)(
  "discards a delayed %s after leaving and returning to the same root",
  async (label, procedure, state) => {
    const share = mountShare(state);
    const request = Promise.withResolvers<unknown>();
    procedure.mockReturnValueOnce(request.promise);
    await share.click(label);
    expect(procedure).toHaveBeenCalledOnce();

    await share.select(notesKey);
    await share.select(guideKey);
    share.invalidate.mockImplementation(() => {
      share.setPreview(surface);
      return Promise.resolve();
    });
    await resolveResult(request, {
      ...surface,
      token: "late-rotation",
      accessToken: "late-approval",
    });
    await vi.waitFor(() =>
      expect(share.button("Rotate link")?.disabled).toBe(false),
    );
    expect(share.link()).toBeUndefined();

    rpc.rotateShareToken.mockResolvedValueOnce({
      ...surface,
      token: "fresh-rotation",
    });
    await share.click("Rotate link");
    await vi.waitFor(() => expect(share.token()).toBe("fresh-rotation"));
  },
);

test("discards a delayed rotation after Share closes and reopens", async () => {
  const share = mountShare();
  const old = Promise.withResolvers<unknown>();
  rpc.rotateShareToken.mockReturnValueOnce(old.promise);
  await share.click("Rotate link");
  share.close();
  share.render();
  rpc.rotateShareToken.mockResolvedValueOnce({
    ...surface,
    token: "reopened-link",
  });
  await share.click("Rotate link");
  await vi.waitFor(() => expect(share.token()).toBe("reopened-link"));

  await resolveResult(old, { ...surface, token: "closed-link" });
  expect(share.token()).toBe("reopened-link");
});

test.each(["Project", "Account"] as const)(
  "clears shown and pending links on %s change",
  async (identity) => {
    const share = mountShare();
    rpc.rotateShareToken.mockResolvedValueOnce({
      ...surface,
      token: "previous-link",
    });
    await share.click("Rotate link");
    await vi.waitFor(() => expect(share.token()).toBe("previous-link"));

    const old = Promise.withResolvers<unknown>();
    rpc.rotateShareToken.mockReturnValueOnce(old.promise);
    await share.click("Rotate link");
    if (identity === "Project") {
      share.render({ projectId: "p2" });
    } else {
      share.switchAccount();
    }
    expect(share.link()).toBeUndefined();
    await resolveResult(old, { ...surface, token: "late-link" });
    expect(share.link()).toBeUndefined();
  },
);

test("a successful Revoke clears the link and rejects a pending rotation for it", async () => {
  const share = mountShare();
  rpc.rotateShareToken.mockResolvedValueOnce({
    ...surface,
    token: "revoked-link",
  });
  await share.click("Rotate link");
  await vi.waitFor(() => expect(share.token()).toBe("revoked-link"));

  const rotation = Promise.withResolvers<unknown>();
  rpc.rotateShareToken.mockReturnValueOnce(rotation.promise);
  await share.click("Rotate link");
  const revoke = Promise.withResolvers<unknown>();
  rpc.revokeShareLink.mockReturnValueOnce(revoke.promise);
  await share.click("Revoke");
  await share.click("Revoke", true);
  expect(rpc.revokeShareLink).toHaveBeenCalledWith({
    surfaceId: surface.surfaceId,
  });
  expect(share.token()).toBe("revoked-link");

  // The write completes before the cached preview reports the revocation.
  await resolveResult(revoke, { surfaceId: surface.surfaceId });
  expect(share.link()).toBeUndefined();
  await resolveResult(rotation, { ...surface, token: "revoked-rotation" });
  expect(share.link()).toBeUndefined();
});

test.each(["switch roots", "close Share"] as const)(
  "applies a pending Revoke to the same surface after the user chooses to %s",
  async (action) => {
    const share = mountShare();
    const revoke = Promise.withResolvers<unknown>();
    rpc.revokeShareLink.mockReturnValueOnce(revoke.promise);
    await share.click("Revoke");
    await share.click("Revoke", true);
    expect(rpc.revokeShareLink).toHaveBeenCalledOnce();

    if (action === "switch roots") {
      await share.select(notesKey);
      await share.select(guideKey);
    } else {
      share.close();
      share.render();
    }

    rpc.rotateShareToken.mockResolvedValueOnce({
      ...surface,
      token: "shown-before-revoke",
    });
    await share.click("Rotate link");
    await vi.waitFor(() => expect(share.token()).toBe("shown-before-revoke"));

    const rotation = Promise.withResolvers<unknown>();
    rpc.rotateShareToken.mockReturnValueOnce(rotation.promise);
    await share.click("Rotate link");
    await resolveResult(revoke, { surfaceId: surface.surfaceId });
    await vi.waitFor(() => expect(share.link()).toBeUndefined());
    await resolveResult(rotation, { ...surface, token: "revoked-while-away" });
    expect(share.link()).toBeUndefined();
  },
);

test("a delayed Rotate link cannot overwrite a newer Reshare with a new link", async () => {
  const share = mountShare();
  const rotation = Promise.withResolvers<unknown>();
  rpc.rotateShareToken.mockReturnValueOnce(rotation.promise);
  await share.click("Rotate link");

  await act(async () => {
    share.setPreview({ ...surface, state: "Expired" });
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await vi.waitFor(() =>
    expect(share.host.textContent).toContain("Reshare with a new link"),
  );
  const reshare = Promise.withResolvers<unknown>();
  rpc.reshareShareLink.mockReturnValueOnce(reshare.promise);
  await share.click("Reshare with a new link");
  expect(rpc.reshareShareLink).toHaveBeenCalledOnce();
  const reshared = { ...surface, surfaceId: "reshared-surface" };
  share.invalidate.mockImplementation(() => {
    share.setPreview(reshared);
    return Promise.resolve();
  });
  await resolveResult(reshare, { ...reshared, accessToken: "reshared-link" });
  await vi.waitFor(() => expect(share.token()).toBe("reshared-link"));

  await resolveResult(rotation, { ...surface, token: "superseded-rotation" });
  expect(share.token()).toBe("reshared-link");
});

test("approving a new revision of the same surface does not discard its pending rotation", async () => {
  const share = mountShare();
  rpc.rotateShareToken.mockResolvedValueOnce({
    ...surface,
    token: "previous-link",
  });
  await share.click("Rotate link");
  await vi.waitFor(() => expect(share.token()).toBe("previous-link"));
  await vi.waitFor(() =>
    expect(share.button("Rotate link")?.disabled).toBe(false),
  );

  const rotation = Promise.withResolvers<unknown>();
  rpc.rotateShareToken.mockReturnValueOnce(rotation.promise);
  await share.click("Rotate link");
  rpc.approveShareScope.mockResolvedValueOnce({
    ...surface,
    accessToken: null,
    revision: 2,
  });
  await share.click("Approve scope");
  expect(rpc.approveShareScope).toHaveBeenCalledWith(
    expect.objectContaining({ surfaceId: surface.surfaceId }),
  );

  await resolveResult(rotation, { ...surface, token: "replacement-link" });
  await vi.waitFor(() => expect(share.token()).toBe("replacement-link"));
});

test("Revoke waits for a fresh scope before offering another approval", async () => {
  const share = mountShare();
  const refresh = Promise.withResolvers<void>();
  share.refetch.mockReturnValue(refresh.promise);
  share.invalidate.mockReturnValue(refresh.promise);
  rpc.revokeShareLink.mockResolvedValueOnce({
    revokedAt: surface.lastApprovedAt,
    surfaceId: surface.surfaceId,
  });
  await share.click("Revoke");
  await share.click("Revoke", true);
  await vi.waitFor(() => expect(share.button("Rotate link")).toBeUndefined());
  expect(share.button("Approve scope")).toBeUndefined();

  await act(async () => {
    share.setPreview(null);
    refresh.resolve();
    await refresh.promise;
  });
  await vi.waitFor(() => expect(share.button("Approve scope")).toBeDefined());
});

test("Copy link remains available for repeat copying and Rotate link replaces it", async () => {
  const share = mountShare();
  const writeText = vi.fn(async () => undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  rpc.rotateShareToken
    .mockResolvedValueOnce({ ...surface, token: "first-link" })
    .mockResolvedValueOnce({ ...surface, token: "replacement-link" });
  await share.click("Rotate link");
  await vi.waitFor(() => expect(share.token()).toBe("first-link"));
  const link = share.link();
  await share.click("Copy link");
  await share.click("Copy link");
  expect(writeText.mock.calls).toEqual([[link], [link]]);
  expect(share.link()).toBe(link);

  await share.click("Rotate link");
  await vi.waitFor(() => expect(share.token()).toBe("replacement-link"));
  await share.click("Copy link");
  expect(writeText).toHaveBeenLastCalledWith(share.link());
});

test.each([
  ["Approve scope", rpc.approveShareScope, null, "approvalId"],
  ["Reshare with a new link", rpc.reshareShareLink, "Expired", "newSurfaceId"],
] as const)(
  "reuses the failed %s request identity",
  async (label, procedure, state, identityKey) => {
    const share = mountShare(state);
    const updated = { ...surface, surfaceId: "retry-surface" };
    procedure
      .mockRejectedValueOnce(new Error("Share request failed"))
      .mockResolvedValueOnce({ ...updated, accessToken: "retried-link" });
    share.invalidate.mockImplementation(() => {
      if (procedure.mock.calls.length > 1) {
        share.setPreview(updated);
      }
      return Promise.resolve();
    });
    await share.click(label);
    await vi.waitFor(() =>
      expect(share.host.querySelector('[role="alert"]')).not.toBeNull(),
    );
    expect(share.link()).toBeUndefined();
    await share.click(label);
    await vi.waitFor(() => expect(share.token()).toBe("retried-link"));
    expect(procedure).toHaveBeenCalledTimes(2);
    expect(procedure.mock.calls[0]?.[0][identityKey]).toEqual(
      expect.any(String),
    );
    expect(procedure.mock.calls[1]).toEqual(procedure.mock.calls[0]);
  },
);
