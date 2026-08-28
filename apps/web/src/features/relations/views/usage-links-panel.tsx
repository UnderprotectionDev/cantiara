import { Button } from "@cantiara/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useState } from "react";

import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { invalidateWork } from "@/features/work-lifecycle/forms/invalidate-work";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc } from "@/utils/orpc";

import { RELATIONS_COPY } from "./relations-copy";

export default function UsageLinksPanel({
	hostRecordId,
	projectId,
	usageLinks,
	works,
}: {
	hostRecordId: string;
	projectId: string;
	usageLinks: Array<{
		hostRecordId: string;
		id: string;
		kindLabel: string;
		sourceRecordId: string;
	}>;
	works: Array<{ id: string; key: string; title: string }>;
}) {
	const hosted = usageLinks.filter(
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
					projectId={projectId}
					source={works.find((item) => item.id === link.sourceRecordId)}
					usageLinkId={link.id}
				/>
			))}
			{candidates.length > 0 ? (
				<CreateUsageForm
					candidates={candidates}
					hostRecordId={hostRecordId}
					projectId={projectId}
				/>
			) : null}
		</section>
	);
}

function UsageEmbedRow({
	hostRecordId,
	kindLabel,
	projectId,
	source,
	usageLinkId,
}: {
	hostRecordId: string;
	kindLabel: string;
	projectId: string;
	source: { key: string; title: string } | undefined;
	usageLinkId: string;
}) {
	const { attemptOnlineWork, recordSave } = useClientShell();
	const unlink = useMutation(
		orpc.workLifecycle.unlinkUsageLink.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await invalidateWork(projectId, hostRecordId);
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
	projectId,
}: {
	candidates: Array<{ id: string; key: string; title: string }>;
	hostRecordId: string;
	projectId: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [error, setError] = useState<string | null>(null);
	const [firstCandidate] = candidates;
	const create = useMutation(
		orpc.workLifecycle.createUsageLink.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await invalidateWork(projectId, hostRecordId);
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
