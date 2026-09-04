import { Button } from "@cantiara/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useMutation } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useState } from "react";

import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import { SOURCES_COPY } from "./sources-copy";

export default function CreateSourceForm({
	onCreated,
	projectId,
}: {
	onCreated?: (sourceId: string) => void;
	projectId: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [accessedAt, setAccessedAt] = useState("");
	const [capturedContent, setCapturedContent] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [excerpt, setExcerpt] = useState("");
	const [externalId, setExternalId] = useState("");
	const [externalRecordType, setExternalRecordType] = useState("");
	const [provider, setProvider] = useState("");
	const [title, setTitle] = useState("");
	const [url, setUrl] = useState("");
	const create = useMutation(
		orpc.sources.create.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await queryClient.invalidateQueries({
						queryKey: orpc.sources.list.queryKey({
							input: { projectId },
						}),
					});
					onCreated?.(outcome.source.id);
					recordSave();
					setCapturedContent("");
					setError(null);
					setExcerpt("");
					setAccessedAt("");
					setExternalId("");
					setExternalRecordType("");
					setProvider("");
					setTitle("");
					setUrl("");
					return;
				}
				if (outcome.status === "rejected") {
					setError(outcome.reason);
				}
			},
		})
	);
	const onSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			setError(null);
			markUnsaved();
			attemptOnlineWork("record-create", () =>
				create.mutateAsync({
					idempotencyKey: newIdempotencyKey(),
					payload: {
						capturedContent,
						projectId,
						title,
						url,
						...(accessedAt.trim()
							? { accessedAt: new Date(accessedAt).toISOString() }
							: {}),
						...(excerpt.trim() ? { excerpt: excerpt.trim() } : {}),
						...(externalId.trim() ? { externalId: externalId.trim() } : {}),
						...(externalRecordType.trim()
							? { externalRecordType: externalRecordType.trim() }
							: {}),
						...(provider.trim() ? { provider: provider.trim() } : {}),
					},
				})
			);
		},
		[
			accessedAt,
			attemptOnlineWork,
			capturedContent,
			create,
			excerpt,
			externalId,
			externalRecordType,
			markUnsaved,
			projectId,
			provider,
			title,
			url,
		]
	);
	const onTitleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setTitle(event.target.value);
	}, []);
	const onUrlChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setUrl(event.target.value);
	}, []);
	const onAccessedAtChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			setAccessedAt(event.target.value);
		},
		[]
	);
	const onCapturedChange = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			setCapturedContent(event.target.value);
		},
		[]
	);
	const onExcerptChange = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			setExcerpt(event.target.value);
		},
		[]
	);
	const onProviderChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			setProvider(event.target.value);
		},
		[]
	);
	const onExternalTypeChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			setExternalRecordType(event.target.value);
		},
		[]
	);
	const onExternalIdChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			setExternalId(event.target.value);
		},
		[]
	);

	return (
		<form className="flex flex-col gap-3" onSubmit={onSubmit}>
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor="source-title">{SOURCES_COPY.title}</FieldLabel>
					<Input
						id="source-title"
						onChange={onTitleChange}
						required
						value={title}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="source-address">
						{SOURCES_COPY.address}
					</FieldLabel>
					<Input
						id="source-address"
						onChange={onUrlChange}
						required
						type="url"
						value={url}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="source-accessed-at">
						{SOURCES_COPY.accessedAt}
					</FieldLabel>
					<Input
						id="source-accessed-at"
						onChange={onAccessedAtChange}
						type="datetime-local"
						value={accessedAt}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="source-captured">
						{SOURCES_COPY.capturedContent}
					</FieldLabel>
					<Textarea
						id="source-captured"
						onChange={onCapturedChange}
						value={capturedContent}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="source-excerpt">
						{SOURCES_COPY.excerpt}
					</FieldLabel>
					<Textarea
						id="source-excerpt"
						onChange={onExcerptChange}
						value={excerpt}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="source-provider">
						{SOURCES_COPY.provider}
					</FieldLabel>
					<Input
						id="source-provider"
						onChange={onProviderChange}
						value={provider}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="source-external-type">
						{SOURCES_COPY.externalRecordType}
					</FieldLabel>
					<Input
						id="source-external-type"
						onChange={onExternalTypeChange}
						value={externalRecordType}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="source-external-id">
						{SOURCES_COPY.externalId}
					</FieldLabel>
					<Input
						id="source-external-id"
						onChange={onExternalIdChange}
						value={externalId}
					/>
				</Field>
			</FieldGroup>
			{error ? <p role="alert">{error}</p> : null}
			<Button type="submit">{SOURCES_COPY.createSource}</Button>
		</form>
	);
}
