import { createFileRoute } from "@tanstack/react-router";
import FocusPeriodsView from "@/features/focus-period/ui/focus-periods-view";
import { ClientShellContent } from "@/features/web-macos-client/ui/components/client-shell";

export const Route = createFileRoute("/_auth/focus-periods")({
  component: () => (
    <ClientShellContent>
      <FocusPeriodsView />
    </ClientShellContent>
  ),
});
