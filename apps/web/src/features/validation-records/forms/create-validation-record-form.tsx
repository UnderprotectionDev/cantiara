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

import { VALIDATION_RECORDS_COPY } from "./validation-records-copy";

export default function CreateValidationRecordForm({
	onCreated,
	projectId,
}: {
	onCreated?: (validationRecordId: string) => void;
	projectId: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [error, setError] = useState<string | null>(null);
	const [method, setMethod] = useState("");
	const [result, setResult] = useState("");
	const [title, setTitle] = useState("");
	const create = useMutation(
		orpc.validationRecords.create.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await queryClient.invalidateQueries({
						queryKey: orpc.validationRecords.list.queryKey({
							input: { projectId },
						}),
					});
					onCreated?.(outcome.validationRecord.id);
					recordSave();
					setError(null);
					setMethod("");
					setResult("");
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
						method,
						projectId,
						result,
						title,
					},
				})
			);
		},
		[attemptOnlineWork, create, markUnsaved, method, projectId, result, title]
	);
	const onTitleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setTitle(event.target.value);
	}, []);
	const onMethodChange = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			setMethod(event.target.value);
		},
		[]
	);
	const onResultChange = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			setResult(event.target.value);
		},
		[]
	);

	return (
		<form className="flex flex-col gap-3" onSubmit={onSubmit}>
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor="validation-record-title">
						{VALIDATION_RECORDS_COPY.title}
					</FieldLabel>
					<Input
						id="validation-record-title"
						onChange={onTitleChange}
						required
						value={title}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="validation-record-method">
						{VALIDATION_RECORDS_COPY.method}
					</FieldLabel>
					<Textarea
						id="validation-record-method"
						onChange={onMethodChange}
						required
						value={method}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="validation-record-result">
						{VALIDATION_RECORDS_COPY.result}
					</FieldLabel>
					<Textarea
						id="validation-record-result"
						onChange={onResultChange}
						required
						value={result}
					/>
				</Field>
			</FieldGroup>
			{error ? <p role="alert">{error}</p> : null}
			<Button type="submit">
				{VALIDATION_RECORDS_COPY.createValidationRecord}
			</Button>
		</form>
	);
}
