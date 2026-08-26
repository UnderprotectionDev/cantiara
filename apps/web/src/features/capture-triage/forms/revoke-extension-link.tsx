import { Button } from "@cantiara/ui/components/button";
import { useMutation } from "@tanstack/react-query";
import { useCallback } from "react";

import { orpc, queryClient } from "@/utils/orpc";

export default function RevokeExtensionLink({
	browser,
	device,
	linkId,
}: {
	browser: string;
	device: string;
	linkId: string;
}) {
	const mutation = useMutation(
		orpc.captureInbox.revokeExtensionLink.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: orpc.captureInbox.listExtensionLinks.queryKey(),
				});
			},
		})
	);
	const onRevoke = useCallback(() => {
		mutation.mutate({ id: linkId });
	}, [linkId, mutation]);

	return (
		<Button
			aria-label={`Revoke ${device} ${browser}`}
			disabled={mutation.isPending}
			onClick={onRevoke}
			size="sm"
			type="button"
			variant="destructive"
		>
			Revoke
		</Button>
	);
}
