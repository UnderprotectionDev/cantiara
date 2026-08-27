import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_founder/_auth/dashboard")({
	component: RouteComponent,
});

function RouteComponent() {
	return <main className="h-full min-h-0" />;
}
