import { Empty, EmptyHeader, EmptyTitle } from "@cantiara/ui/components/empty";
import { Spinner } from "@cantiara/ui/components/spinner";
import { useQuery } from "@tanstack/react-query";
import AddColorSwatchForm from "@/features/moodboards/forms/add-color-swatch-form";
import AddMoodboardVisualForm from "@/features/moodboards/forms/add-moodboard-visual-form";
import AddPaletteGroupForm from "@/features/moodboards/forms/add-palette-group-form";
import MoodboardCaptionForm from "@/features/moodboards/forms/moodboard-caption-form";
import { MOODBOARDS_COPY } from "@/features/moodboards/forms/moodboards-copy";
import { PROJECT_SHELL_COPY } from "@/features/project-shell/forms/project-shell-copy";
import { orpc } from "@/utils/orpc";

export default function MoodboardDetail({
	moodboardId,
	projectId,
}: {
	moodboardId: string;
	projectId: string;
}) {
	const moodboard = useQuery(
		orpc.moodboards.get.queryOptions({
			input: { moodboardId },
		})
	);

	if (moodboard.isPending) {
		return (
			<p className="flex items-center gap-2 text-muted-foreground text-sm">
				<Spinner />
				{PROJECT_SHELL_COPY.loading}
			</p>
		);
	}
	if (moodboard.isError || !moodboard.data) {
		return <p role="alert">{PROJECT_SHELL_COPY.unavailable}</p>;
	}

	return (
		<div className="flex flex-col gap-4">
			<h2 className="font-semibold text-lg">{moodboard.data.title}</h2>
			<p className="text-muted-foreground text-sm">
				{MOODBOARDS_COPY.moodboard}
			</p>
			<AddMoodboardVisualForm moodboardId={moodboardId} projectId={projectId} />
			{moodboard.data.visuals.length === 0 ? (
				<Empty>
					<EmptyHeader>
						<EmptyTitle>{MOODBOARDS_COPY.addVisual}</EmptyTitle>
					</EmptyHeader>
				</Empty>
			) : (
				<ul className="flex flex-col gap-3">
					{moodboard.data.visuals.map((visual) => (
						<li
							className="rounded-none border border-input px-2.5 py-2 text-sm"
							key={visual.id}
						>
							<p>{visualOriginLine(visual.origin)}</p>
							<MoodboardCaptionForm
								caption={visual.caption}
								moodboardId={moodboardId}
								projectId={projectId}
								revision={moodboard.data.revision}
								visualId={visual.id}
							/>
						</li>
					))}
				</ul>
			)}
			<p className="font-medium text-sm">{MOODBOARDS_COPY.colorSwatch}</p>
			<AddPaletteGroupForm moodboardId={moodboardId} projectId={projectId} />
			<AddColorSwatchForm
				moodboardId={moodboardId}
				paletteGroups={moodboard.data.paletteGroups}
				projectId={projectId}
				visuals={moodboard.data.visuals}
			/>
			{moodboard.data.paletteGroups.length === 0 &&
			moodboard.data.colorSwatches.length === 0 ? (
				<Empty>
					<EmptyHeader>
						<EmptyTitle>{MOODBOARDS_COPY.addColorSwatch}</EmptyTitle>
					</EmptyHeader>
				</Empty>
			) : (
				<div className="flex flex-col gap-3">
					{moodboard.data.paletteGroups.map((group) => (
						<section
							className="flex flex-col gap-2 rounded-none border border-input px-2.5 py-2"
							key={group.id}
						>
							<h3 className="font-medium text-sm">
								{MOODBOARDS_COPY.paletteGroup} · {group.title}
							</h3>
							<SwatchList swatches={group.colorSwatches} />
						</section>
					))}
					<SwatchList swatches={moodboard.data.colorSwatches} />
				</div>
			)}
		</div>
	);
}

function SwatchList({
	swatches,
}: {
	swatches: readonly {
		hex: string;
		hsl: { h: number; l: number; s: number };
		id: string;
		note: string;
		rgb: { b: number; g: number; r: number };
	}[];
}) {
	if (swatches.length === 0) {
		return null;
	}
	return (
		<ul className="flex flex-col gap-2">
			{swatches.map((swatch) => (
				<li className="flex items-center gap-3 text-sm" key={swatch.id}>
					<span
						aria-hidden="true"
						className="size-8 shrink-0 border border-input"
						style={{ backgroundColor: swatch.hex }}
					/>
					<div>
						<p>{MOODBOARDS_COPY.colorSwatch}</p>
						<p>
							{MOODBOARDS_COPY.hex} {swatch.hex} · {MOODBOARDS_COPY.rgb}{" "}
							{swatch.rgb.r},{swatch.rgb.g},{swatch.rgb.b} ·{" "}
							{MOODBOARDS_COPY.hsl} {swatch.hsl.h},{swatch.hsl.s}%,
							{swatch.hsl.l}%
						</p>
						{swatch.note.length > 0 ? <p>{swatch.note}</p> : null}
					</div>
				</li>
			))}
		</ul>
	);
}

function visualOriginLine(origin: {
	kind: string;
	title?: string;
	url?: string;
}): string {
	if (origin.kind === MOODBOARDS_COPY.fileAttachment && origin.title) {
		return `${origin.kind} · ${origin.title}`;
	}
	if (origin.url) {
		return `${origin.kind} · ${origin.url}`;
	}
	return origin.kind;
}
