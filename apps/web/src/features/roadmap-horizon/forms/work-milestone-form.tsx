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
import { orpc } from "@/utils/orpc";

import { ROADMAP_COPY } from "../views/roadmap-copy";

export default function WorkMilestoneForm({
	projectId,
	workId,
}: {
	projectId: string;
	workId: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const listed = useQuery(
		orpc.roadmapHorizon.listMilestones.queryOptions({
			input: { projectId },
		})
	);
	const contribute = useMutation(
		orpc.roadmapHorizon.contributeToMilestone.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status !== "committed") {
					return;
				}
				await invalidateWork(projectId, workId);
				recordSave();
			},
		})
	);
	const onSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			const form = new FormData(event.currentTarget);
			const milestoneId = String(form.get("milestoneId") ?? "");
			if (milestoneId.length === 0) {
				return;
			}
			markUnsaved();
			const result = attemptOnlineWork("record-create", () =>
				contribute.mutateAsync({
					idempotencyKey: newIdempotencyKey(),
					milestoneId,
					workId,
				})
			);
			if (result.status === "refused") {
				return;
			}
			result.value.catch(() => undefined);
		},
		[attemptOnlineWork, contribute, markUnsaved, workId]
	);
	const milestones = listed.data ?? [];
	return (
		<form className="flex flex-col gap-3" onSubmit={onSubmit}>
			<Field>
				<FieldLabel htmlFor={`${workId}-milestone`}>
					{ROADMAP_COPY.contributesToMilestone}
				</FieldLabel>
				<NativeSelect
					defaultValue=""
					id={`${workId}-milestone`}
					name="milestoneId"
				>
					<NativeSelectOption value="">
						{ROADMAP_COPY.milestone}
					</NativeSelectOption>
					{milestones.map((milestone) => (
						<NativeSelectOption key={milestone.id} value={milestone.id}>
							{milestone.title} · {milestone.status}
						</NativeSelectOption>
					))}
				</NativeSelect>
			</Field>
			<Button disabled={milestones.length === 0} size="sm" type="submit">
				{ROADMAP_COPY.contributesToMilestone}
			</Button>
		</form>
	);
}
