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
import { newIdempotencyKey } from "@/lib/mutation";
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
			<RoadmapMilestones
				projectId={projectId}
				selectedWorkId={selectedWorkId}
			/>
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

interface MilestoneRow {
	contributingWork: Array<{
		id: string;
		key: string;
		status: string;
		title: string;
	}>;
	description: string | null;
	id: string;
	status: string;
	targetDate: string | null;
	title: string;
}

function RoadmapMilestones({
	projectId,
	selectedWorkId,
}: {
	projectId: string;
	selectedWorkId: string | null;
}) {
	const copy = ROADMAP_COPY;
	const listed = useQuery(
		orpc.roadmapHorizon.listMilestones.queryOptions({
			input: { projectId },
		})
	);
	const create = useMutation(
		orpc.roadmapHorizon.createMilestone.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status !== "committed") {
					return;
				}
				await invalidateRoadmapHorizon();
			},
		})
	);
	const setStatus = useMutation(
		orpc.roadmapHorizon.setMilestoneStatus.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status !== "committed") {
					return;
				}
				await invalidateRoadmapHorizon();
			},
		})
	);
	const contribute = useMutation(
		orpc.roadmapHorizon.contributeToMilestone.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status !== "committed") {
					return;
				}
				await invalidateRoadmapHorizon();
			},
		})
	);
	const onCreate = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			const form = new FormData(event.currentTarget);
			const title = String(form.get("title") ?? "").trim();
			if (title.length === 0) {
				return;
			}
			const description = String(form.get("description") ?? "").trim();
			const targetDate = String(form.get("targetDate") ?? "").trim();
			create.mutate({
				description: description.length > 0 ? description : undefined,
				idempotencyKey: newIdempotencyKey(),
				projectId,
				targetDate: targetDate.length > 0 ? targetDate : null,
				title,
			});
			event.currentTarget.reset();
		},
		[create, projectId]
	);
	const milestones = listed.data ?? [];
	return (
		<section aria-label={copy.milestones} className="flex flex-col gap-3">
			<h3 className="font-medium text-sm tracking-tight">{copy.milestones}</h3>
			<form className="flex flex-wrap items-end gap-3" onSubmit={onCreate}>
				<Field>
					<FieldLabel htmlFor="milestone-title">{copy.title}</FieldLabel>
					<Input id="milestone-title" name="title" required />
				</Field>
				<Field>
					<FieldLabel htmlFor="milestone-description">
						{copy.description}
					</FieldLabel>
					<Input id="milestone-description" name="description" />
				</Field>
				<Field>
					<FieldLabel htmlFor="milestone-target-date">
						{copy.targetDate}
					</FieldLabel>
					<Input id="milestone-target-date" name="targetDate" type="date" />
				</Field>
				<Button size="sm" type="submit">
					{copy.createMilestone}
				</Button>
			</form>
			{milestones.length === 0 ? (
				<p className="text-muted-foreground text-sm">{copy.emptyMilestone}</p>
			) : (
				<ul className="flex flex-col gap-3">
					{milestones.map((milestone: MilestoneRow) => (
						<li
							className="flex flex-col gap-2 rounded-none border px-3 py-2"
							key={milestone.id}
						>
							<div className="flex flex-wrap items-center gap-2">
								<span className="font-medium text-sm">{milestone.title}</span>
								<span className="text-muted-foreground text-xs">
									{milestone.status}
								</span>
								{milestone.targetDate ? (
									<span className="text-muted-foreground text-xs">
										{milestone.targetDate}
									</span>
								) : null}
							</div>
							{milestone.description ? (
								<p className="text-muted-foreground text-sm">
									{milestone.description}
								</p>
							) : null}
							{milestone.contributingWork.length > 0 ? (
								<ul className="text-muted-foreground text-xs">
									{milestone.contributingWork.map((work) => (
										<li key={work.id}>
											{work.key} {work.title} · {work.status}
										</li>
									))}
								</ul>
							) : null}
							<MilestoneActions
								milestoneId={milestone.id}
								onContribute={contribute.mutate}
								onSetStatus={setStatus.mutate}
								selectedWorkId={selectedWorkId}
							/>
						</li>
					))}
				</ul>
			)}
		</section>
	);
}

function MilestoneActions({
	milestoneId,
	onContribute,
	onSetStatus,
	selectedWorkId,
}: {
	milestoneId: string;
	onContribute: (input: {
		idempotencyKey: string;
		milestoneId: string;
		workId: string;
	}) => void;
	onSetStatus: (input: {
		idempotencyKey: string;
		milestoneId: string;
		status: "Reached" | "Abandoned";
	}) => void;
	selectedWorkId: string | null;
}) {
	const onReach = useCallback(() => {
		onSetStatus({
			idempotencyKey: newIdempotencyKey(),
			milestoneId,
			status: ROADMAP_COPY.reached,
		});
	}, [milestoneId, onSetStatus]);
	const onAbandon = useCallback(() => {
		onSetStatus({
			idempotencyKey: newIdempotencyKey(),
			milestoneId,
			status: ROADMAP_COPY.abandoned,
		});
	}, [milestoneId, onSetStatus]);
	const onLink = useCallback(() => {
		if (selectedWorkId === null) {
			return;
		}
		onContribute({
			idempotencyKey: newIdempotencyKey(),
			milestoneId,
			workId: selectedWorkId,
		});
	}, [milestoneId, onContribute, selectedWorkId]);
	return (
		<div className="flex flex-wrap gap-2">
			<Button onClick={onReach} size="sm" type="button" variant="outline">
				{ROADMAP_COPY.reach}
			</Button>
			<Button onClick={onAbandon} size="sm" type="button" variant="outline">
				{ROADMAP_COPY.abandon}
			</Button>
			<Button
				disabled={selectedWorkId === null}
				onClick={onLink}
				size="sm"
				type="button"
			>
				{ROADMAP_COPY.contributesToMilestone}
			</Button>
		</div>
	);
}
