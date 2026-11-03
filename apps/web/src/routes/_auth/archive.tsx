import { createFileRoute } from "@tanstack/react-router";
import ArchiveSurface from "@/features/project-retirement/ui/components/archive-surface";
import { ClientShellContent } from "@/features/web-macos-client/ui/components/client-shell";

export const Route = createFileRoute("/_auth/archive")({
  component: ArchiveRoute,
});

function ArchiveRoute() {
  return (
    <ClientShellContent>
      <main className="mx-auto w-full max-w-4xl p-4">
        <ArchiveSurface />
      </main>
    </ClientShellContent>
  );
}
