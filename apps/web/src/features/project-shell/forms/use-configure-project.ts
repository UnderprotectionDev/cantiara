import { useMutation } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import { configureProjectError } from "./configure-project-error";

type ConfigureChange =
	| { action: "add-stage"; name: string }
	| { action: "rename-stage"; name: string; stageId: string }
	| { action: "set-stage-state"; stageId: string; state: string }
	| { action: "reorder-stages"; stageIds: string[] }
	| { action: "remove-stage"; stageId: string }
	| { action: "set-area-enabled"; area: string; enabled: boolean }
	| { action: "pin-to-navigation"; area: string }
	| { action: "unpin-from-navigation"; area: string }
	| { action: "restore-default-navigation" }
	| { action: "rename-work-status"; label: string; semantic: string };

export function useConfigureProject(projectId: string, revision: number) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [error, setError] = useState<string | null>(null);
	const configure = useMutation(
		orpc.projectShell.configure.mutationOptions({
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
				const message = configureProjectError(outcome);
				if (message) {
					setError(message);
				}
			},
		})
	);
	const run = useCallback(
		async (change: ConfigureChange) => {
			setError(null);
			markUnsaved();
			const result = attemptOnlineWork("record-create", () =>
				configure.mutateAsync({
					baseRevision: revision,
					change,
					idempotencyKey: newIdempotencyKey(),
					projectId,
				})
			);
			if (result.status === "refused") {
				return;
			}
			return await result.value;
		},
		[attemptOnlineWork, configure, markUnsaved, projectId, revision]
	);
	return {
		error,
		isPending: configure.isPending,
		run,
	};
}
