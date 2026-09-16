import { Button } from "@cantiara/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";

import { isTauriRuntime, openTauriGitHubSignIn } from "../tauri-session";
import { createGitHubSignInCallbackUrl } from "./github-sign-in-url";
import GitHubWaitingStatus from "./github-waiting-status";

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
    <main className="mx-auto mt-10 w-full max-w-md p-6">
      <h1 className="mb-6 text-center font-bold text-3xl">
        Welcome to Cantiara
      </h1>
      <Button
        aria-busy={isWaitingForGitHub}
        className="w-full"
        disabled={isWaitingForGitHub}
        onClick={signIn}
        type="button"
      >
        Continue with GitHub
      </Button>
      <GitHubWaitingStatus
        visible={isWaitingForGitHub || isGitHubUnavailable}
      />
    </main>
  );
}
