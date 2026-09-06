import { Button } from "@cantiara/ui/components/button";
import { Empty, EmptyHeader, EmptyTitle } from "@cantiara/ui/components/empty";
import { Spinner } from "@cantiara/ui/components/spinner";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import AddMoodboardVisualForm from "@/features/moodboards/forms/add-moodboard-visual-form";
import MoodboardCaptionForm from "@/features/moodboards/forms/moodboard-caption-form";
import MoodboardFocusOrderForm from "@/features/moodboards/forms/moodboard-focus-order-form";
import MoodboardSnapshotForm from "@/features/moodboards/forms/moodboard-snapshot-form";
import MoodboardTransformForm from "@/features/moodboards/forms/moodboard-transform-form";
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
	const [presenting, setPresenting] = useState(false);
	const moodboard = useQuery(
		orpc.moodboards.get.queryOptions({
			input: { moodboardId },
		})
	);
	const onEnterPresentation = useCallback(() => {
		setPresenting(true);
	}, []);
	const onExitPresentation = useCallback(() => {
		setPresenting(false);
	}, []);

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

	const orderedIds =
		moodboard.data.focusOrder.length === moodboard.data.visuals.length
			? moodboard.data.focusOrder
			: moodboard.data.visuals.map((visual) => visual.id);
	const byId = new Map(
		moodboard.data.visuals.map((visual) => [visual.id, visual])
	);
	const orderedVisuals = orderedIds
		.map((id) => byId.get(id))
		.filter((visual): visual is NonNullable<typeof visual> => Boolean(visual));
	const snapshotVisuals = moodboard.data.visuals.map((visual) => ({
		id: visual.id,
		label: visualOriginLine(visual.origin),
	}));

	return (
		<div
			className={
				presenting
					? "fixed inset-0 z-50 overflow-auto bg-background p-6"
					: "flex flex-col gap-4"
			}
		>
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h2 className="font-semibold text-lg">{moodboard.data.title}</h2>
					<p className="text-muted-foreground text-sm">
						{MOODBOARDS_COPY.moodboard}
					</p>
				</div>
				{presenting ? (
					<Button onClick={onExitPresentation} type="button">
						{MOODBOARDS_COPY.exitPresentationMode}
					</Button>
				) : (
					<Button onClick={onEnterPresentation} type="button">
						{MOODBOARDS_COPY.presentationMode}
					</Button>
				)}
			</div>
			{presenting ? null : (
				<>
					<AddMoodboardVisualForm
						moodboardId={moodboardId}
						projectId={projectId}
					/>
					<MoodboardFocusOrderForm
						moodboardId={moodboardId}
						projectId={projectId}
						revision={moodboard.data.revision}
						visuals={snapshotVisuals}
					/>
					<MoodboardSnapshotForm
						moodboardId={moodboardId}
						visuals={snapshotVisuals}
					/>
				</>
			)}
			{orderedVisuals.length === 0 ? (
				<Empty>
					<EmptyHeader>
						<EmptyTitle>{MOODBOARDS_COPY.addVisual}</EmptyTitle>
					</EmptyHeader>
				</Empty>
			) : (
				<ul className="flex flex-col gap-3">
					{orderedVisuals.map((visual) => (
						<li
							className="rounded-none border border-input px-2.5 py-2 text-sm"
							key={visual.id}
						>
							<p>{visualOriginLine(visual.origin)}</p>
							{presenting ? (
								<p>{visual.caption}</p>
							) : (
								<>
									<MoodboardCaptionForm
										caption={visual.caption}
										moodboardId={moodboardId}
										projectId={projectId}
										revision={moodboard.data.revision}
										visualId={visual.id}
									/>
									<MoodboardTransformForm
										crop={visual.presentation.crop}
										moodboardId={moodboardId}
										projectId={projectId}
										revision={moodboard.data.revision}
										rotation={visual.presentation.rotation}
										visualId={visual.id}
									/>
								</>
							)}
						</li>
					))}
				</ul>
			)}
		</div>
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
