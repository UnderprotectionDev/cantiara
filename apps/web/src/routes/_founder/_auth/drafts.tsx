import { createFileRoute } from "@tanstack/react-router";

import DraftsArea from "@/features/work-drafts/views/drafts-area";

export const Route = createFileRoute("/_founder/_auth/drafts")({
	component: DraftsArea,
});
