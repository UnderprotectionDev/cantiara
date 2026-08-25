import { Button } from "@cantiara/ui/components/button";
import { useMutation } from "@tanstack/react-query";

import { orpc, queryClient } from "@/utils/orpc";

export default function RevokeOtherSessions() {
	const mutation = useMutation(
		orpc.accountAccess.revokeOtherSessions.mutationOptions({
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
