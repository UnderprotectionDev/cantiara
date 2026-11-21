// biome-ignore-all lint/performance/noJsxPropsBind: Route callbacks bind navigation to this outlet.
import { createFileRoute } from "@tanstack/react-router";
import FocusPeriodsView from "@/features/focus-period/ui/views/focus-periods-view";
import { ClientShellContent } from "@/features/web-macos-client/ui/components/client-shell";

import { optionalRouteId } from "@/lib/optional-route-id";

export const Route = createFileRoute("/_auth/focus-periods")({
  validateSearch: (search): { period?: string } => ({
    period: optionalRouteId.parse(search.period),
  }),
  component: FocusPeriodsRoute,
});

function FocusPeriodsRoute() {
  const { period } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <ClientShellContent>
      <FocusPeriodsView
        onSelect={(id) => {
          navigate({ search: { period: id } }).catch(() => undefined);
        }}
        selectedId={period}
      />
    </ClientShellContent>
  );
}
