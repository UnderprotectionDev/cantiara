import { createFileRoute } from "@tanstack/react-router";
import ContactsView from "@/features/contacts/ui/contacts-view";
import { ClientShellContent } from "@/features/web-macos-client/ui/components/client-shell";

export const Route = createFileRoute("/_auth/contacts")({
  component: () => (
    <ClientShellContent>
      <ContactsView />
    </ClientShellContent>
  ),
});
