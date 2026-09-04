import { Button } from "@cantiara/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useState } from "react";

import { DECISIONS_COPY } from "@/features/decisions/forms/decisions-copy";
import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import { VALIDATION_RECORDS_COPY } from "./validation-records-copy";

export default function RelateValidationContextForm({
	onRelated,
	projectId,
	validationRecordId,
}: {
	onRelated?: () => void;
	projectId: string;
	validationRecordId: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [decisionId, setDecisionId] = useState("");
	const [error, setError] = useState<string | null>(null);
	const decisions = useQuery(
		orpc.decisions.list.queryOptions({
			input: { projectId },
		})
	);
	const relate = useMutation(
		orpc.validationRecords.relateContext.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await queryClient.invalidateQueries({
						queryKey: orpc.validationRecords.get.queryKey({
							input: { validationRecordId },
						}),
					});
					recordSave();
					setDecisionId("");
					setError(null);
					onRelated?.();
					return;
				}
				if (outcome.status === "rejected") {
					setError(outcome.reason);
				}
			},
		})
	);
	const onSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			if (decisionId.length === 0) {
				return;
			}
			setError(null);
			markUnsaved();
			attemptOnlineWork("record-create", () =>
				relate.mutateAsync({
					idempotencyKey: newIdempotencyKey(),
					payload: {
						related: { id: decisionId, kind: "Decision" },
						validationRecordId,
					},
				})
			);
		},
		[attemptOnlineWork, decisionId, markUnsaved, relate, validationRecordId]
	);
	const onDecisionChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			setDecisionId(event.target.value);
		},
		[]
	);

	return (
		<form className="flex flex-col gap-3" onSubmit={onSubmit}>
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor={`${validationRecordId}-related-decision`}>
						{VALIDATION_RECORDS_COPY.decision}
					</FieldLabel>
					<NativeSelect
						id={`${validationRecordId}-related-decision`}
						onChange={onDecisionChange}
						value={decisionId}
					>
						<NativeSelectOption value="">
							{DECISIONS_COPY.decision}
						</NativeSelectOption>
						{(decisions.data ?? []).map((item) => (
							<NativeSelectOption key={item.id} value={item.id}>
								{item.title}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</Field>
			</FieldGroup>
			{error ? <p role="alert">{error}</p> : null}
			<Button type="submit">{VALIDATION_RECORDS_COPY.relateContext}</Button>
		</form>
	);
}
