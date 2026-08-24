import { createFileRoute } from "@tanstack/react-router";

import GitHubSignInButton from "@/components/github-sign-in-button";

export const Route = createFileRoute("/login")({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<div className="mx-auto mt-16 w-full max-w-md p-6">
			<h1 className="mb-2 text-center font-bold text-3xl">Cantiara</h1>
			<p className="mb-8 text-center text-muted-foreground text-sm">
				Sign in with the GitHub identity bound to your Account.
			</p>
			<GitHubSignInButton />
		</div>
	);
}
