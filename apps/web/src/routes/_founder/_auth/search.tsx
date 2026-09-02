import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_founder/_auth/search")({
	beforeLoad: () => {
		throw redirect({ to: "/dashboard" });
	},
});
