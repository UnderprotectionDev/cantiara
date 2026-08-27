import { Button } from "@cantiara/ui/components/button";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
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
	const [pendingRemoval, setPendingRemoval] = useState<string | null>(null);
	const addForm = useForm({
		defaultValues: { name: "" },
		onSubmit: async ({ formApi, value }) => {
			const outcome = await run({ action: "add-stage", name: value.name });
			if (outcome?.status === "committed" || outcome?.status === "replayed") {
				formApi.reset();
			}
		},
	});
	const onAdd = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			addForm.handleSubmit().catch(() => undefined);
		},
		[addForm]
	);
	return (
		<section aria-label={PROJECT_SHELL_COPY.stages}>
			<h2 className="font-medium text-sm">{PROJECT_SHELL_COPY.stages}</h2>
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
				<addForm.Field name="name">
					{(field) => (
						<StageNameField
							id="add-stage"
							label={PROJECT_SHELL_COPY.addStage}
							onValueChange={field.handleChange}
							value={field.state.value}
						/>
					)}
				</addForm.Field>
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
	const renameForm = useForm({
		defaultValues: { name: stage.name },
		onSubmit: async ({ value }) => {
			await run({
				action: "rename-stage",
				name: value.name,
				stageId: stage.id,
			});
		},
	});
	const onNameSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			renameForm.handleSubmit().catch(() => undefined);
		},
		[renameForm]
	);
	const onStateChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			run({
				action: "set-stage-state",
				stageId: stage.id,
				state: event.target.value,
			}).catch(() => undefined);
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
		}).catch(() => undefined);
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
		}).catch(() => undefined);
	}, [index, run, stages]);
	const onRemove = useCallback(() => {
		if (pendingRemoval === stage.id) {
			run({ action: "remove-stage", stageId: stage.id }).catch(() => undefined);
			setPendingRemoval(null);
			return;
		}
		setPendingRemoval(stage.id);
	}, [pendingRemoval, run, setPendingRemoval, stage.id]);
	return (
		<div className="flex flex-col gap-2">
			<form className="flex flex-col gap-2" onSubmit={onNameSubmit}>
				<renameForm.Field name="name">
					{(field) => (
						<StageNameField
							id={`stage-name-${stage.id}`}
							label={stage.name}
							onValueChange={field.handleChange}
							value={field.state.value}
						/>
					)}
				</renameForm.Field>
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

function StageNameField({
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
