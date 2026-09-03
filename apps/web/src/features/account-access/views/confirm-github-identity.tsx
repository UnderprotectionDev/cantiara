import { useQuery } from "@tanstack/react-query";

import {
	confirmGitHubIdentityStatus,
	githubWaitPollMs,
} from "@/features/account-access/forms/github-wait";
import { FounderPage } from "@/features/personal-shell/components/founder-page";
import { orpc } from "@/utils/orpc";

export default function ConfirmGitHubIdentity() {
	const confirmation = useQuery({
		...orpc.accountAccess.confirmGitHubIdentity.queryOptions(),
		refetchInterval: (query) => githubWaitPollMs(query.state.data?.status),
	});
	const status = confirmGitHubIdentityStatus({
		confirmation: confirmation.data,
		isError: confirmation.isError,
		isPending: confirmation.isPending,
	});

	return (
		<FounderPage title="Confirm GitHub Identity">
			{status ? (
				<p className="text-muted-foreground text-sm" role="status">
					{status.text}
				</p>
			) : null}
		</FounderPage>
	);
}
