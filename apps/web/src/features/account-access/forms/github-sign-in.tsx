import { Button } from "@cantiara/ui/components/button";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { env } from "@/env";
import { authClient } from "@/lib/auth-client";

import { createGitHubSignInCallbackUrl } from "./github-sign-in-url";
import GitHubWaitingStatus from "./github-waiting-status";

const SIGN_IN_FAILURE_MESSAGE =
  "Sign-in could not be completed. Please try again.";
const GITHUB_AVAILABILITY_PATH = "/api/account-access/github/availability";
const TRAILING_SLASH_PATTERN = /\/$/;

function useGitHubAvailabilityWaiting() {
  const [isGitHubUnavailable, setIsGitHubUnavailable] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const url = `${env.VITE_SERVER_URL.replace(TRAILING_SLASH_PATTERN, "")}${GITHUB_AVAILABILITY_PATH}`;

    async function readAvailability() {
      try {
        const response = await fetch(url, {
          credentials: "include",
          signal: controller.signal,
        });
        if (!response.ok) {
          return;
        }
        const body = (await response.json()) as { status?: unknown };
        if (!controller.signal.aborted) {
          setIsGitHubUnavailable(body.status === "waiting");
        }
      } catch {
        // Availability is best-effort; the sign-in action reports its own errors.
      }
    }

    readAvailability().catch(() => undefined);

    return () => controller.abort();
  }, []);

  return isGitHubUnavailable;
}

export default function GitHubSignIn() {
  const [isWaitingForGitHub, setIsWaitingForGitHub] = useState(false);
  const isGitHubUnavailable = useGitHubAvailabilityWaiting();

  async function signIn() {
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
