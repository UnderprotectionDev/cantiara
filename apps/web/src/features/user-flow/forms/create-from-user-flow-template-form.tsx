import { Button } from "@cantiara/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useState } from "react";

import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import { USER_FLOW_COPY } from "./user-flow-copy";

export default function CreateFromUserFlowTemplateForm({
	onCreated,
	projectId,
}: {
	onCreated?: (userFlowId: string) => void;
	projectId: string;
}) {
	const templates = useQuery(orpc.userFlow.listTemplates.queryOptions());
	const [templateId, setTemplateId] = useState("");
	const [title, setTitle] = useState("");
	const [error, setError] = useState<string | null>(null);
	const instantiate = useMutation(
		orpc.userFlow.instantiateTemplate.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await queryClient.invalidateQueries({
						queryKey: orpc.userFlow.list.queryKey({
							input: { projectId },
						}),
					});
					onCreated?.(outcome.flow.id);
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
			if (!templateId) {
				return;
			}
			instantiate.mutate({
				idempotencyKey: newIdempotencyKey(),
				payload: { projectId, templateId, title },
			});
		},
		[instantiate, projectId, templateId, title]
	);
	const onTemplate = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
		setTemplateId(event.target.value);
	}, []);
	const onTitle = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setTitle(event.target.value);
	}, []);
	const rows = templates.data ?? [];
	if (rows.length === 0) {
		return null;
	}

	return (
		<form className="flex flex-col gap-3" onSubmit={onSubmit}>
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor="flow-from-template">
						{USER_FLOW_COPY.createFromTemplate}
					</FieldLabel>
					<NativeSelect
						id="flow-from-template"
						onChange={onTemplate}
						value={templateId}
					>
						<NativeSelectOption value="">
							{USER_FLOW_COPY.createFromTemplate}
						</NativeSelectOption>
						{rows.map((row) => (
							<NativeSelectOption key={row.id} value={row.id}>
								{row.name}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</Field>
				<Field>
					<FieldLabel htmlFor="flow-from-template-title">
						{USER_FLOW_COPY.title}
					</FieldLabel>
					<Input
						id="flow-from-template-title"
						onChange={onTitle}
						required
						value={title}
					/>
				</Field>
			</FieldGroup>
			{error ? <p role="alert">{error}</p> : null}
			<Button type="submit">{USER_FLOW_COPY.createFromTemplate}</Button>
		</form>
	);
}
