import { Button } from "@cantiara/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import { useQuery } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useState } from "react";

import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { client, orpc, queryClient } from "@/utils/orpc";

import {
	FILE_ATTACHMENT_COPY,
	fileScopeFor,
	fileToBase64,
} from "./file-attachments-copy";

export default function UploadFileForm({
	onCreated,
	projectId,
	targetFileAttachmentId,
}: {
	onCreated?: (fileId: string) => void;
	projectId: string | null;
	targetFileAttachmentId?: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [error, setError] = useState<string | null>(null);
	const [status, setStatus] = useState<string | null>(null);
	const [file, setFile] = useState<File | null>(null);
	const [operationId, setOperationId] = useState<string | null>(null);
	const inputId = targetFileAttachmentId
		? "file-attachment-version"
		: "file-attachment-bytes";
	const preview = useQuery({
		...orpc.fileAttachments.previewNewVersion.queryOptions({
			input: {
				declaredMime: file?.type || "application/octet-stream",
				fileAttachmentId: targetFileAttachmentId ?? "",
				filename: file?.name ?? "",
			},
		}),
		enabled: Boolean(targetFileAttachmentId && file),
	});
	const invalidate = useCallback(async () => {
		await queryClient.invalidateQueries({
			queryKey: orpc.fileAttachments.list.queryKey({
				input: { scope: fileScopeFor(projectId) },
			}),
		});
		await queryClient.invalidateQueries({
			queryKey: orpc.fileAttachments.quota.queryKey(),
		});
	}, [projectId]);
	const onFile = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setFile(event.target.files?.[0] ?? null);
		setError(null);
	}, []);
	const onCancelled = useCallback(() => {
		setOperationId(null);
		setStatus(null);
	}, []);
	const onSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			if (!file) {
				return;
			}
			markUnsaved();
			const result = attemptOnlineWork("record-create", async () => {
				const idempotencyKey = newIdempotencyKey();
				const payload = {
					declaredMime: file.type || "application/octet-stream",
					filename: file.name,
					scope: fileScopeFor(projectId),
					targetFileAttachmentId,
				};
				setStatus(FILE_ATTACHMENT_COPY.upload);
				const staged = await client.fileAttachments.stage({
					idempotencyKey,
					payload,
				});
				if (staged.status !== "staged") {
					return staged;
				}
				setOperationId(staged.operation.operationId);
				const put = await client.fileAttachments.putBytes({
					bytesBase64: await fileToBase64(file),
					operationId: staged.operation.operationId,
				});
				if (put.status !== "staged") {
					return put;
				}
				setStatus(FILE_ATTACHMENT_COPY.finalizing);
				setOperationId(null);
				return await client.fileAttachments.finalize({
					idempotencyKey,
					payload,
				});
			});
			if (result.status === "refused") {
				return;
			}
			result.value
				.then(async (outcome) => {
					if (outcome.status === "committed" || outcome.status === "replayed") {
						await invalidate();
						onCreated?.(outcome.file.id);
						recordSave();
						setError(null);
						setStatus(null);
						setFile(null);
						setOperationId(null);
						return;
					}
					if (outcome.status === "rejected") {
						setError(
							"reason" in outcome
								? String(outcome.reason)
								: FILE_ATTACHMENT_COPY.restartFromByteZero
						);
					}
					if (outcome.status === "conflict") {
						setError(FILE_ATTACHMENT_COPY.conflict);
					}
					setStatus(null);
					setOperationId(null);
				})
				.catch(() => {
					setError(FILE_ATTACHMENT_COPY.restartFromByteZero);
					setStatus(null);
					setOperationId(null);
				});
		},
		[
			attemptOnlineWork,
			file,
			invalidate,
			markUnsaved,
			onCreated,
			projectId,
			recordSave,
			targetFileAttachmentId,
		]
	);

	return (
		<form className="flex flex-col gap-3" onSubmit={onSubmit}>
			<FieldGroup className="flex-row flex-wrap items-end gap-3">
				<Field className="min-w-48 flex-1">
					<FieldLabel htmlFor={inputId}>
						{targetFileAttachmentId
							? FILE_ATTACHMENT_COPY.uploadNewVersion
							: FILE_ATTACHMENT_COPY.fileAttachment}
					</FieldLabel>
					<Input id={inputId} onChange={onFile} type="file" />
				</Field>
				<Button
					disabled={!file || status === FILE_ATTACHMENT_COPY.finalizing}
					type="submit"
				>
					{targetFileAttachmentId
						? FILE_ATTACHMENT_COPY.uploadNewVersion
						: FILE_ATTACHMENT_COPY.upload}
				</Button>
				{operationId && status !== FILE_ATTACHMENT_COPY.finalizing ? (
					<CancelUploadButton
						onCancelled={onCancelled}
						operationId={operationId}
					/>
				) : null}
			</FieldGroup>
			{preview.data ? (
				<div className="text-muted-foreground text-sm">
					<p>
						{FILE_ATTACHMENT_COPY.targetAttachment} {preview.data.target.title}
					</p>
					<p>
						{FILE_ATTACHMENT_COPY.currentVersion}{" "}
						{preview.data.currentVersion.filename}
					</p>
					<p>
						{FILE_ATTACHMENT_COPY.incomingFile} {preview.data.incoming.filename}
					</p>
				</div>
			) : null}
			{status ? <p>{status}</p> : null}
			{error ? <p role="alert">{error}</p> : null}
		</form>
	);
}

function CancelUploadButton({
	onCancelled,
	operationId,
}: {
	onCancelled: () => void;
	operationId: string;
}) {
	const onClick = useCallback(() => {
		client.fileAttachments
			.cancel({ operationId })
			.then(onCancelled)
			.catch(() => undefined);
	}, [onCancelled, operationId]);
	return (
		<Button onClick={onClick} type="button" variant="ghost">
			{FILE_ATTACHMENT_COPY.cancel}
		</Button>
	);
}
