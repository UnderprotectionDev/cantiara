import { createFileRoute } from "@tanstack/react-router";

import Sessions from "@/features/account-access/views/sessions";

export const Route = createFileRoute("/_auth/sessions")({
	component: Sessions,
});
