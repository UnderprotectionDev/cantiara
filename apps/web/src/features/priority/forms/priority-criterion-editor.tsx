import { Button } from "@cantiara/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useState } from "react";

import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import { createPriorityCriterionError } from "./create-priority-criterion-error";
import {
	EMPTY_RANK_EXPLANATIONS,
	PRIORITY_COPY,
	PRIORITY_RANKS,
	type PriorityCriterionDefinitionView,
	type RankExplanations,
} from "./priority-copy";

interface CreatePriorityCriterionValues {
	description: string;
	name: string;
	rankExplanations: RankExplanations;
}

export default function PriorityCriterionEditor({
	projectId,
}: {
	projectId: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [error, setError] = useState<string | null>(null);
	const criteria = useQuery(
		orpc.priority.list.queryOptions({ input: { projectId } })
	);
	const create = useMutation(
		orpc.priority.create.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await queryClient.invalidateQueries({
						queryKey: orpc.priority.list.queryKey({
							input: { projectId },
						}),
					});
					recordSave();
					setError(null);
					return;
				}
				const message = createPriorityCriterionError(outcome);
				if (message) {
					setError(message);
				}
			},
		})
	);
	const update = useMutation(
		orpc.priority.update.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await queryClient.invalidateQueries({
						queryKey: orpc.priority.list.queryKey({
							input: { projectId },
						}),
					});
					recordSave();
				}
			},
		})
	);
	const form = useForm({
		defaultValues: {
			description: "",
			name: "",
			rankExplanations: { ...EMPTY_RANK_EXPLANATIONS } as RankExplanations,
		} satisfies CreatePriorityCriterionValues,
		onSubmit: async ({ formApi, value }) => {
			setError(null);
			const result = attemptOnlineWork("record-create", () =>
				create.mutateAsync({
					idempotencyKey: newIdempotencyKey(),
					payload: {
						description: value.description,
						name: value.name,
						projectId,
						rankExplanations: value.rankExplanations,
					},
				})
			);
			if (result.status === "refused") {
				return;
			}
			const outcome = await result.value;
			if (outcome.status === "committed" || outcome.status === "replayed") {
				formApi.reset();
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
	const definitions = criteria.data ?? [];

	return (
		<section aria-label={PRIORITY_COPY.priorityMetrics}>
			<h2 className="font-medium text-sm">{PRIORITY_COPY.priorityMetrics}</h2>
			{definitions.length > 0 ? (
				<ul className="mt-3 flex flex-col gap-2 text-sm">
					{definitions.map((definition) => (
						<CriterionRow
							attemptOnlineWork={attemptOnlineWork}
							definition={definition}
							key={definition.id}
							markUnsaved={markUnsaved}
							update={update.mutateAsync}
						/>
					))}
				</ul>
			) : null}
			<form className="mt-4 flex flex-col gap-3" onSubmit={onSubmit}>
				<FieldGroup>
					<form.Field name="name">
						{(field) => (
							<NameField
								onValueChange={field.handleChange}
								value={field.state.value}
							/>
						)}
					</form.Field>
					<form.Field name="description">
						{(field) => (
							<DescriptionField
								onValueChange={field.handleChange}
								value={field.state.value}
							/>
						)}
					</form.Field>
					<form.Field name="rankExplanations">
						{(field) => (
							<RankExplanationFields
								onValueChange={field.handleChange}
								value={field.state.value}
							/>
						)}
					</form.Field>
				</FieldGroup>
				<Button disabled={create.isPending} type="submit">
					{PRIORITY_COPY.addPriorityMetric}
				</Button>
			</form>
			{error ? <p role="alert">{error}</p> : null}
		</section>
	);
}

function CriterionRow({
	attemptOnlineWork,
	definition,
	markUnsaved,
	update,
}: {
	attemptOnlineWork: ReturnType<typeof useClientShell>["attemptOnlineWork"];
	definition: PriorityCriterionDefinitionView;
	markUnsaved: () => void;
	update: (command: {
		baseRevision: number;
		idempotencyKey: string;
		payload: {
			criterionId: string;
			description?: string;
			enabled?: boolean;
			rankExplanations?: RankExplanations;
		};
	}) => Promise<unknown>;
}) {
	const [description, setDescription] = useState(definition.description);
	const [rankExplanations, setRankExplanations] = useState(
		definition.rankExplanations
	);
	const onEnable = useCallback(() => {
		markUnsaved();
		const result = attemptOnlineWork("record-create", () =>
			update({
				baseRevision: definition.revision,
				idempotencyKey: newIdempotencyKey(),
				payload: {
					criterionId: definition.id,
					enabled: true,
				},
			})
		);
		if (result.status === "refused") {
			return;
		}
		result.value.catch(() => undefined);
	}, [
		attemptOnlineWork,
		definition.id,
		definition.revision,
		markUnsaved,
		update,
	]);
	const onSave = useCallback(() => {
		markUnsaved();
		const result = attemptOnlineWork("record-create", () =>
			update({
				baseRevision: definition.revision,
				idempotencyKey: newIdempotencyKey(),
				payload: {
					criterionId: definition.id,
					description,
					rankExplanations,
				},
			})
		);
		if (result.status === "refused") {
			return;
		}
		result.value.catch(() => undefined);
	}, [
		attemptOnlineWork,
		definition.id,
		definition.revision,
		description,
		markUnsaved,
		rankExplanations,
		update,
	]);

	return (
		<li className="flex flex-col gap-2">
			<div className="flex items-center justify-between gap-2">
				<span>
					{definition.name}
					{definition.enabled ? "" : ` · ${PRIORITY_COPY.enable}`}
				</span>
				{definition.enabled ? null : (
					<Button onClick={onEnable} size="sm" type="button" variant="outline">
						{PRIORITY_COPY.enable}
					</Button>
				)}
			</div>
			<DescriptionField
				id={`priority-criterion-description-${definition.id}`}
				onValueChange={setDescription}
				value={description}
			/>
			<RankExplanationFields
				idPrefix={`priority-rank-${definition.id}`}
				onValueChange={setRankExplanations}
				value={rankExplanations}
			/>
			<Button onClick={onSave} size="sm" type="button" variant="outline">
				{PRIORITY_COPY.save}
			</Button>
		</li>
	);
}

function NameField({
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
		<Field>
			<FieldLabel htmlFor="priority-criterion-name">
				{PRIORITY_COPY.name}
			</FieldLabel>
			<Input
				id="priority-criterion-name"
				onChange={onChange}
				required={true}
				value={value}
			/>
		</Field>
	);
}

function DescriptionField({
	id = "priority-criterion-description",
	onValueChange,
	value,
}: {
	id?: string;
	onValueChange: (value: string) => void;
	value: string;
}) {
	const onChange = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			onValueChange(event.target.value);
		},
		[onValueChange]
	);
	return (
		<Field>
			<FieldLabel htmlFor={id}>{PRIORITY_COPY.description}</FieldLabel>
			<Textarea id={id} onChange={onChange} value={value} />
		</Field>
	);
}

function RankExplanationFields({
	idPrefix = "priority-rank",
	onValueChange,
	value,
}: {
	idPrefix?: string;
	onValueChange: (value: RankExplanations) => void;
	value: RankExplanations;
}) {
	return (
		<Field>
			<FieldLabel>{PRIORITY_COPY.rankExplanation}</FieldLabel>
			<ul className="flex flex-col gap-2">
				{PRIORITY_RANKS.map((rank) => (
					<RankExplanationRow
						idPrefix={idPrefix}
						key={rank}
						onValueChange={onValueChange}
						rank={rank}
						value={value}
					/>
				))}
			</ul>
		</Field>
	);
}

function RankExplanationRow({
	idPrefix,
	onValueChange,
	rank,
	value,
}: {
	idPrefix: string;
	onValueChange: (value: RankExplanations) => void;
	rank: (typeof PRIORITY_RANKS)[number];
	value: RankExplanations;
}) {
	const fieldId = `${idPrefix}-${rank}`;
	const onChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			onValueChange({ ...value, [rank]: event.target.value });
		},
		[onValueChange, rank, value]
	);
	return (
		<li>
			<FieldLabel htmlFor={fieldId}>{rank}</FieldLabel>
			<Input id={fieldId} onChange={onChange} value={value[rank]} />
		</li>
	);
}
