import { Button } from "@cantiara/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@cantiara/ui/components/card";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import { useCallback, useState } from "react";

import { SOURCES_COPY } from "@/features/sources-and-freshness/forms/sources-copy";

import { youtubePlayerFrameSrc } from "./smart-link-preview-presentation";

export interface SmartLinkPreviewView {
	capturedContent: string;
	description: string | null;
	domain: string;
	imageDataUrl: string | null;
	kind: "rich" | "youtube";
	originalUrl: string;
	player: {
		autoplay: boolean;
		available: boolean;
		clickToLoad: boolean;
		embedUrl: string | null;
		error: string | null;
		provider: string;
		videoId: string;
	} | null;
	title: string;
}

export default function SmartLinkPreviewCard({
	onSaveAsSource,
	preview,
}: {
	onSaveAsSource?: () => void;
	preview: SmartLinkPreviewView;
}) {
	const [loaded, setLoaded] = useState(false);
	const [showAddress, setShowAddress] = useState(true);
	const [showDescription, setShowDescription] = useState(true);
	const [showImage, setShowImage] = useState(true);
	const frameSrc = youtubePlayerFrameSrc({
		loaded,
		player: preview.player,
	});
	const onLoadPlayer = useCallback(() => {
		setLoaded(true);
	}, []);
	const onToggleImage = useCallback((checked: boolean | "indeterminate") => {
		setShowImage(checked === true);
	}, []);
	const onToggleAddress = useCallback((checked: boolean | "indeterminate") => {
		setShowAddress(checked === true);
	}, []);
	const onToggleDescription = useCallback(
		(checked: boolean | "indeterminate") => {
			setShowDescription(checked === true);
		},
		[]
	);

	return (
		<Card>
			<CardHeader>
				{preview.kind === "youtube" ? (
					<CardDescription>{SOURCES_COPY.liveExternalSource}</CardDescription>
				) : (
					<CardDescription>{SOURCES_COPY.livePreview}</CardDescription>
				)}
				<CardTitle>{preview.title}</CardTitle>
				<p className="text-muted-foreground text-xs">{preview.domain}</p>
			</CardHeader>
			<CardContent className="flex flex-col gap-3">
				{showImage && preview.imageDataUrl ? (
					<img
						alt=""
						className="max-h-40 w-full object-cover"
						height={160}
						src={preview.imageDataUrl}
						width={640}
					/>
				) : null}
				{showAddress ? (
					<p className="break-all text-sm">{preview.originalUrl}</p>
				) : null}
				{showDescription && preview.description ? (
					<p className="text-sm">{preview.description}</p>
				) : null}
				{preview.kind === "youtube" ? (
					<YouTubePreview
						frameSrc={frameSrc}
						onLoadPlayer={onLoadPlayer}
						player={preview.player}
					/>
				) : null}
				<div className="flex flex-wrap gap-4">
					<Field className="flex flex-row items-center gap-2">
						<Checkbox
							checked={showImage}
							id="smart-link-show-image"
							onCheckedChange={onToggleImage}
						/>
						<FieldLabel htmlFor="smart-link-show-image">
							{SOURCES_COPY.showImage}
						</FieldLabel>
					</Field>
					<Field className="flex flex-row items-center gap-2">
						<Checkbox
							checked={showAddress}
							id="smart-link-show-address"
							onCheckedChange={onToggleAddress}
						/>
						<FieldLabel htmlFor="smart-link-show-address">
							{SOURCES_COPY.showAddress}
						</FieldLabel>
					</Field>
					<Field className="flex flex-row items-center gap-2">
						<Checkbox
							checked={showDescription}
							id="smart-link-show-description"
							onCheckedChange={onToggleDescription}
						/>
						<FieldLabel htmlFor="smart-link-show-description">
							{SOURCES_COPY.showDescription}
						</FieldLabel>
					</Field>
				</div>
			</CardContent>
			{onSaveAsSource ? (
				<CardFooter>
					<Button onClick={onSaveAsSource} type="button">
						{SOURCES_COPY.saveAsSource}
					</Button>
				</CardFooter>
			) : null}
		</Card>
	);
}

function YouTubePreview({
	frameSrc,
	onLoadPlayer,
	player,
}: {
	frameSrc: string | null;
	onLoadPlayer: () => void;
	player: SmartLinkPreviewView["player"];
}) {
	if (!player) {
		return null;
	}
	if (!player.available) {
		return (
			<div className="flex flex-col gap-1">
				<p role="alert">{player.error ?? SOURCES_COPY.youtubeUnavailable}</p>
				<p className="break-all text-sm">{SOURCES_COPY.address}</p>
			</div>
		);
	}
	if (frameSrc) {
		return (
			<iframe
				allow="encrypted-media; picture-in-picture"
				className="aspect-video w-full"
				src={frameSrc}
				title={SOURCES_COPY.liveExternalSource}
			/>
		);
	}
	return (
		<div className="flex flex-col gap-2">
			<p className="text-sm">{SOURCES_COPY.thirdPartyWarning}</p>
			<Button onClick={onLoadPlayer} type="button">
				{SOURCES_COPY.loadPlayer}
			</Button>
		</div>
	);
}
