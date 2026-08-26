import { Button } from "@cantiara/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useState } from "react";

import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import { PROJECT_SHELL_COPY } from "./project-shell-copy";

export default function ShortCodeForm({
	projectId,
	revision,
	shortCode,
	shortCodeLocked,
}: {
	projectId: string;
	revision: number;
	shortCode: string;
	shortCodeLocked: boolean;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [error, setError] = useState<string | null>(null);
	const save = useMutation(
		orpc.projectShell.updateShortCode.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await queryClient.invalidateQueries({
						queryKey: orpc.projectShell.get.queryKey({
							input: { projectId },
						}),
					});
					recordSave();
					setError(null);
					return;
				}
				if (
					outcome.status === "rejected" &&
					outcome.reason === "short-code-locked"
				) {
					setError(PROJECT_SHELL_COPY.shortCodeLocked);
					return;
				}
				setError("Conflict");
			},
		})
	);
	const form = useForm({
		defaultValues: { shortCode },
		onSubmit: async ({ value }) => {
			setError(null);
			const result = attemptOnlineWork("record-create", () =>
				save.mutateAsync({
					baseRevision: revision,
					idempotencyKey: newIdempotencyKey(),
					projectId,
					shortCode: value.shortCode,
				})
			);
			if (result.status === "refused") {
				return;
			}
			await result.value;
		},
	});
	const onSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			markUnsaved();
			form.handleSubmit().catch(() => undefined);
		},
		[form, markUnsaved]
	);

	if (shortCodeLocked) {
		return (
			<p>
				{PROJECT_SHELL_COPY.shortCode} {shortCode}.{" "}
				{PROJECT_SHELL_COPY.shortCodeLocked}
			</p>
		);
	}

	return (
		<form className="flex flex-col gap-4" onSubmit={onSubmit}>
			<FieldGroup>
				<form.Field name="shortCode">
					{(field) => (
						<ShortCodeField
							onValueChange={field.handleChange}
							value={field.state.value}
						/>
					)}
				</form.Field>
			</FieldGroup>
			{error ? <p role="alert">{error}</p> : null}
			<Button disabled={save.isPending} type="submit">
				{PROJECT_SHELL_COPY.saveShortCode}
			</Button>
		</form>
	);
}

function ShortCodeField({
	onValueChange,
	value,
}: {
	onValueChange: (value: string) => void;
	value: string;
}) {
	const onChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			onValueChange(event.target.value);
		},
		[onValueChange]
	);
	return (
		<Field>
			<FieldLabel htmlFor="short-code">
				{PROJECT_SHELL_COPY.shortCode}
			</FieldLabel>
			<Input id="short-code" maxLength={6} onChange={onChange} value={value} />
		</Field>
	);
}
