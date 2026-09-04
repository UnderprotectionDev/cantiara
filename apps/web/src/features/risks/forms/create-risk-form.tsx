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

import { RISKS_COPY } from "./risks-copy";

export default function CreateRiskForm({
	onCreated,
	projectId,
}: {
	onCreated?: (riskId: string) => void;
	projectId: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [description, setDescription] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [impact, setImpact] = useState("");
	const [probability, setProbability] = useState("");
	const [response, setResponse] = useState("");
	const [title, setTitle] = useState("");
	const create = useMutation(
		orpc.risks.create.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await queryClient.invalidateQueries({
						queryKey: orpc.risks.list.queryKey({
							input: { projectId },
						}),
					});
					onCreated?.(outcome.risk.id);
					recordSave();
					setDescription("");
					setError(null);
					setImpact("");
					setProbability("");
					setResponse("");
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
						description,
						impact,
						probability,
						projectId,
						response,
						title,
					},
				})
			);
		},
		[
			attemptOnlineWork,
			create,
			description,
			impact,
			markUnsaved,
			probability,
			projectId,
			response,
			title,
		]
	);
	const onTitleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setTitle(event.target.value);
	}, []);
	const onDescriptionChange = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			setDescription(event.target.value);
		},
		[]
	);
	const onImpactChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setImpact(event.target.value);
	}, []);
	const onProbabilityChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			setProbability(event.target.value);
		},
		[]
	);
	const onResponseChange = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			setResponse(event.target.value);
		},
		[]
	);

	return (
		<form className="flex flex-col gap-3" onSubmit={onSubmit}>
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor="risk-title">{RISKS_COPY.title}</FieldLabel>
					<Input
						id="risk-title"
						onChange={onTitleChange}
						required
						value={title}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="risk-description">
						{RISKS_COPY.description}
					</FieldLabel>
					<Textarea
						id="risk-description"
						onChange={onDescriptionChange}
						value={description}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="risk-impact">{RISKS_COPY.impact}</FieldLabel>
					<Input id="risk-impact" onChange={onImpactChange} value={impact} />
				</Field>
				<Field>
					<FieldLabel htmlFor="risk-probability">
						{RISKS_COPY.probability}
					</FieldLabel>
					<Input
						id="risk-probability"
						onChange={onProbabilityChange}
						value={probability}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="risk-response">
						{RISKS_COPY.responseMitigation}
					</FieldLabel>
					<Textarea
						id="risk-response"
						onChange={onResponseChange}
						value={response}
					/>
				</Field>
			</FieldGroup>
			{error ? <p role="alert">{error}</p> : null}
			<Button type="submit">{RISKS_COPY.createRisk}</Button>
		</form>
	);
}
