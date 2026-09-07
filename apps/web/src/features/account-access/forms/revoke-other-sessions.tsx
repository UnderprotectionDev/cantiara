import { Button } from "@cantiara/ui/components/button";
import { useMutation } from "@tanstack/react-query";
import { useCallback } from "react";

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
	const onRevoke = useCallback(() => {
		mutation.mutate(undefined);
	}, [mutation.mutate]);

	return (
		<Button
			disabled={mutation.isPending}
			onClick={onRevoke}
			type="button"
			variant="outline"
		>
			Revoke Other Sessions
		</Button>
	);
}
