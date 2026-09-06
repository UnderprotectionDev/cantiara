import { Button } from "@cantiara/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useState } from "react";

import { fileScopeFor } from "@/features/file-attachments/forms/file-attachments-copy";
import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import { MOODBOARDS_COPY } from "./moodboards-copy";

export default function AddMoodboardVisualForm({
	moodboardId,
	projectId,
}: {
	moodboardId: string;
	projectId: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [caption, setCaption] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [externalUrl, setExternalUrl] = useState("");
	const [fileAttachmentVersionId, setFileAttachmentVersionId] = useState("");
	const [originKind, setOriginKind] = useState<
		typeof MOODBOARDS_COPY.fileAttachment | typeof MOODBOARDS_COPY.externalLink
	>(MOODBOARDS_COPY.fileAttachment);
	const files = useQuery(
		orpc.fileAttachments.list.queryOptions({
			input: { scope: fileScopeFor(projectId) },
		})
	);
	const addVisual = useMutation(
		orpc.moodboards.addVisual.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await queryClient.invalidateQueries({
						queryKey: orpc.moodboards.get.queryKey({
							input: { moodboardId },
						}),
					});
					await queryClient.invalidateQueries({
						queryKey: orpc.moodboards.list.queryKey({
							input: { projectId },
						}),
					});
					recordSave();
					setCaption("");
					setError(null);
					setExternalUrl("");
					setFileAttachmentVersionId("");
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
			const origin =
				originKind === MOODBOARDS_COPY.fileAttachment
					? {
							fileAttachmentVersionId,
							kind: MOODBOARDS_COPY.fileAttachment,
						}
					: {
							kind: MOODBOARDS_COPY.externalLink,
							url: externalUrl,
						};
			attemptOnlineWork("record-create", () =>
				addVisual.mutateAsync({
					idempotencyKey: newIdempotencyKey(),
					payload: {
						caption: caption.length > 0 ? caption : undefined,
						moodboardId,
						origin,
					},
				})
			);
		},
		[
			addVisual,
			attemptOnlineWork,
			caption,
			externalUrl,
			fileAttachmentVersionId,
			markUnsaved,
			moodboardId,
			originKind,
		]
	);
	const onOriginKindChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			if (
				event.target.value === MOODBOARDS_COPY.fileAttachment ||
				event.target.value === MOODBOARDS_COPY.externalLink
			) {
				setOriginKind(event.target.value);
			}
		},
		[]
	);
	const onVersionChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			setFileAttachmentVersionId(event.target.value);
		},
		[]
	);
	const onUrlChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setExternalUrl(event.target.value);
	}, []);
	const onCaptionChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			setCaption(event.target.value);
		},
		[]
	);

	return (
		<form className="flex flex-col gap-3" onSubmit={onSubmit}>
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor="moodboard-origin-kind">{originKind}</FieldLabel>
					<select
						id="moodboard-origin-kind"
						onChange={onOriginKindChange}
						value={originKind}
					>
						<option value={MOODBOARDS_COPY.fileAttachment}>
							{MOODBOARDS_COPY.fileAttachment}
						</option>
						<option value={MOODBOARDS_COPY.externalLink}>
							{MOODBOARDS_COPY.externalLink}
						</option>
					</select>
				</Field>
				{originKind === MOODBOARDS_COPY.fileAttachment ? (
					<Field>
						<FieldLabel htmlFor="moodboard-file-version">
							{MOODBOARDS_COPY.fileAttachment}
						</FieldLabel>
						<select
							id="moodboard-file-version"
							onChange={onVersionChange}
							required
							value={fileAttachmentVersionId}
						>
							<option value="">{MOODBOARDS_COPY.fileAttachment}</option>
							{(files.data ?? []).map((file) => (
								<option
									key={file.currentVersion.id}
									value={file.currentVersion.id}
								>
									{file.title}
								</option>
							))}
						</select>
					</Field>
				) : (
					<Field>
						<FieldLabel htmlFor="moodboard-external-link">
							{MOODBOARDS_COPY.externalLink}
						</FieldLabel>
						<Input
							id="moodboard-external-link"
							onChange={onUrlChange}
							required
							type="url"
							value={externalUrl}
						/>
					</Field>
				)}
				<Field>
					<FieldLabel htmlFor="moodboard-caption">
						{MOODBOARDS_COPY.caption}
					</FieldLabel>
					<Input
						id="moodboard-caption"
						maxLength={280}
						onChange={onCaptionChange}
						value={caption}
					/>
				</Field>
			</FieldGroup>
			{error ? <p role="alert">{error}</p> : null}
			<Button type="submit">{MOODBOARDS_COPY.addVisual}</Button>
		</form>
	);
}
