import { createFileRoute } from "@tanstack/react-router";

import SessionsView from "@/features/account-access/views/sessions-view";

export const Route = createFileRoute("/_auth/account/")({
  component: SessionsView,
});
