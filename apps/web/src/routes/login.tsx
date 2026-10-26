import { createFileRoute } from "@tanstack/react-router";

import GitHubSignInView from "@/features/account-access/ui/views/github-sign-in-view";

export const Route = createFileRoute("/login")({
  component: GitHubSignInView,
});
