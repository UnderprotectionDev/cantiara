import { createFileRoute } from "@tanstack/react-router";

import Login from "@/features/account-access/views/login";

export const Route = createFileRoute("/_founder/login")({
	component: LoginRoute,
	validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
		redirect: typeof search.redirect === "string" ? search.redirect : undefined,
	}),
});

function LoginRoute() {
	const { redirect } = Route.useSearch();
	return <Login redirect={redirect} />;
}
