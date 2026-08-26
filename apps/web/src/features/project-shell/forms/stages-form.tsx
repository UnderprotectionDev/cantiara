import { Button } from "@cantiara/ui/components/button";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useState } from "react";

import {
	PROJECT_SHELL_COPY,
	STAGE_STATES,
	type StageState,
	stageRemovalPreviewCopy,
} from "./project-shell-copy";
import { useConfigureProject } from "./use-configure-project";

interface StageView {
	id: string;
	name: string;
	state: StageState;
}

export default function StagesForm({
	projectId,
	revision,
	stages,
}: {
	projectId: string;
	revision: number;
	stages: readonly StageView[];
}) {
	const { error, isPending, run } = useConfigureProject(projectId, revision);
	const [newName, setNewName] = useState("");
	const [pendingRemoval, setPendingRemoval] = useState<string | null>(null);
	const onNewNameChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			setNewName(event.target.value);
		},
		[]
	);
	const onAdd = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			run({ action: "add-stage", name: newName });
			setNewName("");
		},
		[newName, run]
	);
	return (
		<section aria-label={PROJECT_SHELL_COPY.stages}>
			<h2>{PROJECT_SHELL_COPY.stages}</h2>
			<ul>
				{stages.map((stage, index) => (
					<li key={`${stage.id}:${stage.name}`}>
						<StageRow
							disabled={isPending}
							index={index}
							pendingRemoval={pendingRemoval}
							run={run}
							setPendingRemoval={setPendingRemoval}
							stage={stage}
							stages={stages}
						/>
					</li>
				))}
			</ul>
			<form className="flex flex-col gap-2" onSubmit={onAdd}>
				<Field>
					<FieldLabel htmlFor="add-stage">
						{PROJECT_SHELL_COPY.addStage}
					</FieldLabel>
					<Input id="add-stage" onChange={onNewNameChange} value={newName} />
				</Field>
				<Button disabled={isPending} type="submit">
					{PROJECT_SHELL_COPY.addStage}
				</Button>
			</form>
			{error ? <p role="alert">{error}</p> : null}
		</section>
	);
}

function StageRow({
	disabled,
	index,
	pendingRemoval,
	run,
	setPendingRemoval,
	stage,
	stages,
}: {
	disabled: boolean;
	index: number;
	pendingRemoval: string | null;
	run: ReturnType<typeof useConfigureProject>["run"];
	setPendingRemoval: (id: string | null) => void;
	stage: StageView;
	stages: readonly StageView[];
}) {
	const [name, setName] = useState(stage.name);
	const onNameChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setName(event.target.value);
	}, []);
	const onNameSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			run({ action: "rename-stage", name, stageId: stage.id });
		},
		[name, run, stage.id]
	);
	const onStateChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			run({
				action: "set-stage-state",
				stageId: stage.id,
				state: event.target.value,
			});
		},
		[run, stage.id]
	);
	const onMoveUp = useCallback(() => {
		if (index === 0) {
			return;
		}
		const next = [...stages];
		const current = next[index];
		const above = next[index - 1];
		if (!(current && above)) {
			return;
		}
		next[index] = above;
		next[index - 1] = current;
		run({
			action: "reorder-stages",
			stageIds: next.map((item) => item.id),
		});
	}, [index, run, stages]);
	const onMoveDown = useCallback(() => {
		if (index >= stages.length - 1) {
			return;
		}
		const next = [...stages];
		const current = next[index];
		const below = next[index + 1];
		if (!(current && below)) {
			return;
		}
		next[index] = below;
		next[index + 1] = current;
		run({
			action: "reorder-stages",
			stageIds: next.map((item) => item.id),
		});
	}, [index, run, stages]);
	const onRemove = useCallback(() => {
		if (pendingRemoval === stage.id) {
			run({ action: "remove-stage", stageId: stage.id });
			setPendingRemoval(null);
			return;
		}
		setPendingRemoval(stage.id);
	}, [pendingRemoval, run, setPendingRemoval, stage.id]);
	return (
		<div className="flex flex-col gap-2">
			<form className="flex flex-col gap-2" onSubmit={onNameSubmit}>
				<Field>
					<FieldLabel htmlFor={`stage-name-${stage.id}`}>
						{stage.name}
					</FieldLabel>
					<Input
						id={`stage-name-${stage.id}`}
						onChange={onNameChange}
						value={name}
					/>
				</Field>
				<Button disabled={disabled} type="submit">
					{PROJECT_SHELL_COPY.save}
				</Button>
			</form>
			<NativeSelect
				aria-label={stage.name}
				disabled={disabled}
				id={`stage-state-${stage.id}`}
				onChange={onStateChange}
				value={stage.state}
			>
				{STAGE_STATES.map((state) => (
					<NativeSelectOption key={state} value={state}>
						{state}
					</NativeSelectOption>
				))}
			</NativeSelect>
			<div className="flex flex-wrap gap-2">
				<Button
					disabled={disabled || index === 0}
					onClick={onMoveUp}
					type="button"
					variant="outline"
				>
					{PROJECT_SHELL_COPY.moveUp}
				</Button>
				<Button
					disabled={disabled || index >= stages.length - 1}
					onClick={onMoveDown}
					type="button"
					variant="outline"
				>
					{PROJECT_SHELL_COPY.moveDown}
				</Button>
				<Button
					disabled={disabled}
					onClick={onRemove}
					type="button"
					variant="outline"
				>
					{PROJECT_SHELL_COPY.removeStage}
				</Button>
			</div>
			{pendingRemoval === stage.id ? (
				<p role="status">{stageRemovalPreviewCopy(stage.name)}</p>
			) : null}
		</div>
	);
}
