import { createFileRoute } from "@tanstack/react-router";

import ConfirmGitHubIdentity from "@/features/account-access/views/confirm-github-identity";

export const Route = createFileRoute("/_founder/_auth/confirm-github-identity")(
	{
		component: ConfirmGitHubIdentity,
	}
);
