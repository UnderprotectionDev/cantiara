import { Button } from "@cantiara/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useState } from "react";

import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import { invalidateWork } from "./invalidate-work";
import {
	WORK_LIFECYCLE_COPY,
	WORK_TYPES,
	type WorkType,
} from "./work-lifecycle-copy";

interface CreateWorkValues {
	title: string;
	type: WorkType;
}

export default function CreateWorkForm({
	onCreated,
	projectId,
}: {
	onCreated?: (workId: string) => void;
	projectId: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [error, setError] = useState<string | null>(null);
	const create = useMutation(
		orpc.workLifecycle.create.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await invalidateWork(projectId, outcome.work.id);
					await queryClient.invalidateQueries({
						queryKey: orpc.projectShell.get.queryKey({
							input: { projectId },
						}),
					});
					onCreated?.(outcome.work.id);
					recordSave();
					setError(null);
					return;
				}
				if (outcome.status === "rejected" || outcome.status === "conflict") {
					setError(
						outcome.status === "conflict"
							? "Conflict"
							: WORK_LIFECYCLE_COPY.title
					);
				}
			},
		})
	);
	const form = useForm({
		defaultValues: {
			title: "",
			type: "Task" as WorkType,
		} satisfies CreateWorkValues,
		onSubmit: async ({ value }) => {
			setError(null);
			const result = attemptOnlineWork("record-create", () =>
				create.mutateAsync({
					idempotencyKey: newIdempotencyKey(),
					payload: {
						projectId,
						title: value.title,
						type: value.type,
					},
				})
			);
			if (result.status === "refused") {
				return;
			}
			const outcome = await result.value;
			if (outcome.status === "committed" || outcome.status === "replayed") {
				form.reset();
			}
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

	return (
		<form className="flex flex-col gap-3" onSubmit={onSubmit}>
			<FieldGroup className="flex-row flex-wrap items-end gap-3">
				<form.Field name="title">
					{(field) => (
						<TitleField
							onValueChange={field.handleChange}
							value={field.state.value}
						/>
					)}
				</form.Field>
				<form.Field name="type">
					{(field) => (
						<TypeField
							onValueChange={field.handleChange}
							value={field.state.value}
						/>
					)}
				</form.Field>
				<Button disabled={create.isPending} type="submit">
					{WORK_LIFECYCLE_COPY.createWork}
				</Button>
			</FieldGroup>
			{error ? <p role="alert">{error}</p> : null}
		</form>
	);
}

function TitleField({
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
		<Field className="min-w-48 flex-1">
			<FieldLabel htmlFor="work-title">{WORK_LIFECYCLE_COPY.title}</FieldLabel>
			<Input
				id="work-title"
				onChange={onChange}
				required={true}
				value={value}
			/>
		</Field>
	);
}

function TypeField({
	onValueChange,
	value,
}: {
	onValueChange: (value: WorkType) => void;
	value: WorkType;
}) {
	const onChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			onValueChange(event.target.value as WorkType);
		},
		[onValueChange]
	);
	return (
		<Field className="w-40">
			<FieldLabel htmlFor="work-type">{WORK_LIFECYCLE_COPY.type}</FieldLabel>
			<NativeSelect
				className="w-full"
				id="work-type"
				onChange={onChange}
				value={value}
			>
				{WORK_TYPES.map((type) => (
					<NativeSelectOption key={type} value={type}>
						{type}
					</NativeSelectOption>
				))}
			</NativeSelect>
		</Field>
	);
}
