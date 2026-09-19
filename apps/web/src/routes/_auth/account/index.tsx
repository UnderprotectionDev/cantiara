import { createFileRoute } from "@tanstack/react-router";
import AccountView from "@/features/account-access/ui/views/account-view";
import { ClientShellContent } from "@/features/web-macos-client/ui/components/client-shell";

export const Route = createFileRoute("/_auth/account/")({
  component: AccountRouteComponent,
});

function AccountRouteComponent() {
  const { session } = Route.useRouteContext();

  return (
    <ClientShellContent>
      <AccountView accountId={session.data?.user.id ?? ""} />
    </ClientShellContent>
  );
}
