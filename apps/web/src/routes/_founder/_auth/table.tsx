import { createFileRoute } from "@tanstack/react-router";

import { RECORD_DISCOVERY_COPY } from "@/features/record-discovery/views/record-discovery-copy";
import { TypeScopedTable } from "@/features/record-discovery/views/type-scoped-table";

function tableSearch(search: Record<string, unknown>): { kind: string } {
	return {
		kind:
			typeof search.kind === "string" && search.kind.length > 0
				? search.kind
				: RECORD_DISCOVERY_COPY.work,
	};
}

export const Route = createFileRoute("/_founder/_auth/table")({
	component: TableRoute,
	validateSearch: tableSearch,
});

function TableRoute() {
	const { kind } = Route.useSearch();
	return <TypeScopedTable kind={kind} />;
}
