import { Button } from "@cantiara/ui/components/button";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useState } from "react";

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
	const [label, setLabel] = useState(status.label);
	const onChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setLabel(event.target.value);
	}, []);
	const onSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			run({
				action: "rename-work-status",
				label,
				semantic: status.semantic,
			});
		},
		[label, run, status.semantic]
	);
	return (
		<form className="flex flex-col gap-2" onSubmit={onSubmit}>
			<p>{status.semantic}</p>
			<Field>
				<FieldLabel htmlFor={`work-status-${status.semantic}`}>
					{status.semantic}
				</FieldLabel>
				<Input
					id={`work-status-${status.semantic}`}
					onChange={onChange}
					value={label}
				/>
			</Field>
			<Button disabled={disabled} type="submit">
				{PROJECT_SHELL_COPY.save}
			</Button>
		</form>
	);
}
