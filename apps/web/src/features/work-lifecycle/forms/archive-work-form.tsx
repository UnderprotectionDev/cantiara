import { Button } from "@cantiara/ui/components/button";
import { useMutation } from "@tanstack/react-query";
import type { FormEvent } from "react";
import { useCallback, useState } from "react";

import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc } from "@/utils/orpc";

import { invalidateWork } from "./invalidate-work";
import { WORK_LIFECYCLE_COPY } from "./work-lifecycle-copy";

export default function ArchiveWorkForm({
	archived,
	projectId,
	revision,
	workId,
}: {
	archived: boolean;
	projectId: string;
	revision: number;
	workId: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [error, setError] = useState<string | null>(null);
	const procedure = archived
		? orpc.workLifecycle.unarchive
		: orpc.workLifecycle.archive;
	const mutation = useMutation(
		procedure.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await invalidateWork(projectId, workId);
					recordSave();
					setError(null);
					return;
				}
				setError("Conflict");
			},
		})
	);
	const onSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			markUnsaved();
			const result = attemptOnlineWork("record-create", () =>
				mutation.mutateAsync({
					baseRevision: revision,
					idempotencyKey: newIdempotencyKey(),
					workId,
				})
			);
			if (result.status === "refused") {
				return;
			}
			result.value.catch(() => undefined);
		},
		[attemptOnlineWork, markUnsaved, mutation, revision, workId]
	);

	return (
		<form className="flex flex-col gap-3" onSubmit={onSubmit}>
			<Button disabled={mutation.isPending} type="submit">
				{archived
					? WORK_LIFECYCLE_COPY.unarchive
					: WORK_LIFECYCLE_COPY.archive}
			</Button>
			{error ? <p role="alert">{error}</p> : null}
		</form>
	);
}
