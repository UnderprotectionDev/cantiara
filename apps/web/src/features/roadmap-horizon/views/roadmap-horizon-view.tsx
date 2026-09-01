import { Button } from "@cantiara/ui/components/button";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useMemo, useRef, useState } from "react";

import { invalidateRoadmapHorizon } from "@/features/work-lifecycle/forms/invalidate-work";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import {
	isRoadmapHorizon,
	ROADMAP_COPY,
	ROADMAP_HORIZONS,
} from "./roadmap-copy";

interface BlockerBadge {
	blockedWorkId: string;
	copy: { openSourceRecord: string };
	sources: Array<{ id: string; kind: string }>;
}

interface RoadmapItem {
	blockerBadge: BlockerBadge | null;
	expectedOutcome: string | null;
	horizon: string | null;
	id: string;
	key: string;
	originWorkId: string | null;
	plannedStart: string | null;
	problemOpportunity: string | null;
	role: string;
	targetDate: string | null;
	title: string;
	type: string;
}

interface RoadmapGroup {
	items: RoadmapItem[];
	label: string;
}

export default function RoadmapHorizonView({
	onOpenSourceRecord,
	onPresentationModeChange,
	onRestorePosition,
	projectId,
	selectedWorkId,
}: {
	onOpenSourceRecord: (id: string) => void;
	onPresentationModeChange?: (active: boolean) => void;
	onRestorePosition?: (id: string | null) => void;
	projectId: string;
	selectedWorkId: string | null;
}) {
	const catalog = useQuery(orpc.roadmapHorizon.catalog.queryOptions());
	const [namedViewId, setNamedViewId] = useState<string | undefined>();
	const [presentation, setPresentation] = useState<
		"Product direction" | "All Work types"
	>("Product direction");
	const [horizonFilter, setHorizonFilter] = useState<string>("");
	const [presenting, setPresenting] = useState(false);
	const restore = useRef({
		horizonFilter: "",
		namedViewId: undefined as string | undefined,
		presentation: "Product direction" as "Product direction" | "All Work types",
		selectedWorkId: null as string | null,
	});
	const copy = catalog.data?.copy ?? ROADMAP_COPY;
	const listInput = {
		groupField: ROADMAP_COPY.horizon,
		horizonFilter: isRoadmapHorizon(horizonFilter) ? horizonFilter : undefined,
		namedViewId,
		presentation,
		presentationMode: presenting || undefined,
		projectId,
	};
	const view = useQuery(
		orpc.roadmapHorizon.list.queryOptions({
			input: listInput,
		})
	);
	const save = useMutation(
		orpc.roadmapHorizon.saveNamedView.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status !== "committed") {
					return;
				}
				setNamedViewId(outcome.view.id);
				await invalidateRoadmapHorizon();
			},
		})
	);
	const onPresentationChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			setNamedViewId(undefined);
			setPresentation(
				event.currentTarget.value === ROADMAP_COPY.allWorkTypes
					? "All Work types"
					: "Product direction"
			);
		},
		[]
	);
	const onHorizonFilterChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			setNamedViewId(undefined);
			setHorizonFilter(event.currentTarget.value);
		},
		[]
	);
	const onSaveNamedView = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			const form = new FormData(event.currentTarget);
			const name = String(form.get("name") ?? "").trim();
			if (name.length === 0) {
				return;
			}
			save.mutate({
				groupField: ROADMAP_COPY.horizon,
				horizonFilter: isRoadmapHorizon(horizonFilter) ? horizonFilter : null,
				name,
				presentation,
				projectId,
			});
		},
		[horizonFilter, presentation, projectId, save]
	);
	const onEnterPresentation = useCallback(() => {
		restore.current = {
			horizonFilter,
			namedViewId,
			presentation,
			selectedWorkId,
		};
		setPresenting(true);
		onPresentationModeChange?.(true);
	}, [
		horizonFilter,
		namedViewId,
		onPresentationModeChange,
		presentation,
		selectedWorkId,
	]);
	const onExitPresentation = useCallback(() => {
		setHorizonFilter(restore.current.horizonFilter);
		setNamedViewId(restore.current.namedViewId);
		setPresentation(restore.current.presentation);
		onRestorePosition?.(restore.current.selectedWorkId);
		setPresenting(false);
		onPresentationModeChange?.(false);
	}, [onPresentationModeChange, onRestorePosition]);
	const groups = view.data?.groups ?? [];
	const candidates = view.data?.unplannedCandidates.items ?? [];
	const sectionClass = presenting
		? "fixed inset-0 z-50 flex flex-col gap-4 overflow-auto bg-background p-6"
		: "flex flex-col gap-4";
	return (
		<section aria-label={copy.roadmap} className={sectionClass}>
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h2 className="font-medium text-sm tracking-tight">{copy.roadmap}</h2>
				{presenting ? (
					<Button onClick={onExitPresentation} size="sm" type="button">
						{ROADMAP_COPY.exitPresentationMode}
					</Button>
				) : (
					<Button onClick={onEnterPresentation} size="sm" type="button">
						{copy.presentationMode}
					</Button>
				)}
			</div>
			{presenting ? null : (
				<>
					<div className="flex flex-wrap items-end gap-3">
						<Field>
							<FieldLabel htmlFor="roadmap-presentation">
								{copy.productDirection}
							</FieldLabel>
							<NativeSelect
								id="roadmap-presentation"
								onChange={onPresentationChange}
								value={presentation}
							>
								<NativeSelectOption value="Product direction">
									{copy.productDirection}
								</NativeSelectOption>
								<NativeSelectOption value="All Work types">
									{copy.allWorkTypes}
								</NativeSelectOption>
							</NativeSelect>
						</Field>
						<Field>
							<FieldLabel htmlFor="roadmap-horizon-filter">
								{copy.horizon}
							</FieldLabel>
							<NativeSelect
								id="roadmap-horizon-filter"
								onChange={onHorizonFilterChange}
								value={horizonFilter}
							>
								<NativeSelectOption value="">{copy.roadmap}</NativeSelectOption>
								{ROADMAP_HORIZONS.map((horizon) => (
									<NativeSelectOption key={horizon} value={horizon}>
										{horizon}
									</NativeSelectOption>
								))}
							</NativeSelect>
						</Field>
					</div>
					<form
						className="flex flex-wrap items-end gap-3"
						onSubmit={onSaveNamedView}
					>
						<Field>
							<FieldLabel htmlFor="roadmap-named-view">
								{copy.saveNamedView}
							</FieldLabel>
							<Input id="roadmap-named-view" name="name" />
						</Field>
						<Button size="sm" type="submit">
							{copy.saveNamedView}
						</Button>
					</form>
				</>
			)}
			{groups.map((group: RoadmapGroup) => (
				<div className="flex flex-col gap-2" key={group.label}>
					<h3 className="text-muted-foreground text-xs tracking-wide">
						{group.label}
					</h3>
					<ul className="flex flex-col gap-2">
						{group.items.map((item) => (
							<li key={item.id}>
								<RoadmapWorkRow
									item={item}
									onOpenSourceRecord={onOpenSourceRecord}
									selected={selectedWorkId === item.id}
								/>
							</li>
						))}
					</ul>
				</div>
			))}
			<details className="rounded-none border px-3 py-2">
				<summary className="cursor-pointer text-sm">
					{copy.unplannedCandidates}
				</summary>
				<ul className="mt-2 flex flex-col gap-2">
					{candidates.map((item) => (
						<li className="flex flex-col gap-2" key={item.id}>
							<RoadmapWorkRow
								item={item}
								onOpenSourceRecord={onOpenSourceRecord}
								selected={selectedWorkId === item.id}
							/>
							{presenting ? null : <PlaceCandidateForm workId={item.id} />}
						</li>
					))}
				</ul>
			</details>
		</section>
	);
}

function RoadmapWorkRow({
	item,
	onOpenSourceRecord,
	selected,
}: {
	item: RoadmapItem;
	onOpenSourceRecord: (id: string) => void;
	selected: boolean;
}) {
	const onOpen = useCallback(() => {
		onOpenSourceRecord(item.id);
	}, [item.id, onOpenSourceRecord]);
	const onOpenSource = useCallback(
		(sourceId: string) => {
			onOpenSourceRecord(sourceId);
		},
		[onOpenSourceRecord]
	);
	return (
		<div>
			<button
				aria-current={selected ? "true" : undefined}
				className="flex w-full flex-col items-start gap-0.5 rounded-none border px-3 py-2 text-left text-sm"
				onClick={onOpen}
				type="button"
			>
				<span className="font-mono text-muted-foreground text-xs">
					{item.key}
				</span>
				<span>
					{item.problemOpportunity ?? item.title} · {item.role}
				</span>
				{item.expectedOutcome ? (
					<span className="text-muted-foreground text-xs">
						{item.expectedOutcome}
					</span>
				) : null}
				{item.horizon ? (
					<span className="text-muted-foreground text-xs">{item.horizon}</span>
				) : null}
			</button>
			{item.blockerBadge ? (
				<BlockerBadgeActions
					badge={item.blockerBadge}
					onOpenBlocked={onOpen}
					onOpenSource={onOpenSource}
				/>
			) : null}
		</div>
	);
}

function BlockerBadgeActions({
	badge,
	onOpenBlocked,
	onOpenSource,
}: {
	badge: BlockerBadge;
	onOpenBlocked: () => void;
	onOpenSource: (id: string) => void;
}) {
	return (
		<div className="mt-1 flex flex-wrap gap-2 px-1">
			<Button
				onClick={onOpenBlocked}
				size="sm"
				type="button"
				variant="secondary"
			>
				{badge.copy.openSourceRecord}
			</Button>
			{badge.sources.map((source) => (
				<BlockerSourceButton
					key={`${source.kind}:${source.id}`}
					label={badge.copy.openSourceRecord}
					onOpen={onOpenSource}
					source={source}
				/>
			))}
		</div>
	);
}

function BlockerSourceButton({
	label,
	onOpen,
	source,
}: {
	label: string;
	onOpen: (id: string) => void;
	source: { id: string; kind: string };
}) {
	const onClick = useCallback(() => {
		onOpen(source.id);
	}, [onOpen, source.id]);
	return (
		<Button onClick={onClick} size="sm" type="button" variant="ghost">
			{label} · {source.kind}
		</Button>
	);
}

function PlaceCandidateForm({ workId }: { workId: string }) {
	const [field, setField] = useState<
		"Horizon" | "Planned start" | "Target date"
	>("Horizon");
	const [value, setValue] = useState<string>(ROADMAP_COPY.next);
	const [previewText, setPreviewText] = useState<string | null>(null);
	const place = useMutation(
		orpc.roadmapHorizon.placeCandidate.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status !== "committed") {
					return;
				}
				setPreviewText(null);
				await invalidateRoadmapHorizon();
			},
		})
	);
	const change = useMemo(() => {
		if (field === ROADMAP_COPY.horizon && isRoadmapHorizon(value)) {
			return { field: ROADMAP_COPY.horizon, horizon: value };
		}
		if (field === ROADMAP_COPY.plannedStart) {
			return { field: ROADMAP_COPY.plannedStart, plannedStart: value };
		}
		return { field: ROADMAP_COPY.targetDate, targetDate: value };
	}, [field, value]);
	const onPreview = useCallback(() => {
		queryClient
			.fetchQuery(
				orpc.roadmapHorizon.previewPlaceCandidate.queryOptions({
					input: { change, workId },
				})
			)
			.then((outcome) => {
				if (outcome.status !== "ready") {
					setPreviewText(null);
					return;
				}
				setPreviewText(
					`${outcome.preview.field}: ${outcome.preview.from ?? "—"} → ${outcome.preview.to}`
				);
			})
			.catch(() => {
				setPreviewText(null);
			});
	}, [change, workId]);
	const onConfirm = useCallback(() => {
		place.mutate({
			change,
			confirmed: true,
			idempotencyKey: newIdempotencyKey(),
			workId,
		});
	}, [change, place, workId]);
	const onFieldChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
		const next = event.currentTarget.value;
		if (next === ROADMAP_COPY.plannedStart) {
			setField("Planned start");
			setValue("");
			return;
		}
		if (next === ROADMAP_COPY.targetDate) {
			setField("Target date");
			setValue("");
			return;
		}
		setField("Horizon");
		setValue(ROADMAP_COPY.next);
	}, []);
	const onValueChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
		setValue(event.currentTarget.value);
	}, []);
	const onDateChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setValue(event.currentTarget.value);
	}, []);
	return (
		<div className="flex flex-col gap-2 px-1 pb-2">
			<div className="flex flex-wrap items-end gap-2">
				<Field>
					<FieldLabel htmlFor={`${workId}-candidate-field`}>
						{ROADMAP_COPY.placeOnPlan}
					</FieldLabel>
					<NativeSelect
						id={`${workId}-candidate-field`}
						onChange={onFieldChange}
						value={field}
					>
						<NativeSelectOption value={ROADMAP_COPY.horizon}>
							{ROADMAP_COPY.horizon}
						</NativeSelectOption>
						<NativeSelectOption value={ROADMAP_COPY.plannedStart}>
							{ROADMAP_COPY.plannedStart}
						</NativeSelectOption>
						<NativeSelectOption value={ROADMAP_COPY.targetDate}>
							{ROADMAP_COPY.targetDate}
						</NativeSelectOption>
					</NativeSelect>
				</Field>
				{field === ROADMAP_COPY.horizon ? (
					<Field>
						<FieldLabel htmlFor={`${workId}-candidate-horizon`}>
							{ROADMAP_COPY.horizon}
						</FieldLabel>
						<NativeSelect
							id={`${workId}-candidate-horizon`}
							onChange={onValueChange}
							value={value}
						>
							{ROADMAP_HORIZONS.map((horizon) => (
								<NativeSelectOption key={horizon} value={horizon}>
									{horizon}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</Field>
				) : (
					<Field>
						<FieldLabel htmlFor={`${workId}-candidate-date`}>
							{field}
						</FieldLabel>
						<Input
							id={`${workId}-candidate-date`}
							onChange={onDateChange}
							type="date"
							value={value}
						/>
					</Field>
				)}
				<Button onClick={onPreview} size="sm" type="button" variant="ghost">
					{ROADMAP_COPY.preview}
				</Button>
				<Button
					disabled={!previewText}
					onClick={onConfirm}
					size="sm"
					type="button"
				>
					{ROADMAP_COPY.confirm}
				</Button>
			</div>
			{previewText ? (
				<p className="text-muted-foreground text-xs">{previewText}</p>
			) : null}
		</div>
	);
}
