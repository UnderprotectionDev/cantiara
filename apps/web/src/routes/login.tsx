import { createFileRoute } from "@tanstack/react-router";

import Login from "@/features/account-access/views/login";

export const Route = createFileRoute("/login")({
	component: Login,
});
