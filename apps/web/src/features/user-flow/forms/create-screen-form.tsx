import { Button } from "@cantiara/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import { useMutation } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useState } from "react";

import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import { USER_FLOW_COPY } from "../forms/user-flow-copy";

export default function CreateScreenForm({
	onCreated,
	projectId,
}: {
	onCreated?: (screenId: string) => void;
	projectId: string;
}) {
	const { recordSave } = useClientShell();
	const [error, setError] = useState<string | null>(null);
	const [title, setTitle] = useState("");
	const create = useMutation(
		orpc.userFlow.createScreen.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await queryClient.invalidateQueries({
						queryKey: orpc.userFlow.listScreens.queryKey({
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
					setError(outcome.reason);
				}
			},
		})
	);
	const onSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			create.mutate({
				idempotencyKey: newIdempotencyKey(),
				payload: { projectId, title },
			});
		},
		[create, projectId, title]
	);
	const onTitle = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setTitle(event.target.value);
	}, []);

	return (
		<form className="flex flex-col gap-3" onSubmit={onSubmit}>
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor="screen-title">
						{USER_FLOW_COPY.screen}
					</FieldLabel>
					<Input id="screen-title" onChange={onTitle} required value={title} />
				</Field>
			</FieldGroup>
			{error ? <p role="alert">{error}</p> : null}
			<Button type="submit">{USER_FLOW_COPY.createScreen}</Button>
		</form>
	);
}
