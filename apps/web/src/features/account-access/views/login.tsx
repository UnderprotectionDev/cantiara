import { useQuery } from "@tanstack/react-query";

import ContinueWithGitHub from "@/features/account-access/forms/continue-with-github";
import { githubWaitPollMs } from "@/features/account-access/forms/github-wait";
import {
	postSignInPath,
	SESSIONS_PATH,
} from "@/features/account-access/forms/post-sign-in-path";
import { orpc } from "@/utils/orpc";

export default function Login({ redirect }: { redirect?: string }) {
	const returningToSessions = postSignInPath(redirect) === SESSIONS_PATH;
	const availability = useQuery({
		...orpc.accountAccess.githubAvailability.queryOptions(),
		refetchInterval: (query) => githubWaitPollMs(query.state.data?.status),
	});

	return (
		<main className="mx-auto flex min-h-full w-full max-w-sm flex-col justify-center px-6 py-16">
			<p className="mb-12 font-semibold tracking-tight">Cantiara</p>
			<h1 className="font-semibold text-xl tracking-tight">Sign In</h1>
			<p className="mt-2 mb-8 text-muted-foreground text-sm text-pretty">
				{returningToSessions
					? "Sign in to open Sessions."
					: "GitHub identity bound to your Account."}
			</p>
			<ContinueWithGitHub
				availability={availability.data}
				redirect={redirect}
			/>
		</main>
	);
}
