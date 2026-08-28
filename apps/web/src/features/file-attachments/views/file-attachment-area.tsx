import { env } from "@cantiara/env/web";
import { Button } from "@cantiara/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { PROJECT_SHELL_COPY } from "@/features/project-shell/forms/project-shell-copy";
import { orpc } from "@/utils/orpc";

import {
	FILE_ATTACHMENT_COPY,
	fileScopeFor,
} from "../forms/file-attachments-copy";
import UploadFileForm from "../forms/upload-file-form";
import FilePreview, { GalleryThumb } from "./file-preview";
import {
	absoluteProductPath,
	galleryThumbnailPathFromFile,
	previewFromVersion,
} from "./file-preview-presentation";

const TRAILING_SLASH = /\/$/;

function serverOrigin(): string {
	const url = env.VITE_SERVER_URL;
	if (url.startsWith("http")) {
		return url.replace(TRAILING_SLASH, "");
	}
	if (typeof window !== "undefined") {
		return window.location.origin;
	}
	return "http://localhost:3000";
}

export default function FileAttachmentArea({
	projectId,
}: {
	projectId: string | null;
}) {
	const scope = fileScopeFor(projectId);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const files = useQuery(
		orpc.fileAttachments.list.queryOptions({ input: { scope } })
	);
	const selectedFile = useQuery({
		...orpc.fileAttachments.get.queryOptions({
			input: { fileAttachmentId: selectedId ?? "" },
		}),
		enabled: Boolean(selectedId),
	});
	const quota = useQuery(orpc.fileAttachments.quota.queryOptions());
	const onCreated = useCallback((fileId: string) => {
		setSelectedId(fileId);
	}, []);
	const onSelect = useCallback((id: string) => {
		setSelectedId(id);
	}, []);

	if (files.isPending || quota.isPending) {
		return <p>{PROJECT_SHELL_COPY.loading}</p>;
	}
	if (files.isError || quota.isError) {
		return <p role="alert">{PROJECT_SHELL_COPY.unavailable}</p>;
	}

	const selected = selectedFile.data ?? null;

	return (
		<div className="flex flex-col gap-6">
			<h2 className="font-semibold text-lg">
				{FILE_ATTACHMENT_COPY.fileAttachment}
			</h2>
			{quota.data.warning ? <p role="status">{quota.data.warning}</p> : null}
			<UploadFileForm onCreated={onCreated} projectId={projectId} />
			<ul className="flex flex-col gap-2">
				{files.data.map((item) => (
					<li key={item.id}>
						<FileRow
							contentPath={
								absoluteProductPath(serverOrigin(), item.contentPath) ??
								item.contentPath
							}
							galleryThumbnailPath={absoluteProductPath(
								serverOrigin(),
								galleryThumbnailPathFromFile(item)
							)}
							id={item.id}
							onSelect={onSelect}
							selected={item.id === selectedId}
							title={item.title}
						/>
					</li>
				))}
			</ul>
			{selected ? (
				<section aria-label={selected.title} className="flex flex-col gap-3">
					<SelectedFilePreview origin={serverOrigin()} selected={selected} />
					<ul className="flex flex-col gap-1">
						{selected.versions.map((version) => (
							<li key={version.id}>
								<a
									href={`${serverOrigin()}${version.contentPath}`}
									rel="noreferrer"
								>
									{FILE_ATTACHMENT_COPY.download} {version.filename}
								</a>
							</li>
						))}
					</ul>
					<UploadFileForm
						onCreated={onCreated}
						projectId={projectId}
						targetFileAttachmentId={selected.id}
					/>
				</section>
			) : null}
		</div>
	);
}

function SelectedFilePreview({
	origin,
	selected,
}: {
	origin: string;
	selected: {
		contentPath: string;
		currentVersion: Parameters<typeof previewFromVersion>[0];
		kind: string;
		title: string;
	};
}) {
	const preview = previewFromVersion(
		selected.currentVersion,
		selected.contentPath
	);
	return (
		<FilePreview
			contentPath={
				absoluteProductPath(origin, selected.contentPath) ??
				selected.contentPath
			}
			kind={selected.kind}
			preview={{
				...preview,
				galleryThumbnailPath: absoluteProductPath(
					origin,
					preview.galleryThumbnailPath
				),
				previewPath: absoluteProductPath(origin, preview.previewPath),
			}}
			title={selected.title}
		/>
	);
}

function FileRow({
	contentPath,
	galleryThumbnailPath,
	id,
	onSelect,
	selected,
	title,
}: {
	contentPath: string;
	galleryThumbnailPath: string | null;
	id: string;
	onSelect: (id: string) => void;
	selected: boolean;
	title: string;
}) {
	const onClick = useCallback(() => {
		onSelect(id);
	}, [id, onSelect]);
	return (
		<Button
			aria-current={selected ? "true" : undefined}
			onClick={onClick}
			type="button"
			variant={selected ? "secondary" : "ghost"}
		>
			<GalleryThumb
				contentPath={contentPath}
				galleryThumbnailPath={galleryThumbnailPath}
			/>
			{title}
		</Button>
	);
}
