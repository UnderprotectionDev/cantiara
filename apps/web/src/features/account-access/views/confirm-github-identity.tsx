import { useQuery } from "@tanstack/react-query";

import {
	githubWaitCopy,
	githubWaitPollMs,
} from "@/features/account-access/forms/github-wait";
import { orpc } from "@/utils/orpc";

export default function ConfirmGitHubIdentity() {
	const confirmation = useQuery({
		...orpc.accountAccess.confirmGitHubIdentity.queryOptions(),
		refetchInterval: (query) => githubWaitPollMs(query.state.data?.status),
	});
	const waitingCopy = githubWaitCopy(confirmation.data);

	return (
		<main className="mx-auto w-full max-w-3xl p-6">
			<h1 className="mb-4 font-bold text-2xl">Confirm GitHub Identity</h1>
			{waitingCopy ? (
				<p className="text-muted-foreground" role="status">
					{waitingCopy}
				</p>
			) : null}
		</main>
	);
}
