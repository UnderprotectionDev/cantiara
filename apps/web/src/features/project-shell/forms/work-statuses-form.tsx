import { Button } from "@cantiara/ui/components/button";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import { useForm } from "@tanstack/react-form";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback } from "react";

import { PROJECT_SHELL_COPY } from "./project-shell-copy";
import { useConfigureProject } from "./use-configure-project";

export default function WorkStatusesForm({
	projectId,
	revision,
	workStatuses,
}: {
	projectId: string;
	revision: number;
	workStatuses: readonly { label: string; semantic: string }[];
}) {
	const { error, isPending, run } = useConfigureProject(projectId, revision);
	return (
		<section aria-label={PROJECT_SHELL_COPY.workStatuses}>
			<h2>{PROJECT_SHELL_COPY.workStatuses}</h2>
			<ul>
				{workStatuses.map((status) => (
					<li key={`${status.semantic}:${status.label}`}>
						<WorkStatusRow disabled={isPending} run={run} status={status} />
					</li>
				))}
			</ul>
			{error ? <p role="alert">{error}</p> : null}
		</section>
	);
}

function WorkStatusRow({
	disabled,
	run,
	status,
}: {
	disabled: boolean;
	run: ReturnType<typeof useConfigureProject>["run"];
	status: { label: string; semantic: string };
}) {
	const form = useForm({
		defaultValues: { label: status.label },
		onSubmit: async ({ value }) => {
			await run({
				action: "rename-work-status",
				label: value.label,
				semantic: status.semantic,
			});
		},
	});
	const onSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			form.handleSubmit().catch(() => undefined);
		},
		[form]
	);
	return (
		<form className="flex flex-col gap-2" onSubmit={onSubmit}>
			<p>{status.semantic}</p>
			<form.Field name="label">
				{(field) => (
					<WorkStatusLabelField
						id={`work-status-${status.semantic}`}
						label={status.semantic}
						onValueChange={field.handleChange}
						value={field.state.value}
					/>
				)}
			</form.Field>
			<Button disabled={disabled} type="submit">
				{PROJECT_SHELL_COPY.save}
			</Button>
		</form>
	);
}

function WorkStatusLabelField({
	id,
	label,
	onValueChange,
	value,
}: {
	id: string;
	label: string;
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
			<FieldLabel htmlFor={id}>{label}</FieldLabel>
			<Input id={id} onChange={onChange} value={value} />
		</Field>
	);
}
