import { Button } from "@cantiara/ui/components/button";
import { useMutation } from "@tanstack/react-query";

import { afterRevokeSession } from "@/features/account-access/forms/after-revoke-session";
import { orpc, queryClient } from "@/utils/orpc";

export default function RevokeSession({
	current,
	device,
	sessionId,
}: {
	current: boolean;
	device: string;
	sessionId: string;
}) {
	const mutation = useMutation(
		orpc.accountAccess.revokeSession.mutationOptions({
			onSuccess: async () => {
				const next = afterRevokeSession(current);
				if (next) {
					window.location.assign(next);
					return;
				}
				await queryClient.invalidateQueries({
					queryKey: orpc.accountAccess.sessions.queryKey(),
				});
			},
		})
	);

	return (
		<Button
			aria-label={`Revoke Session ${device}`}
			disabled={mutation.isPending}
			size="sm"
			type="button"
			variant="destructive"
			onClick={() => {
				mutation.mutate({ sessionId });
			}}
		>
			Revoke Session
		</Button>
	);
}
