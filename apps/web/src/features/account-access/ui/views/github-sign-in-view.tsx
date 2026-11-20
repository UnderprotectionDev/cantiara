import { Button } from "@cantiara/ui/components/button";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";
import { createGitHubSignInCallbackUrl } from "../../lib/github-sign-in-url";
import { isTauriRuntime, openTauriGitHubSignIn } from "../../lib/tauri-session";
import GitHubWaitingStatus from "../components/github-waiting-status";

const SIGN_IN_FAILURE_MESSAGE =
  "Sign-in could not be completed. Please try again.";

export default function GitHubSignInView() {
  const githubAvailability = useQuery({
    ...orpc.githubAvailability.queryOptions(),
    retry: false,
  });
  const isGitHubUnavailable = githubAvailability.data?.status === "waiting";

  const signIn = useMutation({
    meta: { presentsSupportFailure: true },
    retry: false,
    mutationFn: async (platform: "tauri" | "web") => {
      try {
        if (platform === "tauri") {
          await openTauriGitHubSignIn();
          return;
        }
        const result = await authClient.signIn.social({
          callbackURL: createGitHubSignInCallbackUrl(window.location.origin),
          provider: "github",
        });
        if (!result.error) {
          return;
        }
      } catch {
        // The SDK response and redirect state stay within the auth transport.
      }
      throw new Error(SIGN_IN_FAILURE_MESSAGE);
    },
    onError: () => toast.error(SIGN_IN_FAILURE_MESSAGE),
  });
  const isWaitingForGitHub =
    signIn.variables === "web" && (signIn.isPending || signIn.isSuccess);

  function startSignIn() {
    signIn.mutate(isTauriRuntime() ? "tauri" : "web");
  }

  return (
    <main className="flex min-h-0 flex-1 items-center justify-center px-5 py-12 sm:px-8">
      <section className="w-full max-w-md rounded-xl border border-border/80 bg-card p-6 sm:p-8">
        <div className="mb-8">
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Welcome to Cantiara
          </h1>
          <p className="mt-3 text-sm/6 text-muted-foreground">
            Sign in with the GitHub identity that owns your Workspace.
          </p>
        </div>
        <Button
          aria-busy={isWaitingForGitHub}
          className="min-h-11 w-full"
          disabled={signIn.isPending || isWaitingForGitHub}
          onClick={startSignIn}
          type="button"
        >
          Continue with GitHub
        </Button>
        <GitHubWaitingStatus
          visible={isWaitingForGitHub || isGitHubUnavailable}
        />
      </section>
    </main>
  );
}
