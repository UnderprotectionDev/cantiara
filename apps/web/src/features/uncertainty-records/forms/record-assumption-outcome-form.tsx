import { Button } from "@cantiara/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useState } from "react";

import { documentScopeFor } from "@/features/documents/forms/documents-copy";
import { RECORD_DISCOVERY_COPY } from "@/features/record-discovery/views/record-discovery-copy";
import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import { ASSUMPTION_LIVES, UNCERTAINTY_COPY } from "./uncertainty-records-copy";

export default function RecordAssumptionOutcomeForm({
	assumptionId,
	baseRevision,
	currentLife,
	onChanged,
	projectId,
}: {
	assumptionId: string;
	baseRevision: number;
	currentLife: string;
	onChanged?: () => void;
	projectId: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [error, setError] = useState<string | null>(null);
	const [evidenceId, setEvidenceId] = useState("");
	const [life, setLife] = useState(currentLife);
	const [rationale, setRationale] = useState("");
	const documents = useQuery(
		orpc.documents.list.queryOptions({
			input: { scope: documentScopeFor(projectId) },
		})
	);
	const setOutcome = useMutation(
		orpc.uncertaintyRecords.setAssumptionLife.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await queryClient.invalidateQueries({
						queryKey: orpc.uncertaintyRecords.listAssumptions.queryKey({
							input: { projectId },
						}),
					});
					await queryClient.invalidateQueries({
						queryKey: orpc.uncertaintyRecords.getAssumption.queryKey({
							input: { assumptionId },
						}),
					});
					recordSave();
					onChanged?.();
					setError(null);
					setRationale("");
					setEvidenceId("");
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
			setError(null);
			markUnsaved();
			const evidence =
				evidenceId.length > 0
					? { fromId: evidenceId, fromKind: "Document" as const }
					: undefined;
			attemptOnlineWork("record-create", () =>
				setOutcome.mutateAsync({
					baseRevision,
					idempotencyKey: newIdempotencyKey(),
					payload: {
						assumptionId,
						...(evidence ? { evidence } : {}),
						life: life as (typeof ASSUMPTION_LIVES)[number],
						rationale: rationale.trim() === "" ? undefined : rationale,
					},
				})
			);
		},
		[
			assumptionId,
			attemptOnlineWork,
			baseRevision,
			evidenceId,
			life,
			markUnsaved,
			rationale,
			setOutcome,
		]
	);
	const onLifeChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
		setLife(event.target.value);
	}, []);
	const onEvidenceChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			setEvidenceId(event.target.value);
		},
		[]
	);
	const onRationaleChange = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			setRationale(event.target.value);
		},
		[]
	);
	const showEvidenceFields =
		life === UNCERTAINTY_COPY.confirmed || life === UNCERTAINTY_COPY.refuted;

	return (
		<form className="flex flex-col gap-3" onSubmit={onSubmit}>
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor={`assumption-life-${assumptionId}`}>
						{UNCERTAINTY_COPY.recordOutcome}
					</FieldLabel>
					<NativeSelect
						id={`assumption-life-${assumptionId}`}
						onChange={onLifeChange}
						value={life}
					>
						{ASSUMPTION_LIVES.map((item) => (
							<NativeSelectOption key={item} value={item}>
								{item}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</Field>
				{showEvidenceFields ? (
					<>
						<Field>
							<FieldLabel htmlFor={`assumption-evidence-${assumptionId}`}>
								{UNCERTAINTY_COPY.evidence}
							</FieldLabel>
							<NativeSelect
								id={`assumption-evidence-${assumptionId}`}
								onChange={onEvidenceChange}
								value={evidenceId}
							>
								<NativeSelectOption value="">
									{RECORD_DISCOVERY_COPY.anyScope}
								</NativeSelectOption>
								{(documents.data ?? []).map((item) => (
									<NativeSelectOption key={item.id} value={item.id}>
										{item.title}
									</NativeSelectOption>
								))}
							</NativeSelect>
						</Field>
						<Field>
							<FieldLabel
								htmlFor={`assumption-outcome-rationale-${assumptionId}`}
							>
								{UNCERTAINTY_COPY.rationale}
							</FieldLabel>
							<Textarea
								id={`assumption-outcome-rationale-${assumptionId}`}
								onChange={onRationaleChange}
								value={rationale}
							/>
						</Field>
					</>
				) : null}
			</FieldGroup>
			{error ? <p role="alert">{error}</p> : null}
			<Button type="submit">{UNCERTAINTY_COPY.recordOutcome}</Button>
		</form>
	);
}
