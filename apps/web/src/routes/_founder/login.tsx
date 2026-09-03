import { createFileRoute, redirect } from "@tanstack/react-router";

import {
	completeWebGitHubSignIn,
	githubSignInCodeFromSearch,
} from "@/features/account-access/forms/complete-web-github-sign-in";
import { postSignInPath } from "@/features/account-access/forms/post-sign-in-path";
import Login from "@/features/account-access/views/login";

export const Route = createFileRoute("/_founder/login")({
	beforeLoad: async ({ search }) => {
		const code = githubSignInCodeFromSearch(search);
		if (!code) {
			return;
		}
		const completed = await completeWebGitHubSignIn(code);
		if (completed.ok) {
			throw redirect({
				to: postSignInPath(completed.redirect),
			});
		}
	},
	component: LoginRoute,
	validateSearch: (
		search: Record<string, unknown>
	): { code?: string; redirect?: string } => ({
		code: typeof search.code === "string" ? search.code : undefined,
		redirect: typeof search.redirect === "string" ? search.redirect : undefined,
	}),
});

function LoginRoute() {
	const { redirect: redirectPath } = Route.useSearch();
	return <Login redirect={redirectPath} />;
}
