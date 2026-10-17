import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import ContactsView from "@/features/contacts/ui/contacts-view";
import { ClientShellContent } from "@/features/web-macos-client/ui/components/client-shell";

export const Route = createFileRoute("/_auth/contacts")({
  validateSearch: (search) => {
    const contact = z.string().min(1).safeParse(search.contact);
    return contact.success ? { contact: contact.data } : {};
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { contact } = Route.useSearch();
  return (
    <ClientShellContent>
      <ContactsView contactId={contact} />
    </ClientShellContent>
  );
}
