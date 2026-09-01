import { Button } from "@cantiara/ui/components/button";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { FormEvent } from "react";
import { useCallback, useState } from "react";

import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { invalidateWork } from "@/features/work-lifecycle/forms/invalidate-work";
import { orpc, queryClient } from "@/utils/orpc";

import {
	isRoadmapHorizon,
	ROADMAP_COPY,
	ROADMAP_HORIZONS,
} from "./roadmap-copy";

export default function WorkHorizonForm({
	projectId,
	workId,
}: {
	projectId: string;
	workId: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [error, setError] = useState<string | null>(null);
	const placement = useQuery(
		orpc.roadmapHorizon.placement.queryOptions({
			input: { workId },
		})
	);
	const place = useMutation(
		orpc.roadmapHorizon.place.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status !== "committed") {
					setError("Conflict");
					return;
				}
				await invalidateWork(projectId, workId);
				await queryClient.invalidateQueries({
					predicate: (query) =>
						JSON.stringify(query.queryKey).includes("roadmapHorizon"),
				});
				recordSave();
				setError(null);
			},
		})
	);
	const onSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			setError(null);
			markUnsaved();
			const form = new FormData(event.currentTarget);
			const next = String(form.get("horizon") ?? "");
			const result = attemptOnlineWork("record-create", () =>
				place.mutateAsync({
					horizon: isRoadmapHorizon(next) ? next : null,
					workId,
				})
			);
			if (result.status === "refused") {
				return;
			}
			result.value.catch(() => undefined);
		},
		[attemptOnlineWork, markUnsaved, place, workId]
	);
	const current = placement.data?.horizon ?? "";
	return (
		<form className="flex flex-col gap-3" onSubmit={onSubmit}>
			<Field>
				<FieldLabel htmlFor={`${workId}-horizon`}>
					{ROADMAP_COPY.horizon}
				</FieldLabel>
				<NativeSelect
					defaultValue={current}
					id={`${workId}-horizon`}
					key={`${workId}:${current}`}
					name="horizon"
				>
					<NativeSelectOption value="">
						{ROADMAP_COPY.unplaced}
					</NativeSelectOption>
					{ROADMAP_HORIZONS.map((horizon) => (
						<NativeSelectOption key={horizon} value={horizon}>
							{horizon}
						</NativeSelectOption>
					))}
				</NativeSelect>
			</Field>
			{error ? <p className="text-destructive text-sm">{error}</p> : null}
			<Button size="sm" type="submit">
				{ROADMAP_COPY.place}
			</Button>
		</form>
	);
}
