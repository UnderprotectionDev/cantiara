import { Button } from "@cantiara/ui/components/button";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useMutation } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useState } from "react";

import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import { RISK_STATUSES, RISKS_COPY } from "./risks-copy";

export default function SetRiskStatusForm({
	baseRevision,
	currentStatus,
	onChanged,
	projectId,
	riskId,
}: {
	baseRevision: number;
	currentStatus: string;
	onChanged?: () => void;
	projectId: string;
	riskId: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [error, setError] = useState<string | null>(null);
	const [rationale, setRationale] = useState("");
	const [status, setStatus] = useState(currentStatus);
	const setRiskStatus = useMutation(
		orpc.risks.setStatus.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await queryClient.invalidateQueries({
						queryKey: orpc.risks.list.queryKey({
							input: { projectId },
						}),
					});
					await queryClient.invalidateQueries({
						queryKey: orpc.risks.get.queryKey({
							input: { riskId },
						}),
					});
					recordSave();
					onChanged?.();
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
			if (
				status !== RISKS_COPY.open &&
				status !== RISKS_COPY.mitigating &&
				status !== RISKS_COPY.occurred &&
				status !== RISKS_COPY.resolved &&
				status !== RISKS_COPY.accepted
			) {
				return;
			}
			setError(null);
			markUnsaved();
			attemptOnlineWork("record-create", () =>
				setRiskStatus.mutateAsync({
					baseRevision,
					idempotencyKey: newIdempotencyKey(),
					payload: {
						rationale: rationale.trim() === "" ? undefined : rationale,
						riskId,
						status,
					},
				})
			);
		},
		[
			attemptOnlineWork,
			baseRevision,
			markUnsaved,
			rationale,
			riskId,
			setRiskStatus,
			status,
		]
	);
	const onStatusChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			setStatus(event.target.value);
		},
		[]
	);
	const onRationaleChange = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			setRationale(event.target.value);
		},
		[]
	);

	return (
		<form className="flex flex-col gap-3" onSubmit={onSubmit}>
			<Field>
				<FieldLabel htmlFor={`risk-status-${riskId}`}>
					{RISKS_COPY.setStatus}
				</FieldLabel>
				<NativeSelect
					id={`risk-status-${riskId}`}
					onChange={onStatusChange}
					value={status}
				>
					{RISK_STATUSES.map((item) => (
						<NativeSelectOption key={item} value={item}>
							{item}
						</NativeSelectOption>
					))}
				</NativeSelect>
			</Field>
			{status === RISKS_COPY.accepted ? (
				<Field>
					<FieldLabel htmlFor={`risk-rationale-${riskId}`}>
						{RISKS_COPY.rationale}
					</FieldLabel>
					<Textarea
						id={`risk-rationale-${riskId}`}
						onChange={onRationaleChange}
						required
						value={rationale}
					/>
				</Field>
			) : null}
			{error ? <p role="alert">{error}</p> : null}
			<Button type="submit">{RISKS_COPY.setStatus}</Button>
		</form>
	);
}
