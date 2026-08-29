import { Button } from "@cantiara/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback } from "react";

import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc } from "@/utils/orpc";

import { BLOCKERS_COPY } from "./blockers-copy";
import { invalidateBlockers } from "./invalidate-blockers";

interface WorkOption {
	id: string;
	key: string;
	title: string;
}

export default function WorkBlockersPanel({
	candidates,
	projectId,
	workId,
}: {
	candidates: WorkOption[];
	projectId: string;
	workId: string;
}) {
	const listed = useQuery(
		orpc.blockers.list.queryOptions({
			input: { workId },
		})
	);
	const sources = candidates.filter((item) => item.id !== workId);
	return (
		<section className="flex flex-col gap-3">
			<h3 className="font-medium text-sm">{BLOCKERS_COPY.blockedBy}</h3>
			{listed.data && listed.data.relations.length > 0 ? (
				<ul className="flex flex-col gap-2 text-sm">
					{listed.data.relations.map((relation) => (
						<BlockerRow
							candidates={candidates}
							key={relation.id}
							projectId={projectId}
							relation={relation}
							workId={workId}
						/>
					))}
				</ul>
			) : null}
			<AddBlockerForm
				candidates={sources}
				projectId={projectId}
				workId={workId}
			/>
		</section>
	);
}

function BlockerRow({
	candidates,
	projectId,
	relation,
	workId,
}: {
	candidates: WorkOption[];
	projectId: string;
	relation: {
		id: string;
		source: { id: string; kind: string };
		state: string;
	};
	workId: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const remove = useMutation(
		orpc.blockers.remove.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await invalidateBlockers(projectId, workId);
					recordSave();
				}
			},
		})
	);
	const onRemove = useCallback(() => {
		markUnsaved();
		const result = attemptOnlineWork("record-create", () =>
			remove.mutateAsync({
				idempotencyKey: newIdempotencyKey(),
				relationId: relation.id,
			})
		);
		if (result.status === "refused") {
			return;
		}
		result.value.catch(() => undefined);
	}, [attemptOnlineWork, markUnsaved, relation.id, remove]);
	return (
		<li className="flex items-center justify-between gap-2">
			<span>
				{sourceLabel(relation.source, candidates)}{" "}
				<span className="text-muted-foreground">{relation.state}</span>
			</span>
			<Button onClick={onRemove} size="sm" type="button" variant="ghost">
				{BLOCKERS_COPY.removeRelation}
			</Button>
		</li>
	);
}

function AddBlockerForm({
	candidates,
	projectId,
	workId,
}: {
	candidates: WorkOption[];
	projectId: string;
	workId: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [firstCandidate] = candidates;
	const add = useMutation(
		orpc.blockers.add.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await invalidateBlockers(projectId, workId);
					recordSave();
				}
			},
		})
	);
	const form = useForm({
		defaultValues: {
			sourceId: firstCandidate ? firstCandidate.id : "",
		},
		onSubmit: async ({ value }) => {
			if (value.sourceId.length === 0) {
				return;
			}
			const result = attemptOnlineWork("record-create", () =>
				add.mutateAsync({
					blockedWorkId: workId,
					idempotencyKey: newIdempotencyKey(),
					source: { id: value.sourceId, kind: "Work" },
				})
			);
			if (result.status === "refused") {
				return;
			}
			await result.value.catch(() => undefined);
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
				<form.Field name="sourceId">
					{(field) => (
						<SourceWorkField
							candidates={candidates}
							onValueChange={field.handleChange}
							value={field.state.value}
						/>
					)}
				</form.Field>
				<Button disabled={candidates.length === 0} type="submit">
					{BLOCKERS_COPY.blocks}
				</Button>
			</FieldGroup>
		</form>
	);
}

function SourceWorkField({
	candidates,
	onValueChange,
	value,
}: {
	candidates: WorkOption[];
	onValueChange: (value: string) => void;
	value: string;
}) {
	const onChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			onValueChange(event.target.value);
		},
		[onValueChange]
	);
	return (
		<Field>
			<FieldLabel htmlFor="blocker-source">
				{BLOCKERS_COPY.blockedBy}
			</FieldLabel>
			<NativeSelect id="blocker-source" onChange={onChange} value={value}>
				{candidates.map((item) => (
					<NativeSelectOption key={item.id} value={item.id}>
						{item.key} {item.title}
					</NativeSelectOption>
				))}
			</NativeSelect>
		</Field>
	);
}

function sourceLabel(
	source: { id: string; kind: string },
	candidates: WorkOption[]
): string {
	if (source.kind === "Work") {
		const work = candidates.find((item) => item.id === source.id);
		if (work) {
			return `${work.key} ${work.title}`;
		}
	}
	if (source.kind === "Question") {
		return `Open Question ${source.id}`;
	}
	return `${source.kind} ${source.id}`;
}
