import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";

import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/dashboard")({
  beforeLoad: async ({ context }) => {
    const accountPreferences = await context.queryClient.ensureQueryData(
      context.orpc.accountPreferences.queryOptions(),
    );
    if (!accountPreferences.isSaved) {
      throw redirect({ to: "/account/preferences" });
    }
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { session } = Route.useRouteContext();

  const privateData = useQuery(orpc.privateData.queryOptions());

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Welcome {session.data?.user.name}</p>
      <p>API: {privateData.data?.message}</p>
    </div>
  );
}
