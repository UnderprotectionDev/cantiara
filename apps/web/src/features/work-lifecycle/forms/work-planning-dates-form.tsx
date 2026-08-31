import { Button } from "@cantiara/ui/components/button";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import { useMutation } from "@tanstack/react-query";
import type { FormEvent } from "react";
import { useCallback, useState } from "react";

import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc } from "@/utils/orpc";

import { invalidateWork } from "./invalidate-work";
import { WORK_LIFECYCLE_COPY } from "./work-lifecycle-copy";

export default function WorkPlanningDatesForm({
	projectId,
	reappearDate,
	revision,
	targetDate,
	workId,
}: {
	projectId: string;
	reappearDate: string | null;
	revision: number;
	targetDate: string | null;
	workId: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [error, setError] = useState<string | null>(null);
	const save = useMutation(
		orpc.workLifecycle.updatePlanningDates.mutationOptions({
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
			setError(null);
			markUnsaved();
			const form = new FormData(event.currentTarget);
			const nextTarget = String(form.get("targetDate") ?? "");
			const nextReappear = String(form.get("reappearDate") ?? "");
			const result = attemptOnlineWork("record-create", () =>
				save.mutateAsync({
					baseRevision: revision,
					idempotencyKey: newIdempotencyKey(),
					reappearDate: nextReappear === "" ? null : nextReappear,
					targetDate: nextTarget === "" ? null : nextTarget,
					workId,
				})
			);
			if (result.status === "refused") {
				return;
			}
			result.value.catch(() => undefined);
		},
		[attemptOnlineWork, markUnsaved, revision, save, workId]
	);
	return (
		<form className="flex flex-col gap-3" onSubmit={onSubmit}>
			<Field>
				<FieldLabel htmlFor={`${workId}-target-date`}>
					{WORK_LIFECYCLE_COPY.targetDate}
				</FieldLabel>
				<Input
					defaultValue={targetDate ?? ""}
					id={`${workId}-target-date`}
					name="targetDate"
					type="date"
				/>
			</Field>
			<Field>
				<FieldLabel htmlFor={`${workId}-reappear-date`}>
					{WORK_LIFECYCLE_COPY.reappearDate}
				</FieldLabel>
				<Input
					defaultValue={reappearDate ?? ""}
					id={`${workId}-reappear-date`}
					name="reappearDate"
					type="date"
				/>
			</Field>
			{error ? <p className="text-destructive text-sm">{error}</p> : null}
			<Button size="sm" type="submit">
				{WORK_LIFECYCLE_COPY.save}
			</Button>
		</form>
	);
}
