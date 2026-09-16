import { createFileRoute } from "@tanstack/react-router";
import SessionsView from "@/features/account-access/views/sessions-view";
import { ClientShellContent } from "@/features/web-macos-client/views/client-shell";

export const Route = createFileRoute("/_auth/account/")({
  component: AccountRouteComponent,
});

function AccountRouteComponent() {
  return (
    <ClientShellContent>
      <SessionsView />
    </ClientShellContent>
  );
}
