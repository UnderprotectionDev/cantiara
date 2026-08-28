import { Button } from "@cantiara/ui/components/button";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ChangeEvent } from "react";
import { useCallback, useEffect, useState } from "react";

import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import { createPriorityCriterionError } from "./create-priority-criterion-error";
import {
	PRIORITY_COPY,
	PRIORITY_RANKS,
	type PriorityRank,
} from "./priority-copy";

export default function WorkPriorityValues({
	projectId,
	workId,
}: {
	projectId: string;
	workId: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [error, setError] = useState<string | null>(null);
	const [ranks, setRanks] = useState<Record<string, PriorityRank | null>>({});
	const values = useQuery(
		orpc.priority.workValues.queryOptions({
			input: { projectId, workId },
		})
	);
	const setValue = useMutation(orpc.priority.setValue.mutationOptions());

	useEffect(() => {
		if (!values.data) {
			return;
		}
		setRanks(
			Object.fromEntries(
				values.data.map((item) => [item.criterionId, item.rank])
			)
		);
	}, [values.data]);

	const onSave = useCallback(async () => {
		if (!values.data) {
			return;
		}
		setError(null);
		markUnsaved();
		const outcomes = await Promise.all(
			values.data.map(async (item) => {
				const rank = ranks[item.criterionId] ?? null;
				const result = attemptOnlineWork("record-create", () =>
					setValue.mutateAsync({
						baseRevision: item.revision,
						idempotencyKey: newIdempotencyKey(),
						payload: {
							criterionId: item.criterionId,
							rank,
							workId,
						},
					})
				);
				if (result.status === "refused") {
					return { reason: "offline", status: "rejected" as const };
				}
				return await result.value;
			})
		);
		for (const outcome of outcomes) {
			if (outcome.status === "committed" || outcome.status === "replayed") {
				continue;
			}
			if (outcome.status === "rejected" && outcome.reason === "offline") {
				return;
			}
			const message = createPriorityCriterionError(outcome);
			if (message) {
				setError(message);
				return;
			}
		}
		await queryClient.invalidateQueries({
			queryKey: orpc.priority.workValues.queryKey({
				input: { projectId, workId },
			}),
		});
		recordSave();
	}, [
		attemptOnlineWork,
		markUnsaved,
		projectId,
		ranks,
		recordSave,
		setValue,
		values.data,
		workId,
	]);

	const onClickSave = useCallback(() => {
		onSave().catch(() => undefined);
	}, [onSave]);

	if (!values.data || values.data.length === 0) {
		return null;
	}

	return (
		<section aria-label={PRIORITY_COPY.priorityMetrics}>
			<h2 className="font-medium text-sm">{PRIORITY_COPY.priorityMetrics}</h2>
			<ul className="mt-3 flex flex-col gap-3">
				{values.data.map((item) => (
					<WorkRankField
						criterionId={item.criterionId}
						key={item.criterionId}
						name={item.name}
						onRankChange={setRanks}
						rank={ranks[item.criterionId] ?? null}
					/>
				))}
			</ul>
			<Button className="mt-3" onClick={onClickSave} size="sm" type="button">
				{PRIORITY_COPY.save}
			</Button>
			{error ? <p role="alert">{error}</p> : null}
		</section>
	);
}

function WorkRankField({
	criterionId,
	name,
	onRankChange,
	rank,
}: {
	criterionId: string;
	name: string;
	onRankChange: (
		update: (
			current: Record<string, PriorityRank | null>
		) => Record<string, PriorityRank | null>
	) => void;
	rank: PriorityRank | null;
}) {
	const onChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			const next = event.target.value;
			onRankChange((current) => ({
				...current,
				[criterionId]: next === "" ? null : (next as PriorityRank),
			}));
		},
		[criterionId, onRankChange]
	);
	return (
		<li>
			<Field>
				<FieldLabel htmlFor={`priority-value-${criterionId}`}>
					{name}
				</FieldLabel>
				<NativeSelect
					className="w-full"
					id={`priority-value-${criterionId}`}
					onChange={onChange}
					value={rank ?? ""}
				>
					<NativeSelectOption value="">
						{PRIORITY_COPY.unevaluated}
					</NativeSelectOption>
					{PRIORITY_RANKS.map((option) => (
						<NativeSelectOption key={option} value={option}>
							{option}
						</NativeSelectOption>
					))}
				</NativeSelect>
			</Field>
		</li>
	);
}
