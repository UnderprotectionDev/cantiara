import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";

import Workspace from "@/features/account-access/views/workspace";
import ProjectList from "@/features/project-shell/views/project-list";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_founder/_auth/dashboard")({
	component: RouteComponent,
});

function RouteComponent() {
	const { session } = Route.useRouteContext();

	const privateData = useQuery(orpc.privateData.queryOptions());

	return (
		<div>
			<h1>Dashboard</h1>
			<p>Welcome {session.data?.user?.name}</p>
			<p>
				<Link to="/capture">Capture Inbox</Link>
			</p>
			<p>
				<Link to="/account">Preferences</Link>
			</p>
			<p>
				<Link to="/sessions">Sessions</Link>
			</p>
			<Workspace />
			<ProjectList />
			<p>API: {privateData.data?.message}</p>
		</div>
	);
}
