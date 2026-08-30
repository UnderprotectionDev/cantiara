import { Button } from "@cantiara/ui/components/button";
import { Skeleton } from "@cantiara/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";

import BulkEditPreview from "@/features/bulk-editing/views/bulk-edit-preview";
import {
	bulkEditTargetIds,
	nextBulkSelectedWorkIds,
} from "@/features/bulk-editing/views/bulk-selection";
import CustomFieldFilter from "@/features/custom-fields/forms/custom-field-filter";
import { PRIORITY_COPY } from "@/features/priority/forms/priority-copy";
import PrioritizationSessionArea from "@/features/priority/views/prioritization-session";
import PriorityMap from "@/features/priority/views/priority-map";
import {
	PROJECT_SHELL_COPY,
	projectShellAnchor,
} from "@/features/project-shell/forms/project-shell-copy";
import TagFilter from "@/features/tags/views/tag-filter";
import CreateFromTemplateForm from "@/features/work-templates/forms/create-from-template-form";
import { orpc } from "@/utils/orpc";

import CreateWorkForm from "../forms/create-work-form";
import { WORK_LIFECYCLE_COPY } from "../forms/work-lifecycle-copy";
import ScopeTree from "./scope-tree";
import WorkDetail from "./work-detail";
import WorkList from "./work-list";
import { nextSelectedWorkId } from "./work-selection";

export default function WorkArea({
	onSelectedWorkId,
	projectId,
	selectedWorkId,
	unavailableView,
}: {
	onSelectedWorkId?: (id: string | null) => void;
	projectId: string;
	selectedWorkId?: string | null;
	unavailableView?: string | null;
}) {
	const [archiveFilter, setArchiveFilter] = useState(false);
	const [bulkSelectedIds, setBulkSelectedIds] = useState<string[]>([]);
	const [filteredIds, setFilteredIds] = useState<string[] | null>(null);
	const [tagFilter, setTagFilter] = useState("");
	const [surface, setSurface] = useState<"list" | "priority-map">("list");
	const work = useQuery(
		orpc.workLifecycle.list.queryOptions({
			input: { archived: archiveFilter, projectId },
		})
	);
	const suggestions = useQuery(
		orpc.tags.suggest.queryOptions({ input: { projectId } })
	);
	const workTags = useQuery(
		orpc.tags.listWorkTags.queryOptions({ input: { projectId } })
	);
	const taggedRecords = useQuery({
		...orpc.tags.listRecords.queryOptions({
			input: { tagId: tagFilter },
		}),
		enabled: tagFilter !== "",
	});
	const [selectedId, setSelectedId] = useState<string | null>(
		selectedWorkId ?? null
	);

	useEffect(() => {
		if (selectedWorkId === undefined) {
			return;
		}
		setSelectedId(selectedWorkId);
	}, [selectedWorkId]);

	const onSelect = useCallback(
		(id: string) => {
			setSelectedId((current) => {
				const next = nextSelectedWorkId(current, id);
				onSelectedWorkId?.(next);
				return next;
			});
		},
		[onSelectedWorkId]
	);
	const onToggleBulkSelect = useCallback((id: string, checked: boolean) => {
		setBulkSelectedIds((current) =>
			nextBulkSelectedWorkIds(current, id, checked)
		);
	}, []);
	const onClearBulkSelect = useCallback(() => {
		setBulkSelectedIds([]);
	}, []);
	const onOpenSourceRecord = useCallback(
		(id: string) => {
			setSelectedId(id);
			onSelectedWorkId?.(id);
		},
		[onSelectedWorkId]
	);
	const onClose = useCallback(() => {
		setSelectedId(null);
		onSelectedWorkId?.(null);
	}, [onSelectedWorkId]);
	const onCreated = useCallback(
		(workId: string) => {
			setSelectedId(workId);
			setArchiveFilter(false);
			onSelectedWorkId?.(workId);
		},
		[onSelectedWorkId]
	);
	const onToggleArchiveFilter = useCallback(() => {
		setArchiveFilter((current) => !current);
		setSelectedId(null);
	}, []);
	const onTagFilter = useCallback((tagId: string) => {
		setTagFilter(tagId);
	}, []);
	const onTogglePriorityMap = useCallback(() => {
		setSurface((current) =>
			current === "priority-map" ? "list" : "priority-map"
		);
	}, []);

	useEffect(() => {
		if (!selectedId) {
			return;
		}
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				setSelectedId(null);
				onSelectedWorkId?.(null);
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => {
			window.removeEventListener("keydown", onKeyDown);
		};
	}, [onSelectedWorkId, selectedId]);

	const tagsByWork = useMemo(() => {
		const map = new Map<string, string[]>();
		for (const row of workTags.data ?? []) {
			map.set(row.workId, row.tagIds);
		}
		return map;
	}, [workTags.data]);
	const tagName = useMemo(() => {
		const map = new Map<string, string>();
		for (const tag of suggestions.data ?? []) {
			map.set(tag.id, tag.name);
		}
		return map;
	}, [suggestions.data]);

	if (work.isPending) {
		return (
			<div className="flex flex-col gap-3">
				<Skeleton className="h-8 w-48" />
				<p>{PROJECT_SHELL_COPY.loading}</p>
			</div>
		);
	}
	if (work.isError) {
		return <p role="alert">{PROJECT_SHELL_COPY.unavailable}</p>;
	}
	if (tagFilter !== "" && taggedRecords.isPending) {
		return <p>{PROJECT_SHELL_COPY.loading}</p>;
	}
	if (tagFilter !== "" && taggedRecords.isError) {
		return <p role="alert">{PROJECT_SHELL_COPY.unavailable}</p>;
	}

	const taggedIds = new Set(
		(taggedRecords.data ?? [])
			.filter((record) => record.projectId === projectId)
			.map((record) => record.id)
	);
	const items = work.data
		.filter((item) => tagFilter === "" || taggedIds.has(item.id))
		.filter((item) => filteredIds === null || filteredIds.includes(item.id))
		.map((item) => ({
			...item,
			tags: (tagsByWork.get(item.id) ?? [])
				.map((tagId) => tagName.get(tagId))
				.filter((name): name is string => Boolean(name)),
		}));
	const selected = items.find((item) => item.id === selectedId) ?? null;
	const bulkTargets = bulkEditTargetIds({
		selectedWorkIds: bulkSelectedIds,
		visibleWorkIds: items.map((item) => item.id),
	});

	let workSurface = (
		<WorkList
			bulkSelectedIds={bulkSelectedIds}
			items={items}
			onSelect={onSelect}
			onToggleBulkSelect={onToggleBulkSelect}
			selectedId={selectedId}
		/>
	);
	if (unavailableView) {
		workSurface = (
			<p className="text-muted-foreground text-sm">
				{PROJECT_SHELL_COPY.areaNotAvailable}
			</p>
		);
	} else if (surface === "priority-map") {
		workSurface = (
			<PriorityMap
				onSelectWork={onSelect}
				projectId={projectId}
				selectedWorkId={selectedId}
			/>
		);
	}

	return (
		<div className="flex flex-col gap-6">
			<div id={projectShellAnchor(PROJECT_SHELL_COPY.create)}>
				<CreateWorkForm onCreated={onCreated} projectId={projectId} />
			</div>
			<CreateFromTemplateForm onCreated={onCreated} projectId={projectId} />
			<PrioritizationSessionArea
				projectId={projectId}
				work={items.map((item) => ({ id: item.id, title: item.title }))}
			/>
			<div
				className="flex flex-wrap items-end gap-3"
				id={projectShellAnchor(PROJECT_SHELL_COPY.planning)}
			>
				<CustomFieldFilter
					onRecordIds={setFilteredIds}
					projectId={projectId}
					recordType="Work"
				/>
				<Button
					aria-pressed={archiveFilter}
					onClick={onToggleArchiveFilter}
					size="sm"
					type="button"
					variant={archiveFilter ? "secondary" : "ghost"}
				>
					{WORK_LIFECYCLE_COPY.archived}
				</Button>
				<TagFilter
					onChange={onTagFilter}
					tags={suggestions.data ?? []}
					value={tagFilter}
				/>
				<Button
					aria-pressed={surface === "priority-map"}
					onClick={onTogglePriorityMap}
					size="sm"
					type="button"
					variant={surface === "priority-map" ? "secondary" : "ghost"}
				>
					{PRIORITY_COPY.priorityMap}
				</Button>
			</div>
			{workSurface}
			{!unavailableView && surface === "list" && bulkTargets.length > 0 ? (
				<BulkEditPreview
					filterWorkIds={items.map((item) => item.id)}
					onClear={onClearBulkSelect}
					selectedWorkIds={bulkTargets}
				/>
			) : null}
			<ScopeTree
				onOpenSourceRecord={onOpenSourceRecord}
				openedRecordId={selectedId}
				projectId={projectId}
			/>
			{selected ? (
				<WorkDetail
					appliedTagIds={tagsByWork.get(selected.id) ?? []}
					candidates={items
						.filter((item) => item.id !== selected.id)
						.map((item) => ({
							id: item.id,
							key: item.key,
							title: item.title,
						}))}
					onClose={onClose}
					onDuplicated={onCreated}
					onMerged={onCreated}
					onOpenSourceRecord={onOpenSourceRecord}
					projectId={projectId}
					work={selected}
					works={items}
				/>
			) : null}
		</div>
	);
}
