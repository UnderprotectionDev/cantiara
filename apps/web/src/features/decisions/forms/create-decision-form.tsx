import { Button } from "@cantiara/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useMutation } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useState } from "react";

import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import { DECISIONS_COPY } from "./decisions-copy";

export default function CreateDecisionForm({
	onCreated,
	projectId,
}: {
	onCreated?: (decisionId: string) => void;
	projectId: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [decision, setDecision] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [rationale, setRationale] = useState("");
	const [title, setTitle] = useState("");
	const create = useMutation(
		orpc.decisions.create.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await queryClient.invalidateQueries({
						queryKey: orpc.decisions.list.queryKey({
							input: { projectId },
						}),
					});
					onCreated?.(outcome.decision.id);
					recordSave();
					setDecision("");
					setError(null);
					setRationale("");
					setTitle("");
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
						decision,
						projectId,
						rationale,
						title,
					},
				})
			);
		},
		[
			attemptOnlineWork,
			create,
			decision,
			markUnsaved,
			projectId,
			rationale,
			title,
		]
	);
	const onTitleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setTitle(event.target.value);
	}, []);
	const onDecisionChange = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			setDecision(event.target.value);
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
					<FieldLabel htmlFor="decision-title">
						{DECISIONS_COPY.title}
					</FieldLabel>
					<Input
						id="decision-title"
						onChange={onTitleChange}
						required
						value={title}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="decision-text">
						{DECISIONS_COPY.decisionText}
					</FieldLabel>
					<Textarea
						id="decision-text"
						onChange={onDecisionChange}
						required
						value={decision}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="decision-rationale">
						{DECISIONS_COPY.rationale}
					</FieldLabel>
					<Textarea
						id="decision-rationale"
						onChange={onRationaleChange}
						value={rationale}
					/>
				</Field>
			</FieldGroup>
			{error ? <p role="alert">{error}</p> : null}
			<Button type="submit">{DECISIONS_COPY.createDecision}</Button>
		</form>
	);
}
