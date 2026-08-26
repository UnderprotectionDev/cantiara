import { Button } from "@cantiara/ui/components/button";
import { useMutation } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import { PROJECT_SHELL_COPY } from "./project-shell-copy";

export default function FirstOpenExplanation({
	body,
	projectId,
	revision,
}: {
	body: string;
	projectId: string;
	revision: number;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [error, setError] = useState<string | null>(null);
	const dismiss = useMutation(
		orpc.projectShell.dismissFirstOpenExplanation.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await queryClient.invalidateQueries({
						queryKey: orpc.projectShell.get.queryKey({
							input: { projectId },
						}),
					});
					recordSave();
					setError(null);
					return;
				}
				setError("Conflict");
			},
		})
	);

	const onDismiss = useCallback(() => {
		setError(null);
		markUnsaved();
		const result = attemptOnlineWork("record-create", () =>
			dismiss.mutateAsync({
				baseRevision: revision,
				idempotencyKey: newIdempotencyKey(),
				projectId,
			})
		);
		if (result.status === "refused") {
			return;
		}
		result.value.catch(() => undefined);
	}, [
		attemptOnlineWork,
		dismiss,
		markUnsaved,
		projectId,
		revision,
	]);

	return (
		<aside>
			<p>{body}</p>
			{error ? <p role="alert">{error}</p> : null}
			<Button disabled={dismiss.isPending} onClick={onDismiss} type="button">
				{PROJECT_SHELL_COPY.dismiss}
			</Button>
		</aside>
	);
}
