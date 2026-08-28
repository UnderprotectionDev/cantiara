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

import { RELATIONS_COPY } from "./relations-copy";

const silentMeta = { silent: true } as const;

function failureMessage(failure: unknown): string {
	if (
		typeof failure === "object" &&
		failure !== null &&
		"message" in failure &&
		typeof failure.message === "string" &&
		failure.message.length > 0
	) {
		return failure.message;
	}
	return RELATIONS_COPY.inlineReference;
}

async function invalidateUsage(recordId: string) {
	await queryClient.invalidateQueries({
		queryKey: orpc.workLifecycle.inspectUsageLinks.queryKey({
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
		orpc.workLifecycle.inspectUsageLinks.queryOptions({
			input: { recordId: hostRecordId },
			meta: silentMeta,
		})
	);
	const hosted = (graph.data?.usageLinks ?? []).filter(
		(link) => link.hostRecordId === hostRecordId
	);
	const candidates = works.filter((item) => item.id !== hostRecordId);

	return (
		<section className="flex flex-col gap-3">
			{graph.isError ? <p role="alert">{failureMessage(graph.error)}</p> : null}
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
	const [error, setError] = useState<string | null>(null);
	const unlink = useMutation(
		orpc.workLifecycle.unlinkUsageLink.mutationOptions({
			meta: silentMeta,
			onError: (failure) => {
				setError(failureMessage(failure));
			},
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await invalidateUsage(hostRecordId);
					await invalidateUsage(outcome.source.id);
					recordSave();
					setError(null);
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
		<div className="flex flex-col gap-2">
			{error ? <p role="alert">{error}</p> : null}
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
		orpc.workLifecycle.createUsageLink.mutationOptions({
			meta: silentMeta,
			onError: (failure) => {
				setError(failureMessage(failure));
			},
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
					kind: "inline-record-reference",
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
				<form.Field name="sourceRecordId">
					{(field) => (
						<SourceField
							onValueChange={field.handleChange}
							options={candidates}
							value={field.state.value}
						/>
					)}
				</form.Field>
			</FieldGroup>
			<Button size="sm" type="submit">
				{RELATIONS_COPY.inlineReference}
			</Button>
		</form>
	);
}

function SourceField({
	onValueChange,
	options,
	value,
}: {
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
			<FieldLabel htmlFor="usage-source">
				{RELATIONS_COPY.inlineReference}
			</FieldLabel>
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
