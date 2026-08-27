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
	RELATIONS_COPY,
	USAGE_KIND_LABEL,
	USAGE_KINDS,
	type UsageKind,
} from "./relations-copy";

async function invalidateUsage(recordId: string) {
	await queryClient.invalidateQueries({
		queryKey: orpc.relations.inspect.queryKey({
			input: { recordId },
		}),
	});
}

export default function UsageLinksPanel({
	hostRecordId,
	works,
}: {
	hostRecordId: string;
	works: Array<{ id: string; key: string; title: string }>;
}) {
	const graph = useQuery(
		orpc.relations.inspect.queryOptions({
			input: { recordId: hostRecordId },
		})
	);
	const hosted = (graph.data?.usageLinks ?? []).filter(
		(link) => link.hostRecordId === hostRecordId
	);
	const candidates = works.filter((item) => item.id !== hostRecordId);

	return (
		<section className="flex flex-col gap-3">
			{hosted.map((link) => (
				<UsageEmbedRow
					hostRecordId={hostRecordId}
					key={link.id}
					kindLabel={link.kindLabel}
					source={works.find((item) => item.id === link.sourceRecordId)}
					usageLinkId={link.id}
				/>
			))}
			{candidates.length > 0 ? (
				<CreateUsageForm candidates={candidates} hostRecordId={hostRecordId} />
			) : null}
		</section>
	);
}

function UsageEmbedRow({
	hostRecordId,
	kindLabel,
	source,
	usageLinkId,
}: {
	hostRecordId: string;
	kindLabel: string;
	source: { key: string; title: string } | undefined;
	usageLinkId: string;
}) {
	const { attemptOnlineWork, recordSave } = useClientShell();
	const unlink = useMutation(
		orpc.relations.unlinkUsageLink.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await invalidateUsage(hostRecordId);
					await invalidateUsage(outcome.source.id);
					recordSave();
				}
			},
		})
	);
	const onUnlink = useCallback(() => {
		const result = attemptOnlineWork("record-create", () =>
			unlink.mutateAsync({
				idempotencyKey: newIdempotencyKey(),
				usageLinkId,
			})
		);
		if (result.status === "refused") {
			return;
		}
		result.value.catch(() => undefined);
	}, [attemptOnlineWork, unlink, usageLinkId]);

	return (
		<div className="flex items-center justify-between gap-2">
			<p className="text-sm">
				<span className="text-muted-foreground">{kindLabel}</span>{" "}
				{source ? (
					<>
						<span className="font-mono text-muted-foreground">
							{source.key}
						</span>{" "}
						{source.title}
					</>
				) : null}
			</p>
			<Button onClick={onUnlink} size="sm" type="button" variant="ghost">
				{RELATIONS_COPY.unlink}
			</Button>
		</div>
	);
}

function CreateUsageForm({
	candidates,
	hostRecordId,
}: {
	candidates: Array<{ id: string; key: string; title: string }>;
	hostRecordId: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [error, setError] = useState<string | null>(null);
	const [firstCandidate] = candidates;
	const create = useMutation(
		orpc.relations.createUsageLink.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await invalidateUsage(hostRecordId);
					await invalidateUsage(outcome.usageLink.sourceRecordId);
					recordSave();
					setError(null);
				}
			},
		})
	);
	const form = useForm({
		defaultValues: {
			kind: "inline-record-reference" as UsageKind,
			sourceRecordId: firstCandidate ? firstCandidate.id : "",
		},
		onSubmit: async ({ value }) => {
			if (value.sourceRecordId.length === 0) {
				return;
			}
			setError(null);
			const result = attemptOnlineWork("record-create", () =>
				create.mutateAsync({
					hostRecordId,
					idempotencyKey: newIdempotencyKey(),
					kind: value.kind,
					sourceRecordId: value.sourceRecordId,
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

	return (
		<form className="flex flex-col gap-3" onSubmit={onSubmit}>
			{error ? <p role="alert">{error}</p> : null}
			<FieldGroup>
				<form.Field name="kind">
					{(field) => (
						<KindField
							onValueChange={field.handleChange}
							value={field.state.value}
						/>
					)}
				</form.Field>
				<form.Field name="sourceRecordId">
					{(field) => (
						<SourceField
							kind={form.getFieldValue("kind")}
							onValueChange={field.handleChange}
							options={candidates}
							value={field.state.value}
						/>
					)}
				</form.Field>
			</FieldGroup>
			<Button size="sm" type="submit">
				{USAGE_KIND_LABEL[form.getFieldValue("kind")]}
			</Button>
		</form>
	);
}

function KindField({
	onValueChange,
	value,
}: {
	onValueChange: (value: UsageKind) => void;
	value: UsageKind;
}) {
	const onChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			onValueChange(event.target.value as UsageKind);
		},
		[onValueChange]
	);
	return (
		<Field>
			<FieldLabel htmlFor="usage-kind">{USAGE_KIND_LABEL[value]}</FieldLabel>
			<NativeSelect id="usage-kind" onChange={onChange} value={value}>
				{USAGE_KINDS.map((kind) => (
					<NativeSelectOption key={kind} value={kind}>
						{USAGE_KIND_LABEL[kind]}
					</NativeSelectOption>
				))}
			</NativeSelect>
		</Field>
	);
}

function SourceField({
	kind,
	onValueChange,
	options,
	value,
}: {
	kind: UsageKind;
	onValueChange: (value: string) => void;
	options: Array<{ id: string; key: string; title: string }>;
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
			<FieldLabel htmlFor="usage-source">{USAGE_KIND_LABEL[kind]}</FieldLabel>
			<NativeSelect id="usage-source" onChange={onChange} value={value}>
				{options.map((item) => (
					<NativeSelectOption key={item.id} value={item.id}>
						{item.key} {item.title}
					</NativeSelectOption>
				))}
			</NativeSelect>
		</Field>
	);
}
