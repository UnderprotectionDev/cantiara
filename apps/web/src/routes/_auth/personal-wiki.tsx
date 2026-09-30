import { createFileRoute } from "@tanstack/react-router";
import PersonalWikiSurface from "@/features/personal-wiki/ui/components/personal-wiki-surface";
import { ClientShellContent } from "@/features/web-macos-client/ui/components/client-shell";

export const Route = createFileRoute("/_auth/personal-wiki")({
  component: PersonalWikiRoute,
});

function PersonalWikiRoute() {
  return (
    <ClientShellContent>
      <PersonalWikiSurface />
    </ClientShellContent>
  );
}
