import { Button } from "@cantiara/ui/components/button";
import { Empty, EmptyHeader, EmptyTitle } from "@cantiara/ui/components/empty";
import { MediaPlayer, MediaProvider } from "@vidstack/react";
import {
	DefaultAudioLayout,
	DefaultVideoLayout,
	defaultLayoutIcons,
} from "@vidstack/react/player/layouts/default";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

import { FILE_ATTACHMENT_COPY } from "../forms/file-attachments-copy";
import FileMarkingOverlay from "./file-marking-overlay";
import { fetchProductMedia } from "./file-preview-media";
import {
	filePreviewKind,
	galleryThumbnailSrc,
} from "./file-preview-presentation";

import "@vidstack/react/player/styles/default/theme.css";
import "@vidstack/react/player/styles/default/layouts/audio.css";
import "@vidstack/react/player/styles/default/layouts/video.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
	"pdfjs-dist/build/pdf.worker.min.mjs",
	import.meta.url
).toString();

interface Preview {
	cause: string | null;
	csvRows: string[][] | null;
	galleryThumbnailPath: string | null;
	mode: string;
	playback: {
		autoplay: false;
		fullscreen: boolean;
		loopOptional: boolean;
		speed: boolean;
	} | null;
	previewPath: string | null;
	retryLimit: number;
	status: string;
	supportReference: string | null;
	textExcerpt: string | null;
	unpack: boolean;
	written: boolean;
}

export default function FilePreview({
	contentPath,
	kind,
	marking,
	preview,
	title,
}: {
	contentPath: string;
	kind: string;
	marking?: {
		projectId: string | null;
		scope: { kind: string; projectId?: string };
		versionId: string;
	};
	preview: Preview;
	title: string;
}) {
	const surface = filePreviewKind({
		kind,
		status: preview.status,
		unpack: preview.unpack,
	});
	if (surface === "unavailable") {
		return (
			<Empty role="status">
				<EmptyHeader>
					<EmptyTitle>{FILE_ATTACHMENT_COPY.unavailable}</EmptyTitle>
					{preview.supportReference ? (
						<p className="text-muted-foreground text-xs">
							{preview.supportReference}
							{preview.cause ? ` ${preview.cause}` : ""}
						</p>
					) : null}
				</EmptyHeader>
			</Empty>
		);
	}
	if (surface === "download") {
		return (
			<p>
				<a href={contentPath} rel="noreferrer">
					{FILE_ATTACHMENT_COPY.download} {title}
				</a>
			</p>
		);
	}
	if (surface === "visual" && preview.previewPath) {
		return withMarking(
			<ProductMedia
				alt={title}
				className="mx-auto max-h-[28rem] w-full object-contain"
				height={384}
				href={preview.previewPath}
				width={640}
			/>,
			kind,
			marking
		);
	}
	if (surface === "paged" && preview.previewPath) {
		return (
			<PdfPreview
				kind={kind}
				marking={marking}
				src={preview.previewPath}
				title={title}
			/>
		);
	}
	if (surface === "csv" && preview.csvRows) {
		return (
			<table className="w-full text-left text-sm">
				<tbody>
					{preview.csvRows.map((row) => (
						<tr key={row.join("\u001f")}>
							{row.map((cell) => (
								<td
									className="border px-2 py-1"
									key={`${row.join("\u001f")}-${cell}`}
								>
									{cell}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		);
	}
	if (surface === "text" && preview.textExcerpt !== null) {
		return (
			<pre className="max-h-96 overflow-auto whitespace-pre-wrap text-sm">
				{preview.textExcerpt}
			</pre>
		);
	}
	if (surface === "playback" && preview.previewPath) {
		return (
			<PlaybackPreview href={preview.previewPath} kind={kind} title={title} />
		);
	}
	return (
		<p className="text-muted-foreground text-xs" role="status">
			{FILE_ATTACHMENT_COPY.unavailable}
		</p>
	);
}

function withMarking(
	child: ReactNode,
	fileKind: string,
	marking:
		| {
				projectId: string | null;
				scope: { kind: string; projectId?: string };
				versionId: string;
		  }
		| undefined,
	page?: number
) {
	if (!marking) {
		return child;
	}
	return (
		<FileMarkingOverlay
			fileKind={fileKind}
			page={page}
			projectId={marking.projectId}
			scope={marking.scope}
			versionId={marking.versionId}
		>
			{child}
		</FileMarkingOverlay>
	);
}

export function GalleryThumb({
	contentPath,
	galleryThumbnailPath,
}: {
	contentPath: string;
	galleryThumbnailPath: string | null;
}) {
	const src = galleryThumbnailSrc({ contentPath, galleryThumbnailPath });
	if (!src) {
		return null;
	}
	return (
		<ProductMedia
			alt=""
			className="size-full object-cover"
			height={48}
			href={src}
			width={48}
		/>
	);
}

function useProductObjectUrl(href: string | null) {
	const [objectUrl, setObjectUrl] = useState<string | null>(null);
	const createdRef = useRef<string | null>(null);
	useEffect(() => {
		if (!href) {
			setObjectUrl(null);
			return;
		}
		let cancelled = false;
		const load = async () => {
			try {
				const blob = await fetchProductMedia(href);
				if (cancelled) {
					return;
				}
				createdRef.current = URL.createObjectURL(blob);
				setObjectUrl(createdRef.current);
			} catch {
				if (!cancelled) {
					setObjectUrl(null);
				}
			}
		};
		load();
		return () => {
			cancelled = true;
			if (createdRef.current) {
				URL.revokeObjectURL(createdRef.current);
				createdRef.current = null;
			}
			setObjectUrl(null);
		};
	}, [href]);
	return objectUrl;
}

function ProductMedia({
	alt,
	className,
	height,
	href,
	width,
}: {
	alt: string;
	className: string;
	height: number;
	href: string;
	width: number;
}) {
	const objectUrl = useProductObjectUrl(href);
	return (
		<img
			alt={alt}
			className={className}
			height={height}
			src={objectUrl ?? href}
			width={width}
		/>
	);
}

function PlaybackPreview({
	href,
	kind,
	title,
}: {
	href: string;
	kind: string;
	title: string;
}) {
	const objectUrl = useProductObjectUrl(href);
	return (
		<MediaPlayer
			autoPlay={false}
			className="w-full"
			loop={false}
			src={objectUrl ?? href}
			title={title}
		>
			<MediaProvider />
			{kind === "audio" ? (
				<DefaultAudioLayout icons={defaultLayoutIcons} />
			) : (
				<DefaultVideoLayout icons={defaultLayoutIcons} />
			)}
		</MediaPlayer>
	);
}

function PdfPreview({
	kind,
	marking,
	src,
	title,
}: {
	kind: string;
	marking?: {
		projectId: string | null;
		scope: { kind: string; projectId?: string };
		versionId: string;
	};
	src: string;
	title: string;
}) {
	const [page, setPage] = useState(1);
	const [pages, setPages] = useState(1);
	const onLoad = useCallback(({ numPages }: { numPages: number }) => {
		setPages(numPages);
	}, []);
	const previous = useCallback(() => {
		setPage((current) => Math.max(1, current - 1));
	}, []);
	const next = useCallback(() => {
		setPage((current) => Math.min(pages, current + 1));
	}, [pages]);
	const objectUrl = useProductObjectUrl(src);
	const pageView = (
		<Document file={objectUrl ?? src} onLoadSuccess={onLoad}>
			<Page pageNumber={page} width={480} />
		</Document>
	);
	return (
		<div className="flex flex-col gap-2">
			{withMarking(pageView, kind, marking, page)}
			<div className="flex gap-2">
				<Button onClick={previous} type="button" variant="ghost">
					{FILE_ATTACHMENT_COPY.previous}
				</Button>
				<p>
					{page} / {pages} {title}
				</p>
				<Button onClick={next} type="button" variant="ghost">
					{FILE_ATTACHMENT_COPY.next}
				</Button>
			</div>
		</div>
	);
}
