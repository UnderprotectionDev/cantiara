import { useMutation } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import WorkDraftForm from "@/features/work-drafts/forms/work-draft-form";
import type { WorkDraftFormValues } from "@/features/work-drafts/forms/work-draft-form-state";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import { invalidateWork } from "./invalidate-work";
import { WORK_LIFECYCLE_COPY } from "./work-lifecycle-copy";

export default function CreateWorkForm({
	onCreated,
	projectId,
}: {
	onCreated?: (workId: string) => void;
	projectId: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [draftId, setDraftId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const create = useMutation(
		orpc.workLifecycle.create.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await invalidateWork(projectId, outcome.work.id);
					await queryClient.invalidateQueries({
						queryKey: orpc.projectShell.get.queryKey({
							input: { projectId },
						}),
					});
					onCreated?.(outcome.work.id);
					recordSave();
					setError(null);
					return;
				}
				if (outcome.status === "rejected" || outcome.status === "conflict") {
					setError(
						outcome.status === "conflict"
							? "Conflict"
							: WORK_LIFECYCLE_COPY.title
					);
				}
			},
		})
	);
	const onCreate = useCallback(
		(values: WorkDraftFormValues) => {
			setError(null);
			markUnsaved();
			const result = attemptOnlineWork("record-create", () =>
				create.mutateAsync({
					idempotencyKey: newIdempotencyKey(),
					payload: {
						projectId,
						title: values.title,
						type: values.type,
					},
				})
			);
			if (result.status === "refused") {
				return;
			}
			result.value.catch(() => undefined);
		},
		[attemptOnlineWork, create, markUnsaved, projectId]
	);

	return (
		<div className="flex flex-col gap-3">
			<WorkDraftForm
				createDisabled={create.isPending}
				draftId={draftId}
				lockProjectId={projectId}
				onCreate={onCreate}
				onDraftId={setDraftId}
			/>
			{error ? <p role="alert">{error}</p> : null}
		</div>
	);
}
