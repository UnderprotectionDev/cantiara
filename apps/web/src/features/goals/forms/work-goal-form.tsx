import { Button } from "@cantiara/ui/components/button";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { FormEvent } from "react";
import { useCallback } from "react";

import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { invalidateWork } from "@/features/work-lifecycle/forms/invalidate-work";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import { PROJECT_GOAL_COPY } from "../views/project-goals-copy";

export default function WorkGoalForm({
	projectId,
	workId,
}: {
	projectId: string;
	workId: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const listed = useQuery(
		orpc.projectGoals.list.queryOptions({ input: { projectId } })
	);
	const contribute = useMutation(
		orpc.projectGoals.contributeToGoal.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status !== "committed") {
					return;
				}
				await invalidateWork(projectId, workId);
				await queryClient.invalidateQueries({
					predicate: (query) =>
						JSON.stringify(query.queryKey).includes("projectGoals"),
				});
				recordSave();
			},
		})
	);
	const onSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			const form = new FormData(event.currentTarget);
			const goalId = String(form.get("goalId") ?? "");
			if (goalId.length === 0) {
				return;
			}
			markUnsaved();
			const result = attemptOnlineWork("record-create", () =>
				contribute.mutateAsync({
					from: { id: workId, kind: "Work" },
					goalId,
					idempotencyKey: newIdempotencyKey(),
				})
			);
			if (result.status === "refused") {
				return;
			}
			result.value.catch(() => undefined);
		},
		[attemptOnlineWork, contribute, markUnsaved, workId]
	);
	const goals = listed.data ?? [];
	return (
		<form className="flex flex-col gap-3" onSubmit={onSubmit}>
			<Field>
				<FieldLabel htmlFor={`${workId}-goal`}>
					{PROJECT_GOAL_COPY.contributesToGoal}
				</FieldLabel>
				<NativeSelect defaultValue="" id={`${workId}-goal`} name="goalId">
					<NativeSelectOption value="">
						{PROJECT_GOAL_COPY.projectGoal}
					</NativeSelectOption>
					{goals.map((goal) => (
						<NativeSelectOption key={goal.id} value={goal.id}>
							{goal.title}
						</NativeSelectOption>
					))}
				</NativeSelect>
			</Field>
			<Button disabled={goals.length === 0} size="sm" type="submit">
				{PROJECT_GOAL_COPY.contributesToGoal}
			</Button>
		</form>
	);
}
