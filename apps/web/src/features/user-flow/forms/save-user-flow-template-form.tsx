import { Button } from "@cantiara/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import { useMutation } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useState } from "react";

import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import { USER_FLOW_COPY } from "./user-flow-copy";

export default function SaveUserFlowTemplateForm({
	userFlowId,
}: {
	userFlowId: string;
}) {
	const [name, setName] = useState("");
	const [error, setError] = useState<string | null>(null);
	const save = useMutation(
		orpc.userFlow.saveTemplate.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await queryClient.invalidateQueries({
						queryKey: orpc.userFlow.listTemplates.queryKey(),
					});
					setName("");
					setError(null);
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
			save.mutate({
				idempotencyKey: newIdempotencyKey(),
				payload: { name, userFlowId },
			});
		},
		[name, save, userFlowId]
	);
	const onName = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setName(event.target.value);
	}, []);

	return (
		<form className="flex flex-col gap-3" onSubmit={onSubmit}>
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor="flow-template-name">
						{USER_FLOW_COPY.saveAsTemplate}
					</FieldLabel>
					<Input
						id="flow-template-name"
						onChange={onName}
						required
						value={name}
					/>
				</Field>
			</FieldGroup>
			{error ? <p role="alert">{error}</p> : null}
			<Button type="submit">{USER_FLOW_COPY.saveAsTemplate}</Button>
		</form>
	);
}
