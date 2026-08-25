import { Button } from "@cantiara/ui/components/button";
import { useMutation } from "@tanstack/react-query";

import { orpc, queryClient } from "@/utils/orpc";

export default function RevokeSession({
	device,
	sessionId,
}: {
	device: string;
	sessionId: string;
}) {
	const mutation = useMutation(
		orpc.accountAccess.revokeSession.mutationOptions({
			onSuccess: async () => {
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
