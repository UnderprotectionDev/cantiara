import { Button } from "@cantiara/ui/components/button";
import { useMutation } from "@tanstack/react-query";

import { showMainFlowFailure } from "@/features/web-macos-client/show-main-flow-failure";
import { orpc, queryClient } from "@/utils/orpc";

export default function RevokeOtherSessions() {
	const mutation = useMutation(
		orpc.accountAccess.revokeOtherSessions.mutationOptions({
			onError: (error) => {
				showMainFlowFailure(error, () => {
					mutation.mutate(undefined);
				});
			},
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: orpc.accountAccess.sessions.queryKey(),
				});
			},
		})
	);

	return (
		<Button
			disabled={mutation.isPending}
			type="button"
			variant="outline"
			onClick={() => {
				mutation.mutate(undefined);
			}}
		>
			Revoke Other Sessions
		</Button>
	);
}
