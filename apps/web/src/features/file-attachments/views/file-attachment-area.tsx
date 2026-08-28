import { env } from "@cantiara/env/web";
import { Alert, AlertDescription } from "@cantiara/ui/components/alert";
import {
	Attachment,
	AttachmentContent,
	AttachmentDescription,
	AttachmentMedia,
	AttachmentTitle,
	AttachmentTrigger,
} from "@cantiara/ui/components/attachment";
import { buttonVariants } from "@cantiara/ui/components/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@cantiara/ui/components/card";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@cantiara/ui/components/empty";
import { Spinner } from "@cantiara/ui/components/spinner";
import { cn } from "@cantiara/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import {
	File,
	FileArchive,
	FileAudio,
	FileImage,
	FileSpreadsheet,
	FileText,
	FileVideo,
} from "lucide-react";
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
	fileKindLabel,
	galleryThumbnailPathFromFile,
	galleryThumbnailSrc,
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
		return (
			<p className="flex items-center gap-2 text-muted-foreground text-sm">
				<Spinner />
				{PROJECT_SHELL_COPY.loading}
			</p>
		);
	}
	if (files.isError || quota.isError) {
		return <p role="alert">{PROJECT_SHELL_COPY.unavailable}</p>;
	}

	const selected = selectedFile.data ?? null;
	const origin = serverOrigin();

	return (
		<div className="flex flex-col gap-6">
			{quota.data.warning ? (
				<Alert>
					<AlertDescription>{quota.data.warning}</AlertDescription>
				</Alert>
			) : null}
			<UploadFileForm onCreated={onCreated} projectId={projectId} />
			<div className="grid gap-6 lg:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)]">
				<ul className="flex flex-col gap-2">
					{files.data.map((item) => (
						<li key={item.id}>
							<FileRow
								contentPath={
									absoluteProductPath(origin, item.contentPath) ??
									item.contentPath
								}
								galleryThumbnailPath={absoluteProductPath(
									origin,
									galleryThumbnailPathFromFile(item)
								)}
								id={item.id}
								kind={item.kind}
								onSelect={onSelect}
								selected={item.id === selectedId}
								title={item.title}
							/>
						</li>
					))}
				</ul>
				<FileAttachmentPane
					isPending={selectedFile.isPending}
					onCreated={onCreated}
					origin={origin}
					projectId={projectId}
					selected={selected}
					selectedId={selectedId}
				/>
			</div>
		</div>
	);
}

function SelectedFileCard({
	onCreated,
	origin,
	projectId,
	selected,
}: {
	onCreated: (fileId: string) => void;
	origin: string;
	projectId: string | null;
	selected: {
		contentPath: string;
		currentVersion: Parameters<typeof previewFromVersion>[0] & {
			filename?: string;
			id: string;
		};
		id: string;
		kind: string;
		scope: { kind: string; projectId?: string };
		title: string;
		versions: Array<{
			contentPath: string;
			filename: string;
			id: string;
			versionNumber: number;
		}>;
	};
}) {
	const preview = previewFromVersion(
		selected.currentVersion,
		selected.contentPath
	);
	const downloadHref =
		absoluteProductPath(origin, selected.contentPath) ?? selected.contentPath;
	return (
		<Card className="min-w-0">
			<CardHeader className="border-b">
				<CardTitle>{selected.title}</CardTitle>
				<CardDescription>
					{fileKindLabel(selected.kind)}
					{selected.currentVersion.filename
						? ` · ${selected.currentVersion.filename}`
						: ""}
				</CardDescription>
				<CardAction>
					<a
						className={buttonVariants({ size: "sm", variant: "outline" })}
						href={downloadHref}
						rel="noreferrer"
					>
						{FILE_ATTACHMENT_COPY.download}
					</a>
				</CardAction>
			</CardHeader>
			<CardContent>
				<div className="overflow-hidden bg-muted/20 p-3">
					<FilePreview
						contentPath={downloadHref}
						kind={selected.kind}
						marking={
							selected.kind === "image" || selected.kind === "pdf"
								? {
										projectId,
										scope: selected.scope,
										versionId: selected.currentVersion.id,
									}
								: undefined
						}
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
				</div>
			</CardContent>
			<CardFooter className="flex-col items-stretch gap-4">
				<div className="flex flex-col gap-2">
					<p className="font-medium text-xs">{FILE_ATTACHMENT_COPY.versions}</p>
					<ul className="flex flex-col gap-1">
						{selected.versions.map((version) => (
							<li key={version.id}>
								<a
									className="text-muted-foreground text-xs underline-offset-4 hover:text-foreground hover:underline"
									href={`${origin}${version.contentPath}`}
									rel="noreferrer"
								>
									{FILE_ATTACHMENT_COPY.download} {version.filename}
								</a>
							</li>
						))}
					</ul>
				</div>
				<div className="flex flex-col gap-2">
					<p className="font-medium text-xs">
						{FILE_ATTACHMENT_COPY.uploadNewVersion}
					</p>
					<UploadFileForm
						onCreated={onCreated}
						projectId={projectId}
						targetFileAttachmentId={selected.id}
					/>
				</div>
			</CardFooter>
		</Card>
	);
}

function FileAttachmentPane({
	isPending,
	onCreated,
	origin,
	projectId,
	selected,
	selectedId,
}: {
	isPending: boolean;
	onCreated: (fileId: string) => void;
	origin: string;
	projectId: string | null;
	selected: Parameters<typeof SelectedFileCard>[0]["selected"] | null;
	selectedId: string | null;
}) {
	if (selectedId && isPending) {
		return (
			<p className="flex items-center gap-2 text-muted-foreground text-sm">
				<Spinner />
				{PROJECT_SHELL_COPY.loading}
			</p>
		);
	}
	if (selected) {
		return (
			<SelectedFileCard
				onCreated={onCreated}
				origin={origin}
				projectId={projectId}
				selected={selected}
			/>
		);
	}
	return (
		<Empty className="min-h-64 border">
			<EmptyHeader>
				<EmptyTitle>{FILE_ATTACHMENT_COPY.selectFileAttachment}</EmptyTitle>
				<EmptyDescription>
					{FILE_ATTACHMENT_COPY.fileAttachment}
				</EmptyDescription>
			</EmptyHeader>
		</Empty>
	);
}

function FileRow({
	contentPath,
	galleryThumbnailPath,
	id,
	kind,
	onSelect,
	selected,
	title,
}: {
	contentPath: string;
	galleryThumbnailPath: string | null;
	id: string;
	kind: string;
	onSelect: (id: string) => void;
	selected: boolean;
	title: string;
}) {
	const onClick = useCallback(() => {
		onSelect(id);
	}, [id, onSelect]);
	const hasThumb = Boolean(
		galleryThumbnailSrc({ contentPath, galleryThumbnailPath })
	);
	return (
		<Attachment
			className={cn("w-full max-w-full", selected && "bg-muted")}
			state="done"
		>
			<AttachmentTrigger
				aria-current={selected ? "true" : undefined}
				onClick={onClick}
			/>
			<AttachmentMedia variant={hasThumb ? "image" : "icon"}>
				{hasThumb ? (
					<GalleryThumb
						contentPath={contentPath}
						galleryThumbnailPath={galleryThumbnailPath}
					/>
				) : (
					<FileKindGlyph kind={kind} />
				)}
			</AttachmentMedia>
			<AttachmentContent>
				<AttachmentTitle>{title}</AttachmentTitle>
				<AttachmentDescription>{fileKindLabel(kind)}</AttachmentDescription>
			</AttachmentContent>
		</Attachment>
	);
}

function FileKindGlyph({ kind }: { kind: string }) {
	if (kind === "image") {
		return <FileImage />;
	}
	if (kind === "pdf" || kind === "text") {
		return <FileText />;
	}
	if (kind === "csv") {
		return <FileSpreadsheet />;
	}
	if (kind === "audio") {
		return <FileAudio />;
	}
	if (kind === "video") {
		return <FileVideo />;
	}
	if (kind === "zip") {
		return <FileArchive />;
	}
	return <File />;
}
