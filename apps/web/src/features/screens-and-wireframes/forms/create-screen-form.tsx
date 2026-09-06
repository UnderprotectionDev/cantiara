import { Button } from "@cantiara/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import { useMutation } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useState } from "react";

import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import { SCREENS_COPY } from "./screens-copy";

export default function CreateScreenForm({
	onCreated,
	projectId,
}: {
	onCreated?: (screenId: string) => void;
	projectId: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [error, setError] = useState<string | null>(null);
	const [title, setTitle] = useState("");
	const create = useMutation(
		orpc.screensAndWireframes.create.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await queryClient.invalidateQueries({
						queryKey: orpc.screensAndWireframes.list.queryKey({
							input: { projectId },
						}),
					});
					onCreated?.(outcome.screen.id);
					recordSave();
					setError(null);
					setTitle("");
					return;
				}
				if (outcome.status === "rejected") {
					setError(
						outcome.reason === "title-required"
							? SCREENS_COPY.titleRequired
							: outcome.reason
					);
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
						title,
					},
				})
			);
		},
		[attemptOnlineWork, create, markUnsaved, projectId, title]
	);
	const onTitleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setTitle(event.target.value);
	}, []);

	return (
		<form className="flex flex-col gap-3" onSubmit={onSubmit}>
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor="screen-title">{SCREENS_COPY.title}</FieldLabel>
					<Input id="screen-title" onChange={onTitleChange} value={title} />
				</Field>
			</FieldGroup>
			{error ? <p role="alert">{error}</p> : null}
			<Button type="submit">{SCREENS_COPY.createScreen}</Button>
		</form>
	);
}
