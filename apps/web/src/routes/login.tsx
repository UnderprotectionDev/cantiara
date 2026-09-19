import { createFileRoute } from "@tanstack/react-router";

import GitHubSignIn from "@/features/account-access/ui/forms/github-sign-in";

export const Route = createFileRoute("/login")({
  component: RouteComponent,
});

function RouteComponent() {
  return <GitHubSignIn />;
}
