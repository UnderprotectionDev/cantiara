import { createFileRoute } from "@tanstack/react-router";
import ImportSurface from "@/features/data-import/ui/components/import-surface";
import { ClientShellContent } from "@/features/web-macos-client/ui/components/client-shell";

export const Route = createFileRoute("/_auth/import")({
  component: ImportRoute,
});

function ImportRoute() {
  return (
    <ClientShellContent>
      <main className="mx-auto w-full max-w-5xl p-4">
        <ImportSurface />
      </main>
    </ClientShellContent>
  );
}
