import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useMemo, useState } from "react";

import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import { invalidateWork } from "./invalidate-work";
import { WORK_LIFECYCLE_COPY } from "./work-lifecycle-copy";

const DEFAULT_FIELDS = [
	"title",
	"type",
	"description",
	"lightChecklist",
] as const;

const PORTABLE_FIELD_LABELS = {
	description: WORK_LIFECYCLE_COPY.description,
	lightChecklist: WORK_LIFECYCLE_COPY.lightChecklist,
	title: WORK_LIFECYCLE_COPY.title,
	type: WORK_LIFECYCLE_COPY.type,
} as const;

type LightChecklistPreview = Array<{
	completed: boolean;
	id: string;
	title: string;
}>;

export default function RecreateWorkForm({
	projectId,
	workId,
}: {
	projectId: string;
	workId: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [error, setError] = useState<string | null>(null);
	const [targetProjectId, setTargetProjectId] = useState("");
	const projects = useQuery(orpc.projectShell.list.queryOptions());
	const targets = useMemo(
		() => (projects.data ?? []).filter((project) => project.id !== projectId),
		[projectId, projects.data]
	);
	const preview = useQuery({
		...orpc.workLifecycle.previewRecreate.queryOptions({
			input: { targetProjectId, workId },
		}),
		enabled: targetProjectId.length > 0,
	});
	const recreate = useMutation(
		orpc.workLifecycle.recreate.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await invalidateWork(projectId, workId);
					await queryClient.invalidateQueries({
						queryKey: orpc.workLifecycle.list.queryKey({
							input: { projectId: targetProjectId },
						}),
					});
					recordSave();
					setError(null);
					return;
				}
				if (
					outcome.status === "rejected" &&
					outcome.reason === "work-not-portable"
				) {
					setError(WORK_LIFECYCLE_COPY.recreateInAnotherProject);
					return;
				}
				setError("Conflict");
			},
		})
	);
	const form = useForm({
		defaultValues: {
			selectedFields: [...DEFAULT_FIELDS] as string[],
			selectedRelationIds: [] as string[],
		},
		onSubmit: async ({ value }) => {
			setError(null);
			if (targetProjectId.length === 0) {
				return;
			}
			const result = attemptOnlineWork("record-create", () =>
				recreate.mutateAsync({
					idempotencyKey: newIdempotencyKey(),
					payload: {
						relations: preview.data?.relations ?? [],
						selectedFields: value.selectedFields,
						selectedRelationIds: value.selectedRelationIds,
						targetProjectId,
						workId,
					},
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
	const onTargetChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			setTargetProjectId(event.target.value);
		},
		[]
	);
	const previewData = preview.data;

	return (
		<form className="flex flex-col gap-3" onSubmit={onSubmit}>
			<Field className="w-full max-w-sm">
				<FieldLabel htmlFor="recreate-target-project">
					{WORK_LIFECYCLE_COPY.recreateInAnotherProject}
				</FieldLabel>
				<NativeSelect
					className="w-full"
					id="recreate-target-project"
					onChange={onTargetChange}
					value={targetProjectId}
				>
					<NativeSelectOption value="">
						{WORK_LIFECYCLE_COPY.recreateInAnotherProject}
					</NativeSelectOption>
					{targets.map((project) => (
						<NativeSelectOption key={project.id} value={project.id}>
							{project.name}
						</NativeSelectOption>
					))}
				</NativeSelect>
			</Field>
			{previewData ? (
				<FieldGroup className="gap-2">
					<form.Field name="selectedFields">
						{(field) => (
							<section
								aria-label={WORK_LIFECYCLE_COPY.title}
								className="flex flex-col gap-2"
							>
								{previewData.portableFields.map((portable) => (
									<PortableFieldToggle
										checked={field.state.value.includes(portable.id)}
										fieldId={portable.id}
										key={portable.id}
										label={PORTABLE_FIELD_LABELS[portable.id]}
										onToggle={field.handleChange}
										selected={field.state.value}
										value={portable.value}
									/>
								))}
							</section>
						)}
					</form.Field>
					<form.Field name="selectedRelationIds">
						{(field) =>
							previewData.relations.length > 0 ? (
								<section
									aria-label={WORK_LIFECYCLE_COPY.openSourceRecord}
									className="flex flex-col gap-2"
								>
									{previewData.relations.map((relation) => (
										<RelationToggle
											checked={field.state.value.includes(relation.id)}
											key={relation.id}
											onToggle={field.handleChange}
											portable={relation.portable}
											relationId={relation.id}
											selected={field.state.value}
											title={relation.title}
										/>
									))}
								</section>
							) : null
						}
					</form.Field>
				</FieldGroup>
			) : null}
			<Button
				disabled={
					recreate.isPending ||
					targetProjectId.length === 0 ||
					previewData === undefined
				}
				type="submit"
			>
				{WORK_LIFECYCLE_COPY.recreateInAnotherProject}
			</Button>
			{error ? <p role="alert">{error}</p> : null}
		</form>
	);
}

function PortableFieldToggle({
	checked,
	fieldId,
	label,
	onToggle,
	selected,
	value,
}: {
	checked: boolean;
	fieldId: string;
	label: string;
	onToggle: (value: string[]) => void;
	selected: string[];
	value: string | LightChecklistPreview | null;
}) {
	const onCheckedChange = useCallback(
		(next: boolean | "indeterminate") => {
			if (next === true) {
				onToggle([...selected, fieldId]);
				return;
			}
			onToggle(selected.filter((id) => id !== fieldId));
		},
		[fieldId, onToggle, selected]
	);
	return (
		<Field orientation="horizontal">
			<Checkbox
				aria-label={label}
				checked={checked}
				id={`recreate-field-${fieldId}`}
				onCheckedChange={onCheckedChange}
			/>
			<FieldLabel htmlFor={`recreate-field-${fieldId}`}>
				{label}
				{typeof value === "string" ? ` · ${value}` : ""}
			</FieldLabel>
		</Field>
	);
}

function RelationToggle({
	checked,
	onToggle,
	portable,
	relationId,
	selected,
	title,
}: {
	checked: boolean;
	onToggle: (value: string[]) => void;
	portable: boolean;
	relationId: string;
	selected: string[];
	title: string;
}) {
	const onCheckedChange = useCallback(
		(next: boolean | "indeterminate") => {
			if (!portable) {
				return;
			}
			if (next === true) {
				onToggle([...selected, relationId]);
				return;
			}
			onToggle(selected.filter((id) => id !== relationId));
		},
		[onToggle, portable, relationId, selected]
	);
	return (
		<Field orientation="horizontal">
			<Checkbox
				aria-label={title}
				checked={checked}
				disabled={!portable}
				id={`recreate-relation-${relationId}`}
				onCheckedChange={onCheckedChange}
			/>
			<FieldLabel htmlFor={`recreate-relation-${relationId}`}>
				{title}
			</FieldLabel>
		</Field>
	);
}
