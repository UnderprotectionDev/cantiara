import { Button } from "@cantiara/ui/components/button";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useMutation } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useState } from "react";

import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import { DECISIONS_COPY } from "./decisions-copy";

export default function WithdrawDecisionForm({
	baseRevision,
	decisionId,
	onWithdrawn,
	projectId,
}: {
	baseRevision: number;
	decisionId: string;
	onWithdrawn?: () => void;
	projectId: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [error, setError] = useState<string | null>(null);
	const [rationale, setRationale] = useState("");
	const withdraw = useMutation(
		orpc.decisions.withdraw.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await queryClient.invalidateQueries({
						queryKey: orpc.decisions.list.queryKey({
							input: { projectId },
						}),
					});
					await queryClient.invalidateQueries({
						queryKey: orpc.decisions.get.queryKey({
							input: { decisionId },
						}),
					});
					recordSave();
					onWithdrawn?.();
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
				withdraw.mutateAsync({
					baseRevision,
					idempotencyKey: newIdempotencyKey(),
					payload: {
						decisionId,
						rationale: rationale.trim() === "" ? undefined : rationale,
					},
				})
			);
		},
		[
			attemptOnlineWork,
			baseRevision,
			decisionId,
			markUnsaved,
			rationale,
			withdraw,
		]
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
				<FieldLabel htmlFor="withdraw-decision-rationale">
					{DECISIONS_COPY.rationale}
				</FieldLabel>
				<Textarea
					id="withdraw-decision-rationale"
					onChange={onRationaleChange}
					value={rationale}
				/>
			</Field>
			{error ? <p role="alert">{error}</p> : null}
			<Button type="submit">{DECISIONS_COPY.withdraw}</Button>
		</form>
	);
}
