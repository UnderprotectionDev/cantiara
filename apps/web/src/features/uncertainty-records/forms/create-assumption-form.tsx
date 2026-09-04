import { Button } from "@cantiara/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useMutation } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useState } from "react";

import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import { UNCERTAINTY_COPY } from "./uncertainty-records-copy";

export default function CreateAssumptionForm({
	onCreated,
	projectId,
}: {
	onCreated?: (assumptionId: string) => void;
	projectId: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [error, setError] = useState<string | null>(null);
	const [rationale, setRationale] = useState("");
	const [statement, setStatement] = useState("");
	const create = useMutation(
		orpc.uncertaintyRecords.createAssumption.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await queryClient.invalidateQueries({
						queryKey: orpc.uncertaintyRecords.listAssumptions.queryKey({
							input: { projectId },
						}),
					});
					onCreated?.(outcome.assumption.id);
					recordSave();
					setError(null);
					setRationale("");
					setStatement("");
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
			attemptOnlineWork("record-create", () =>
				create.mutateAsync({
					idempotencyKey: newIdempotencyKey(),
					payload: {
						projectId,
						rationale,
						statement,
					},
				})
			);
		},
		[attemptOnlineWork, create, markUnsaved, projectId, rationale, statement]
	);
	const onStatementChange = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			setStatement(event.target.value);
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
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor="assumption-statement">
						{UNCERTAINTY_COPY.statement}
					</FieldLabel>
					<Textarea
						id="assumption-statement"
						onChange={onStatementChange}
						required
						value={statement}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="assumption-rationale">
						{UNCERTAINTY_COPY.rationale}
					</FieldLabel>
					<Textarea
						id="assumption-rationale"
						onChange={onRationaleChange}
						value={rationale}
					/>
				</Field>
			</FieldGroup>
			{error ? <p role="alert">{error}</p> : null}
			<Button type="submit">{UNCERTAINTY_COPY.createAssumption}</Button>
		</form>
	);
}
