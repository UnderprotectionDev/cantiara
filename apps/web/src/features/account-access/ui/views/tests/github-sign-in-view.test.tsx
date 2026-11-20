// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signIn: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { signIn: { social: mocks.signIn } },
}));
vi.mock("sonner", () => ({ toast: { error: mocks.toast } }));
vi.mock("@/utils/orpc", () => ({
  orpc: {
    githubAvailability: {
      queryOptions: () => ({
        queryFn: () => Promise.resolve({ status: "available" }),
        queryKey: ["githubAvailability"],
      }),
    },
  },
}));
vi.mock("../../../lib/tauri-session", () => ({
  isTauriRuntime: () => false,
  openTauriGitHubSignIn: vi.fn(),
}));

import GitHubSignInView from "../github-sign-in-view";

test("Continue with GitHub allows retry after failure and keeps the OAuth response out of Query", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const queryClient = new QueryClient();
  const rootElement = document.createElement("div");
  const root = createRoot(rootElement);
  mocks.signIn
    .mockResolvedValueOnce({ error: { message: "GitHub unavailable" } })
    .mockResolvedValueOnce({
      data: {
        redirect: true,
        url: "https://github.invalid/oauth?state=example",
      },
      error: null,
    });

  try {
    await act(async () =>
      root.render(
        <QueryClientProvider client={queryClient}>
          <GitHubSignInView />
        </QueryClientProvider>,
      ),
    );
    const button = rootElement.querySelector("button");
    expect(button?.textContent).toBe("Continue with GitHub");
    await act(async () => button?.click());
    await vi.waitFor(() => {
      expect(mocks.toast).toHaveBeenCalledWith(
        "Sign-in could not be completed. Please try again.",
      );
      expect(button?.disabled).toBe(false);
    });
    await act(async () => button?.click());
    await vi.waitFor(() => {
      expect(button?.disabled).toBe(true);
      expect(rootElement.textContent).toContain("Waiting for GitHub");
    });
    const [started, completed] = queryClient.getMutationCache().getAll();
    expect(started?.state.status).toBe("error");
    expect(completed?.state.status).toBe("success");
    expect(completed?.state.data).toBeUndefined();
    expect(completed?.state.variables).toBe("web");
  } finally {
    await act(async () => root.unmount());
    queryClient.clear();
  }
});
