import { Button } from "@cantiara/ui/components/button";
import { Empty, EmptyHeader, EmptyTitle } from "@cantiara/ui/components/empty";
import { Spinner } from "@cantiara/ui/components/spinner";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import AddMoodboardVisualForm from "@/features/moodboards/forms/add-moodboard-visual-form";
import MoodboardCaptionForm from "@/features/moodboards/forms/moodboard-caption-form";
import MoodboardFocusOrderForm from "@/features/moodboards/forms/moodboard-focus-order-form";
import MoodboardSnapshotForm from "@/features/moodboards/forms/moodboard-snapshot-form";
import MoodboardTransformForm from "@/features/moodboards/forms/moodboard-transform-form";
import { MOODBOARDS_COPY } from "@/features/moodboards/forms/moodboards-copy";
import { PROJECT_SHELL_COPY } from "@/features/project-shell/forms/project-shell-copy";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

interface MoodboardVisual {
	caption: string;
	groupId: string | null;
	id: string;
	openHref: string | null;
	openSourceRecord: string;
	origin: {
		kind: string;
		title?: string;
		url?: string;
	};
	presentation: {
		crop: {
			height: number;
			left: number;
			top: number;
			width: number;
		} | null;
		rotation: 0 | 90 | 180 | 270;
	};
}

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
	const viewport = useQuery(
		orpc.moodboards.getViewport.queryOptions({
			input: { moodboardId },
		})
	);
	const [selectedIds, setSelectedIds] = useState<string[]>([]);
	const saveViewport = useMutation(
		orpc.moodboards.saveViewport.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: orpc.moodboards.getViewport.queryKey({
						input: { moodboardId },
					}),
				});
			},
		})
	);
	const reorder = useMutation(
		orpc.moodboards.reorderOutline.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await queryClient.invalidateQueries({
						queryKey: orpc.moodboards.get.queryKey({
							input: { moodboardId },
						}),
					});
				}
			},
		})
	);
	const group = useMutation(
		orpc.moodboards.groupOutline.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await queryClient.invalidateQueries({
						queryKey: orpc.moodboards.get.queryKey({
							input: { moodboardId },
						}),
					});
					setSelectedIds([]);
				}
			},
		})
	);
	const onEnterPresentation = useCallback(() => {
		setPresenting(true);
	}, []);
	const onExitPresentation = useCallback(() => {
		setPresenting(false);
	}, []);

	const visuals = moodboard.data?.visuals ?? [];
	const groups = moodboard.data?.groups ?? [];
	const restored = viewport.data?.viewport;
	const collapsed = useMemo(
		() => new Set(restored?.collapsedGroupIds ?? []),
		[restored?.collapsedGroupIds]
	);

	const onFitView = useCallback(() => {
		saveViewport.mutate({
			payload: {
				moodboardId,
				viewport: {
					centerX: 0,
					centerY: 0,
					collapsedGroupIds: [],
					zoom: 1,
				},
			},
		});
	}, [moodboardId, saveViewport]);

	const onToggleSelect = useCallback((visualId: string) => {
		setSelectedIds((current) =>
			current.includes(visualId)
				? current.filter((id) => id !== visualId)
				: [...current, visualId]
		);
	}, []);

	const onMove = useCallback(
		(visualId: string, direction: -1 | 1) => {
			if (!moodboard.data) {
				return;
			}
			const ids = moodboard.data.visuals.map((visual) => visual.id);
			const index = ids.indexOf(visualId);
			const next = index + direction;
			if (index < 0 || next < 0 || next >= ids.length) {
				return;
			}
			const nextIds = [...ids];
			const [moved] = nextIds.splice(index, 1);
			if (!moved) {
				return;
			}
			nextIds.splice(next, 0, moved);
			reorder.mutate({
				idempotencyKey: newIdempotencyKey(),
				payload: { moodboardId, visualIds: nextIds },
			});
		},
		[moodboard.data, moodboardId, reorder]
	);

	const onGroup = useCallback(() => {
		if (selectedIds.length === 0) {
			return;
		}
		group.mutate({
			idempotencyKey: newIdempotencyKey(),
			payload: {
				moodboardId,
				title: MOODBOARDS_COPY.group,
				visualIds: selectedIds,
			},
		});
	}, [group, moodboardId, selectedIds]);

	const onToggleCollapse = useCallback(
		(groupId: string) => {
			const next = new Set(collapsed);
			if (next.has(groupId)) {
				next.delete(groupId);
			} else {
				next.add(groupId);
			}
			saveViewport.mutate({
				payload: {
					moodboardId,
					viewport: {
						centerX: restored?.centerX ?? 0,
						centerY: restored?.centerY ?? 0,
						collapsedGroupIds: [...next],
						zoom: restored?.zoom ?? 1,
					},
				},
			});
		},
		[collapsed, moodboardId, restored, saveViewport]
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

	const selectedVisual = visuals.find((visual) => visual.id === selectedIds[0]);
	const scale = restored?.zoom ?? 1;
	const translateX = -(restored?.centerX ?? 0);
	const translateY = -(restored?.centerY ?? 0);
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
	const presentationList =
		orderedVisuals.length === 0 ? (
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
						<p>{visual.caption}</p>
					</li>
				))}
			</ul>
		);

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
					<div className="flex flex-wrap gap-2">
						<Button onClick={onFitView} type="button" variant="outline">
							{MOODBOARDS_COPY.fitView}
						</Button>
						<Button
							disabled={selectedIds.length === 0}
							onClick={onGroup}
							type="button"
							variant="outline"
						>
							{MOODBOARDS_COPY.group}
						</Button>
						<Button onClick={onEnterPresentation} type="button">
							{MOODBOARDS_COPY.presentationMode}
						</Button>
					</div>
				)}
			</div>
			{presenting ? (
				presentationList
			) : (
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
					<div className="grid gap-4 lg:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)]">
						<nav aria-label={MOODBOARDS_COPY.outline}>
							<h3 className="font-medium text-sm">{MOODBOARDS_COPY.outline}</h3>
							{visuals.length === 0 ? (
								<Empty>
									<EmptyHeader>
										<EmptyTitle>{MOODBOARDS_COPY.addVisual}</EmptyTitle>
									</EmptyHeader>
								</Empty>
							) : (
								<ul className="mt-2 flex flex-col gap-2">
									{groups.map((boardGroup) => (
										<OutlineGroup
											collapsed={collapsed.has(boardGroup.id)}
											id={boardGroup.id}
											key={boardGroup.id}
											onMove={onMove}
											onToggleCollapse={onToggleCollapse}
											onToggleSelect={onToggleSelect}
											selectedIds={selectedIds}
											title={boardGroup.title}
											visuals={visuals.filter(
												(visual) => visual.groupId === boardGroup.id
											)}
										/>
									))}
									{visuals
										.filter((visual) => visual.groupId === null)
										.map((visual) => (
											<OutlineVisual
												key={visual.id}
												onMove={onMove}
												onToggleSelect={onToggleSelect}
												selected={selectedIds.includes(visual.id)}
												visual={visual}
											/>
										))}
								</ul>
							)}
						</nav>
						<div>
							<div
								aria-hidden
								className="relative min-h-[18rem] overflow-hidden rounded-none border border-input"
								style={{
									transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
									transformOrigin: "center center",
								}}
							>
								{visuals.map((visual, index) => (
									<article
										className="absolute w-40 rounded-none border border-input bg-background p-2 text-xs"
										key={visual.id}
										style={{ left: index * 200, top: 24 }}
									>
										{visualOriginLine(visual.origin)}
									</article>
								))}
							</div>
							{selectedVisual ? (
								<section aria-label={MOODBOARDS_COPY.inspect} className="mt-4">
									<h3 className="font-medium text-sm">
										{MOODBOARDS_COPY.inspect}
									</h3>
									<p className="mt-2 text-sm">
										{visualOriginLine(selectedVisual.origin)}
									</p>
									<MoodboardCaptionForm
										caption={selectedVisual.caption}
										moodboardId={moodboardId}
										projectId={projectId}
										revision={moodboard.data.revision}
										visualId={selectedVisual.id}
									/>
									<MoodboardTransformForm
										crop={selectedVisual.presentation.crop}
										moodboardId={moodboardId}
										projectId={projectId}
										revision={moodboard.data.revision}
										rotation={selectedVisual.presentation.rotation}
										visualId={selectedVisual.id}
									/>
								</section>
							) : null}
						</div>
					</div>
				</>
			)}
		</div>
	);
}

function OutlineGroup({
	collapsed,
	id,
	onMove,
	onToggleCollapse,
	onToggleSelect,
	selectedIds,
	title,
	visuals,
}: {
	collapsed: boolean;
	id: string;
	onMove: (visualId: string, direction: -1 | 1) => void;
	onToggleCollapse: (groupId: string) => void;
	onToggleSelect: (visualId: string) => void;
	selectedIds: string[];
	title: string;
	visuals: MoodboardVisual[];
}) {
	const onCollapse = useCallback(() => {
		onToggleCollapse(id);
	}, [id, onToggleCollapse]);
	return (
		<li>
			<div className="flex items-center gap-2">
				<span className="font-medium text-sm">{title}</span>
				<Button onClick={onCollapse} size="sm" type="button" variant="ghost">
					{collapsed
						? MOODBOARDS_COPY.expandGroup
						: MOODBOARDS_COPY.collapseGroup}
				</Button>
			</div>
			{collapsed ? null : (
				<ul className="mt-2 flex flex-col gap-2 pl-3">
					{visuals.map((visual) => (
						<OutlineVisual
							key={visual.id}
							onMove={onMove}
							onToggleSelect={onToggleSelect}
							selected={selectedIds.includes(visual.id)}
							visual={visual}
						/>
					))}
				</ul>
			)}
		</li>
	);
}

function OutlineVisual({
	onMove,
	onToggleSelect,
	selected,
	visual,
}: {
	onMove: (visualId: string, direction: -1 | 1) => void;
	onToggleSelect: (visualId: string) => void;
	selected: boolean;
	visual: MoodboardVisual;
}) {
	const onSelect = useCallback(() => {
		onToggleSelect(visual.id);
	}, [onToggleSelect, visual.id]);
	const onUp = useCallback(() => {
		onMove(visual.id, -1);
	}, [onMove, visual.id]);
	const onDown = useCallback(() => {
		onMove(visual.id, 1);
	}, [onMove, visual.id]);

	return (
		<li className="rounded-none border border-input px-2.5 py-2 text-sm">
			<div className="flex flex-wrap items-center gap-2">
				<Button
					aria-pressed={selected}
					onClick={onSelect}
					size="sm"
					type="button"
					variant={selected ? "secondary" : "outline"}
				>
					{visualOriginLine(visual.origin)}
				</Button>
				<Button onClick={onUp} size="sm" type="button" variant="ghost">
					{MOODBOARDS_COPY.moveUp}
				</Button>
				<Button onClick={onDown} size="sm" type="button" variant="ghost">
					{MOODBOARDS_COPY.moveDown}
				</Button>
				{visual.openHref ? (
					<a className="text-sm underline" href={visual.openHref}>
						{visual.openSourceRecord}
					</a>
				) : null}
			</div>
		</li>
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
