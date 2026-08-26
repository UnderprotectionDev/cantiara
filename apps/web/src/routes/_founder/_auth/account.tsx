import { createFileRoute } from "@tanstack/react-router";

import Preferences from "@/features/account-preferences/views/preferences";

export const Route = createFileRoute("/_founder/_auth/account")({
	component: Preferences,
});
