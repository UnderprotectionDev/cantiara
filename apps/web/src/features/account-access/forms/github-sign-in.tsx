import { Button } from "@cantiara/ui/components/button";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";

import { createGitHubSignInCallbackUrl } from "./github-sign-in-url";

const SIGN_IN_FAILURE_MESSAGE =
  "Sign-in could not be completed. Please try again.";

export default function GitHubSignIn() {
  async function signIn() {
    const result = await authClient.signIn.social({
      callbackURL: createGitHubSignInCallbackUrl(window.location.origin),
      provider: "github",
    });

    if (result.error) {
      toast.error(SIGN_IN_FAILURE_MESSAGE);
    }
  }

  return (
    <main className="mx-auto mt-10 w-full max-w-md p-6">
      <h1 className="mb-6 text-center font-bold text-3xl">
        Welcome to Cantiara
      </h1>
      <Button className="w-full" onClick={signIn} type="button">
        Continue with GitHub
      </Button>
    </main>
  );
}
