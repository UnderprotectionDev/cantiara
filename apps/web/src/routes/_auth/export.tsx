import { createFileRoute } from "@tanstack/react-router";
import ExportSurface from "@/features/data-export/ui/components/export-surface";
import { ClientShellContent } from "@/features/web-macos-client/ui/components/client-shell";

export const Route = createFileRoute("/_auth/export")({
  component: ExportRoute,
});

function ExportRoute() {
  return (
    <ClientShellContent>
      <main className="mx-auto w-full max-w-3xl p-4">
        <ExportSurface />
      </main>
    </ClientShellContent>
  );
}
