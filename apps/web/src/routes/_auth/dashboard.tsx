import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { ClientShellContent } from "@/features/web-macos-client/views/client-shell";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/dashboard")({
  component: RouteComponent,
});

function RouteComponent() {
  const { session } = Route.useRouteContext();

  const privateData = useQuery(orpc.privateData.queryOptions());

  return (
    <ClientShellContent>
      <div>
        <h1>Dashboard</h1>
        <p>Welcome {session.data?.user.name}</p>
        <p>API: {privateData.data?.message}</p>
      </div>
    </ClientShellContent>
  );
}
