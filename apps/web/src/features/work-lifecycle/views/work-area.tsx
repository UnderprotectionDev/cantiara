import { Button } from "@cantiara/ui/components/button";
import { Skeleton } from "@cantiara/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
	BACKLOG_COPY,
	type BacklogSort,
} from "@/features/backlog/views/backlog-copy";
import PreparedBacklog from "@/features/backlog/views/prepared-backlog";
import BulkEditPreview from "@/features/bulk-editing/views/bulk-edit-preview";
import {
	bulkEditTargetIds,
	nextBulkSelectedWorkIds,
} from "@/features/bulk-editing/views/bulk-selection";
import CustomFieldFilter from "@/features/custom-fields/forms/custom-field-filter";
import KanbanBoard from "@/features/kanban/views/kanban-board";
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
	configurationMode = false,
	onSelectedWorkId,
	projectId,
	savedView,
	selectedWorkId,
	unavailableView,
}: {
	configurationMode?: boolean;
	onSelectedWorkId?: (id: string | null) => void;
	projectId: string;
	savedView?: string | null;
	selectedWorkId?: string | null;
	unavailableView?: string | null;
}) {
	const [archiveFilter, setArchiveFilter] = useState(false);
	const [bulkSelectedIds, setBulkSelectedIds] = useState<string[]>([]);
	const [filteredIds, setFilteredIds] = useState<string[] | null>(null);
	const [tagFilter, setTagFilter] = useState("");
	const [surface, setSurface] = useState<"list" | "priority-map">("list");
	const [backlogSort, setBacklogSort] = useState<BacklogSort | undefined>();
	const preparedBacklog = savedView === "Backlog";
	const work = useQuery({
		...orpc.workLifecycle.list.queryOptions({
			input: { archived: archiveFilter, projectId },
		}),
		enabled: !preparedBacklog,
	});
	const backlog = useQuery({
		...orpc.backlog.list.queryOptions({
			input: backlogSort ? { projectId, sort: backlogSort } : { projectId },
		}),
		enabled: preparedBacklog,
	});
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
	const onBacklogSort = useCallback((sort: BacklogSort) => {
		setBacklogSort(sort);
	}, []);
	const onSavedBacklogPresentation = useCallback(() => {
		setBacklogSort(undefined);
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

	const collection = preparedBacklog ? backlog : work;
	if (collection.isLoading) {
		return (
			<div className="flex flex-col gap-3">
				<Skeleton className="h-8 w-48" />
				<p>{PROJECT_SHELL_COPY.loading}</p>
			</div>
		);
	}
	if (collection.isError) {
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
	const source = preparedCollectionSource(
		preparedBacklog,
		backlog.data,
		work.data
	);
	const { bulkTargets, deferredItems, items, selected } = visibleWorkCollection(
		{
			deferred: source.deferred,
			filteredIds,
			records: source.records,
			selectedId,
			selectedWorkIds: bulkSelectedIds,
			tagFilter,
			taggedIds,
			tagName,
			tagsByWork,
		}
	);

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
			<WorkPlanningTools
				archiveFilter={archiveFilter}
				onRecordIds={setFilteredIds}
				onTagFilter={onTagFilter}
				onToggleArchiveFilter={onToggleArchiveFilter}
				onTogglePriorityMap={onTogglePriorityMap}
				preparedBacklog={preparedBacklog}
				priorityMapOpen={surface === "priority-map"}
				projectId={projectId}
				tagFilter={tagFilter}
				tags={suggestions.data ?? []}
			/>
			<WorkCollectionSurface
				bulkSelectedIds={bulkSelectedIds}
				configurationMode={configurationMode}
				deferred={deferredItems}
				items={items}
				onOpenSourceRecord={onOpenSourceRecord}
				onSavedPresentation={onSavedBacklogPresentation}
				onSelect={onSelect}
				onSortChange={onBacklogSort}
				onToggleBulkSelect={onToggleBulkSelect}
				preparedBacklog={preparedBacklog}
				presentationSort={backlogPresentationSort(
					backlogSort ?? backlog.data?.presentation.sort
				)}
				priorityMapOpen={surface === "priority-map"}
				projectId={projectId}
				savedView={savedView}
				selectedId={selectedId}
				unavailableView={unavailableView}
			/>
			{!unavailableView && surface === "list" && savedView !== "Board" ? (
				<BulkEditPreview
					filterWorkIds={items.map((item) => item.id)}
					projectId={projectId}
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

function WorkPlanningTools({
	archiveFilter,
	onRecordIds,
	onTagFilter,
	onToggleArchiveFilter,
	onTogglePriorityMap,
	preparedBacklog,
	priorityMapOpen,
	projectId,
	tagFilter,
	tags,
}: {
	archiveFilter: boolean;
	onRecordIds: (ids: string[] | null) => void;
	onTagFilter: (tagId: string) => void;
	onToggleArchiveFilter: () => void;
	onTogglePriorityMap: () => void;
	preparedBacklog: boolean;
	priorityMapOpen: boolean;
	projectId: string;
	tagFilter: string;
	tags: Array<{ id: string; name: string }>;
}) {
	return (
		<div
			className="flex flex-wrap items-end gap-3"
			id={projectShellAnchor(PROJECT_SHELL_COPY.planning)}
		>
			<CustomFieldFilter
				onRecordIds={onRecordIds}
				projectId={projectId}
				recordType="Work"
			/>
			{preparedBacklog ? null : (
				<Button
					aria-pressed={archiveFilter}
					onClick={onToggleArchiveFilter}
					size="sm"
					type="button"
					variant={archiveFilter ? "secondary" : "ghost"}
				>
					{WORK_LIFECYCLE_COPY.archived}
				</Button>
			)}
			<TagFilter onChange={onTagFilter} tags={tags} value={tagFilter} />
			<Button
				aria-pressed={priorityMapOpen}
				onClick={onTogglePriorityMap}
				size="sm"
				type="button"
				variant={priorityMapOpen ? "secondary" : "ghost"}
			>
				{PRIORITY_COPY.priorityMap}
			</Button>
		</div>
	);
}

function WorkCollectionSurface({
	bulkSelectedIds,
	configurationMode,
	deferred,
	items,
	onOpenSourceRecord,
	onSavedPresentation,
	onSelect,
	onSortChange,
	onToggleBulkSelect,
	preparedBacklog,
	presentationSort,
	priorityMapOpen,
	projectId,
	savedView,
	selectedId,
	unavailableView,
}: {
	bulkSelectedIds: string[];
	configurationMode: boolean;
	deferred: Array<{
		closureResult?: string | null;
		id: string;
		key: string;
		reappearDate?: string | null;
		status: string;
		tags?: string[];
		title: string;
		type: string;
	}>;
	items: Array<{
		archived?: boolean;
		closureResult?: string | null;
		id: string;
		key: string;
		lightChecklist?: Array<{ completed: boolean }>;
		reappearDate?: string | null;
		revision: number;
		status: string;
		tags?: string[];
		title: string;
		type: string;
	}>;
	onOpenSourceRecord: (id: string) => void;
	onSavedPresentation: () => void;
	onSelect: (id: string) => void;
	onSortChange: (sort: BacklogSort) => void;
	onToggleBulkSelect: (id: string, selected: boolean) => void;
	preparedBacklog: boolean;
	presentationSort: BacklogSort;
	priorityMapOpen: boolean;
	projectId: string;
	savedView?: string | null;
	selectedId: string | null;
	unavailableView?: string | null;
}) {
	if (unavailableView) {
		return (
			<p className="text-muted-foreground text-sm">
				{PROJECT_SHELL_COPY.areaNotAvailable}
			</p>
		);
	}
	if (savedView === "Board") {
		return (
			<KanbanBoard
				configurationMode={configurationMode}
				items={items}
				onOpenSourceRecord={onOpenSourceRecord}
				projectId={projectId}
				selectedWorkId={selectedId}
			/>
		);
	}
	if (priorityMapOpen) {
		return (
			<PriorityMap
				onSelectWork={onSelect}
				projectId={projectId}
				selectedWorkId={selectedId}
			/>
		);
	}
	if (preparedBacklog) {
		return (
			<PreparedBacklog
				bulkSelectedIds={bulkSelectedIds}
				deferred={deferred}
				items={items}
				onSavedPresentation={onSavedPresentation}
				onSelect={onSelect}
				onSortChange={onSortChange}
				onToggleBulkSelect={onToggleBulkSelect}
				presentationSort={presentationSort}
				projectId={projectId}
				selectedId={selectedId}
			/>
		);
	}
	return (
		<WorkList
			bulkSelectedIds={bulkSelectedIds}
			items={items}
			onSelect={onSelect}
			onToggleBulkSelect={onToggleBulkSelect}
			selectedId={selectedId}
		/>
	);
}

function backlogPresentationSort(sort: string | undefined): BacklogSort {
	if (
		sort === BACKLOG_COPY.manualOrder ||
		sort === BACKLOG_COPY.priority ||
		sort === BACKLOG_COPY.date ||
		sort === BACKLOG_COPY.field
	) {
		return sort;
	}
	return BACKLOG_COPY.manualOrder;
}

function preparedCollectionSource<T>(
	preparedBacklog: boolean,
	backlog: { deferred?: T[]; items?: T[] } | undefined,
	work: T[] | undefined
): { deferred: T[]; records: T[] } {
	if (preparedBacklog) {
		return {
			deferred: backlog?.deferred ?? [],
			records: backlog?.items ?? [],
		};
	}
	return { deferred: [], records: work ?? [] };
}

function visibleWorkCollection<T extends { id: string }>({
	deferred,
	filteredIds,
	records,
	selectedId,
	selectedWorkIds,
	tagFilter,
	taggedIds,
	tagName,
	tagsByWork,
}: {
	deferred: T[];
	filteredIds: string[] | null;
	records: T[];
	selectedId: string | null;
	selectedWorkIds: string[];
	tagFilter: string;
	taggedIds: Set<string>;
	tagName: Map<string, string>;
	tagsByWork: Map<string, string[]>;
}) {
	const items = taggedBacklogRecords({
		filteredIds,
		records,
		tagFilter,
		taggedIds,
		tagName,
		tagsByWork,
	});
	const deferredItems = taggedBacklogRecords({
		filteredIds,
		records: deferred,
		tagFilter,
		taggedIds,
		tagName,
		tagsByWork,
	});
	const visible = [...items, ...deferredItems];
	return {
		bulkTargets: bulkEditTargetIds({
			selectedWorkIds,
			visibleWorkIds: visible.map((item) => item.id),
		}),
		deferredItems,
		items,
		selected: visible.find((item) => item.id === selectedId) ?? null,
	};
}

function taggedBacklogRecords<
	T extends {
		id: string;
	},
>({
	filteredIds,
	records,
	tagFilter,
	taggedIds,
	tagName,
	tagsByWork,
}: {
	filteredIds: string[] | null;
	records: T[];
	tagFilter: string;
	taggedIds: Set<string>;
	tagName: Map<string, string>;
	tagsByWork: Map<string, string[]>;
}) {
	return records
		.filter((item) => tagFilter === "" || taggedIds.has(item.id))
		.filter((item) => filteredIds === null || filteredIds.includes(item.id))
		.map((item) => ({
			...item,
			tags: (tagsByWork.get(item.id) ?? [])
				.map((tagId) => tagName.get(tagId))
				.filter((name): name is string => Boolean(name)),
		}));
}
