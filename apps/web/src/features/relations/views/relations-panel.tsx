import { Button } from "@cantiara/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useState } from "react";

import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import {
	GENERIC_RELATION_TYPES,
	type GenericRelationType,
	RELATIONS_COPY,
} from "../forms/relations-copy";
import { USED_IN_QUERY_ROOT } from "./used-in-query-key";

interface WorkOption {
	id: string;
	key: string;
	title: string;
}

interface PresentedEnd {
	id: string;
	key?: string;
	kind: string;
	openSourceRecord?: boolean;
	reason?: string;
	status: "resolved" | "broken";
	title?: string;
}

interface PresentedRelation {
	from: PresentedEnd;
	id: string;
	originLocation: {
		componentId: string;
		missing: boolean;
		sourceVersion: string;
	} | null;
	to: PresentedEnd;
	type: string;
	typeLabelFrom: string;
	typeLabelTo: string;
}

export default function RelationsPanel({
	candidates,
	onOpenSourceRecord,
	projectId,
	workId,
}: {
	candidates: WorkOption[];
	onOpenSourceRecord?: (id: string) => void;
	projectId: string;
	workId: string;
}) {
	const listed = useQuery(
		orpc.relations.list.queryOptions({
			input: { id: workId, kind: "Work" },
		})
	);
	return (
		<section className="flex flex-col gap-3">
			<h3 className="font-medium text-sm">{RELATIONS_COPY.related}</h3>
			{listed.data && listed.data.length > 0 ? (
				<ul className="flex flex-col gap-2 text-sm">
					{listed.data.map((relation) => (
						<RelationRow
							key={relation.id}
							onOpenSourceRecord={onOpenSourceRecord}
							projectId={projectId}
							relation={relation}
							workId={workId}
						/>
					))}
				</ul>
			) : (
				<p className="text-muted-foreground text-sm">
					{RELATIONS_COPY.noRelations}
				</p>
			)}
			<CreateRelationForm
				candidates={candidates}
				projectId={projectId}
				workId={workId}
			/>
		</section>
	);
}

function RelationRow({
	onOpenSourceRecord,
	projectId,
	relation,
	workId,
}: {
	onOpenSourceRecord?: (id: string) => void;
	projectId: string;
	relation: PresentedRelation;
	workId: string;
}) {
	const viewpoint = relation.from.id === workId ? "from" : "to";
	const other = viewpoint === "from" ? relation.to : relation.from;
	const typeLabel =
		viewpoint === "from" ? relation.typeLabelFrom : relation.typeLabelTo;
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const remove = useMutation(
		orpc.relations.delete.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await invalidateRelations(projectId, workId);
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
		<li className="flex flex-col gap-1">
			<div className="flex items-center justify-between gap-2">
				<span>
					{typeLabel}{" "}
					{other.status === "resolved" ? (
						<>
							<span className="font-mono text-muted-foreground">
								{other.key}
							</span>{" "}
							{other.title}
						</>
					) : (
						<>
							{other.reason}
							{other.title ? ` ${other.title}` : ""}
						</>
					)}
				</span>
				<Button onClick={onRemove} size="sm" type="button" variant="ghost">
					{RELATIONS_COPY.remove}
				</Button>
			</div>
			{relation.originLocation ? (
				<p className="text-muted-foreground text-xs">
					{RELATIONS_COPY.originLocation}{" "}
					{relation.originLocation.missing
						? RELATIONS_COPY.sourceItemGone
						: relation.originLocation.componentId}
				</p>
			) : null}
			{other.openSourceRecord ? (
				<OpenSourceRecordButton
					onOpen={onOpenSourceRecord}
					recordId={other.id}
				/>
			) : null}
		</li>
	);
}

function CreateRelationForm({
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
	const [previewError, setPreviewError] = useState<string | null>(null);
	const preview = useMutation(orpc.relations.preview.mutationOptions());
	const create = useMutation(
		orpc.relations.create.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await invalidateRelations(projectId, workId);
					recordSave();
				}
			},
		})
	);
	const form = useForm({
		defaultValues: {
			toId: firstCandidate ? firstCandidate.id : "",
			type: RELATIONS_COPY.related as GenericRelationType,
		},
		onSubmit: async ({ value }) => {
			if (value.toId.length === 0) {
				return;
			}
			setPreviewError(null);
			const ends = endsForType(workId, value.toId, value.type);
			const previewResult = await preview.mutateAsync({
				from: ends.from,
				to: ends.to,
				type: value.type,
			});
			if (previewResult.status !== "ok") {
				setPreviewError(previewResult.reason);
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
	const onConfirm = useCallback(() => {
		const { values } = form.state;
		if (values.toId.length === 0) {
			return;
		}
		const ends = endsForType(workId, values.toId, values.type);
		const result = attemptOnlineWork("record-create", () =>
			create.mutateAsync({
				from: ends.from,
				idempotencyKey: newIdempotencyKey(),
				previewAcknowledged: true,
				to: ends.to,
				type: values.type,
			})
		);
		if (result.status === "refused") {
			return;
		}
		result.value.catch(() => undefined);
	}, [attemptOnlineWork, create, form, workId]);
	const previewData =
		preview.data && preview.data.status === "ok" ? preview.data.preview : null;
	return (
		<form className="flex flex-col gap-3" onSubmit={onSubmit}>
			<FieldGroup className="flex-row flex-wrap items-end gap-3">
				<form.Field name="type">
					{(field) => (
						<RelationTypeField
							onValueChange={field.handleChange}
							value={field.state.value}
						/>
					)}
				</form.Field>
				<form.Field name="toId">
					{(field) => (
						<RelationEndField
							candidates={candidates}
							label={
								form.state.values.type === RELATIONS_COPY.origin
									? RELATIONS_COPY.origin
									: RELATIONS_COPY.related
							}
							onValueChange={field.handleChange}
							value={field.state.value}
						/>
					)}
				</form.Field>
				<Button disabled={candidates.length === 0} type="submit">
					{RELATIONS_COPY.preview}
				</Button>
			</FieldGroup>
			{previewError ? <p role="alert">{previewError}</p> : null}
			{previewData ? (
				<div className="flex flex-col gap-2 rounded-md border p-3 text-sm">
					<p>
						{previewData.type} {endLabel(previewData.from)} →{" "}
						{endLabel(previewData.to)}
					</p>
					<Button onClick={onConfirm} size="sm" type="button">
						{RELATIONS_COPY.confirmRelation}
					</Button>
				</div>
			) : null}
		</form>
	);
}

function endsForType(
	workId: string,
	otherId: string,
	type: GenericRelationType
) {
	if (type === RELATIONS_COPY.origin) {
		return {
			from: { id: otherId, kind: "Work" as const },
			to: { id: workId, kind: "Work" as const },
		};
	}
	return {
		from: { id: workId, kind: "Work" as const },
		to: { id: otherId, kind: "Work" as const },
	};
}

function endLabel(end: PresentedEnd): string {
	if (end.status === "resolved") {
		return `${end.key ?? end.id} ${end.title ?? ""}`.trim();
	}
	return end.reason ?? RELATIONS_COPY.permanentlyDeleted;
}

async function invalidateRelations(projectId: string, workId: string) {
	await queryClient.invalidateQueries({
		queryKey: orpc.relations.list.queryKey({
			input: { id: workId, kind: "Work" },
		}),
	});
	await queryClient.invalidateQueries({
		queryKey: orpc.workLifecycle.getScope.queryKey({
			input: { workId },
		}),
	});
	await queryClient.invalidateQueries({
		queryKey: orpc.workLifecycle.list.queryKey({
			input: { projectId },
		}),
	});
	await queryClient.invalidateQueries({
		queryKey: [USED_IN_QUERY_ROOT],
	});
}

function OpenSourceRecordButton({
	onOpen,
	recordId,
}: {
	onOpen?: (id: string) => void;
	recordId: string;
}) {
	const onClick = useCallback(() => {
		onOpen?.(recordId);
	}, [onOpen, recordId]);
	return (
		<Button onClick={onClick} size="sm" type="button" variant="ghost">
			{RELATIONS_COPY.openSourceRecord}
		</Button>
	);
}

function RelationTypeField({
	onValueChange,
	value,
}: {
	onValueChange: (value: GenericRelationType) => void;
	value: GenericRelationType;
}) {
	const onChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			const next = event.target.value;
			if (next === RELATIONS_COPY.related || next === RELATIONS_COPY.origin) {
				onValueChange(next);
			}
		},
		[onValueChange]
	);
	return (
		<Field>
			<FieldLabel htmlFor="relation-type">{RELATIONS_COPY.type}</FieldLabel>
			<NativeSelect id="relation-type" onChange={onChange} value={value}>
				{GENERIC_RELATION_TYPES.map((type) => (
					<NativeSelectOption key={type} value={type}>
						{type}
					</NativeSelectOption>
				))}
			</NativeSelect>
		</Field>
	);
}

function RelationEndField({
	candidates,
	label,
	onValueChange,
	value,
}: {
	candidates: WorkOption[];
	label: string;
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
			<FieldLabel htmlFor="relation-end">{label}</FieldLabel>
			<NativeSelect id="relation-end" onChange={onChange} value={value}>
				{candidates.map((item) => (
					<NativeSelectOption key={item.id} value={item.id}>
						{item.key} {item.title}
					</NativeSelectOption>
				))}
			</NativeSelect>
		</Field>
	);
}
