import { Button } from "@cantiara/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";
import { createGitHubSignInCallbackUrl } from "../../lib/github-sign-in-url";
import { isTauriRuntime, openTauriGitHubSignIn } from "../../lib/tauri-session";
import GitHubWaitingStatus from "../components/github-waiting-status";

const SIGN_IN_FAILURE_MESSAGE =
  "Sign-in could not be completed. Please try again.";

export default function GitHubSignIn() {
  const [isWaitingForGitHub, setIsWaitingForGitHub] = useState(false);
  const githubAvailability = useQuery({
    ...orpc.githubAvailability.queryOptions(),
    retry: false,
  });
  const isGitHubUnavailable = githubAvailability.data?.status === "waiting";

  async function signIn() {
    if (isTauriRuntime()) {
      try {
        await openTauriGitHubSignIn();
      } catch {
        toast.error(SIGN_IN_FAILURE_MESSAGE);
      }
      return;
    }

    setIsWaitingForGitHub(true);

    try {
      const result = await authClient.signIn.social({
        callbackURL: createGitHubSignInCallbackUrl(window.location.origin),
        provider: "github",
      });

      if (result.error) {
        setIsWaitingForGitHub(false);
        toast.error(SIGN_IN_FAILURE_MESSAGE);
      }
    } catch {
      setIsWaitingForGitHub(false);
      toast.error(SIGN_IN_FAILURE_MESSAGE);
    }
  }

  return (
    <main className="flex min-h-0 flex-1 items-center justify-center px-5 py-12 sm:px-8">
      <section className="w-full max-w-md rounded-xl border border-border/80 bg-card p-6 sm:p-8">
        <div className="mb-8">
          <h1 className="mt-3 font-semibold text-3xl tracking-tight">
            Welcome to Cantiara
          </h1>
          <p className="mt-3 text-muted-foreground text-sm/6">
            Sign in with the GitHub identity that owns your Workspace.
          </p>
        </div>
        <Button
          aria-busy={isWaitingForGitHub}
          className="min-h-11 w-full"
          disabled={isWaitingForGitHub}
          onClick={signIn}
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
