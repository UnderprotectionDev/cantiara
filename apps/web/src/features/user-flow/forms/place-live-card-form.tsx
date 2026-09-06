import { Button } from "@cantiara/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useState } from "react";

import { WORK_LIFECYCLE_COPY } from "@/features/work-lifecycle/forms/work-lifecycle-copy";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc } from "@/utils/orpc";

import { USER_FLOW_COPY } from "./user-flow-copy";

export default function PlaceLiveCardForm({
	baseRevision,
	onPlaced,
	projectId,
	userFlowId,
}: {
	baseRevision: number;
	onPlaced: () => Promise<void>;
	projectId: string;
	userFlowId: string;
}) {
	const works = useQuery(
		orpc.workLifecycle.list.queryOptions({ input: { projectId } })
	);
	const [recordId, setRecordId] = useState("");
	const place = useMutation(
		orpc.userFlow.placeLiveCard.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await onPlaced();
					setRecordId("");
				}
			},
		})
	);
	const onSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			if (!recordId) {
				return;
			}
			place.mutate({
				baseRevision,
				idempotencyKey: newIdempotencyKey(),
				payload: {
					recordId,
					recordKind: USER_FLOW_COPY.work,
					userFlowId,
				},
			});
		},
		[baseRevision, place, recordId, userFlowId]
	);
	const onRecord = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
		setRecordId(event.target.value);
	}, []);

	return (
		<form className="flex flex-col gap-3" onSubmit={onSubmit}>
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor={`place-live-card-${userFlowId}`}>
						{USER_FLOW_COPY.placeLiveCard}
					</FieldLabel>
					<NativeSelect
						id={`place-live-card-${userFlowId}`}
						onChange={onRecord}
						value={recordId}
					>
						<NativeSelectOption value="">
							{WORK_LIFECYCLE_COPY.work}
						</NativeSelectOption>
						{(works.data ?? []).map((work) => (
							<NativeSelectOption key={work.id} value={work.id}>
								{work.key} {work.title}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</Field>
			</FieldGroup>
			<Button type="submit">{USER_FLOW_COPY.placeLiveCard}</Button>
		</form>
	);
}
