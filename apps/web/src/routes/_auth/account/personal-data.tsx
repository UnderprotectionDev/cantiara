import { createFileRoute } from "@tanstack/react-router";
import PersonalDataSurface from "@/features/personal-data-rights/ui/components/personal-data-surface";
import { ClientShellContent } from "@/features/web-macos-client/ui/components/client-shell";

export const Route = createFileRoute("/_auth/account/personal-data")({
  component: PersonalDataRoute,
});

function PersonalDataRoute() {
  return (
    <ClientShellContent>
      <main className="mx-auto w-full max-w-3xl p-4">
        <PersonalDataSurface />
      </main>
    </ClientShellContent>
  );
}
