import { createFileRoute } from "@tanstack/react-router";
import SharesAndPublicationsSurface from "@/features/external-surface-management/ui/components/shares-and-publications-surface";
import { ClientShellContent } from "@/features/web-macos-client/ui/components/client-shell";

export const Route = createFileRoute("/_auth/shares-and-publications")({
  component: SharesAndPublicationsRoute,
});

function SharesAndPublicationsRoute() {
  return (
    <ClientShellContent>
      <main className="mx-auto w-full max-w-5xl p-4">
        <SharesAndPublicationsSurface />
      </main>
    </ClientShellContent>
  );
}
