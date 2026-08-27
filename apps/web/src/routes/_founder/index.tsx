import { createFileRoute, redirect } from "@tanstack/react-router";

import Login from "@/features/account-access/views/login";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/_founder/")({
	beforeLoad: async () => {
		const session = await authClient.getSession();
		if (session.data?.user) {
			throw redirect({ to: "/dashboard" });
		}
	},
	component: Login,
});
