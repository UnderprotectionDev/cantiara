import { createFileRoute } from "@tanstack/react-router";

import PreparedIndexArea from "@/features/record-discovery/views/prepared-index-area";
import { preparedIndexSearch } from "@/features/record-discovery/views/prepared-index-search";

export const Route = createFileRoute("/_founder/_auth/indexes")({
	component: PreparedIndexRoute,
	validateSearch: preparedIndexSearch,
});

function PreparedIndexRoute() {
	const search = Route.useSearch();
	return <PreparedIndexArea search={search} />;
}
