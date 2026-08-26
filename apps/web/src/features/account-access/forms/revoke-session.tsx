import { Button } from "@cantiara/ui/components/button";
import { useMutation } from "@tanstack/react-query";
import { useCallback } from "react";

import { afterRevokeSession } from "@/features/account-access/forms/after-revoke-session";
import { authClient } from "@/lib/auth-client";
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
					const { clearDesktopSessionToken } = await import(
						"@/features/account-access/forms/tauri-session-token"
					);
					await clearDesktopSessionToken();
					await authClient.signOut();
					window.location.assign(next);
					return;
				}
				await queryClient.invalidateQueries({
					queryKey: orpc.accountAccess.sessions.queryKey(),
				});
			},
		})
	);

	const onRevoke = useCallback(() => {
		mutation.mutate({ sessionId });
	}, [mutation, sessionId]);

	return (
		<Button
			aria-label={`Revoke Session ${device}`}
			disabled={mutation.isPending}
			onClick={onRevoke}
			size="sm"
			type="button"
			variant="destructive"
		>
			Revoke Session
		</Button>
	);
}
