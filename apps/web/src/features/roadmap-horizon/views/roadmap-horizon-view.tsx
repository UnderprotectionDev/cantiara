import { Button } from "@cantiara/ui/components/button";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useState } from "react";

import { invalidateRoadmapHorizon } from "@/features/work-lifecycle/forms/invalidate-work";
import { orpc } from "@/utils/orpc";

import {
	isRoadmapHorizon,
	ROADMAP_COPY,
	ROADMAP_HORIZONS,
} from "./roadmap-copy";

interface RoadmapItem {
	expectedOutcome: string | null;
	horizon: string | null;
	id: string;
	key: string;
	originWorkId: string | null;
	problemOpportunity: string | null;
	role: string;
	title: string;
	type: string;
}

interface RoadmapGroup {
	items: RoadmapItem[];
	label: string;
}

export default function RoadmapHorizonView({
	onOpenSourceRecord,
	projectId,
	selectedWorkId,
}: {
	onOpenSourceRecord: (id: string) => void;
	projectId: string;
	selectedWorkId: string | null;
}) {
	const catalog = useQuery(orpc.roadmapHorizon.catalog.queryOptions());
	const [namedViewId, setNamedViewId] = useState<string | undefined>();
	const [presentation, setPresentation] = useState<
		"Product direction" | "All Work types"
	>("Product direction");
	const [horizonFilter, setHorizonFilter] = useState<string>("");
	const copy = catalog.data?.copy ?? ROADMAP_COPY;
	const listInput = {
		groupField: ROADMAP_COPY.horizon,
		horizonFilter: isRoadmapHorizon(horizonFilter) ? horizonFilter : undefined,
		namedViewId,
		presentation,
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
	const groups = view.data?.groups ?? [];
	return (
		<section aria-label={copy.roadmap} className="flex flex-col gap-4">
			<h2 className="font-medium text-sm tracking-tight">{copy.roadmap}</h2>
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
			{groups.map((group: RoadmapGroup) => (
				<div className="flex flex-col gap-2" key={group.label}>
					<h3 className="text-muted-foreground text-xs tracking-wide">
						{group.label}
					</h3>
					<ul className="flex flex-col gap-2">
						{group.items.map((item) => (
							<RoadmapWorkRow
								item={item}
								key={item.id}
								onOpenSourceRecord={onOpenSourceRecord}
								selected={selectedWorkId === item.id}
							/>
						))}
					</ul>
				</div>
			))}
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
	return (
		<li>
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
		</li>
	);
}
