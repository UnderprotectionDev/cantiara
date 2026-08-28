import { Button } from "@cantiara/ui/components/button";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { FounderPage } from "@/features/personal-shell/components/founder-page";
import { orpc, queryClient } from "@/utils/orpc";

import { WORKSPACE_OVERVIEW_UI_COPY } from "./workspace-overview-copy";

interface OverviewRecordView {
	detail: string | null;
	id: string;
	title: string;
}

interface OverviewModuleView {
	count: number;
	heading: string;
	hidden: boolean;
	records: OverviewRecordView[];
}

interface LiveBlockView {
	kind: "document" | "smartCollection";
	sourceId: string;
	title: string;
}

interface OverviewCopy {
	addLiveBlock: string;
	hide: string;
	moveDown: string;
	moveUp: string;
	remove: string;
	show: string;
	workspace: string;
}

interface OverviewLayout {
	hidden: readonly string[];
	liveBlocks: ReadonlyArray<{ kind: string; sourceId: string }>;
	order: readonly string[];
}

const MODULE_HEADINGS = [
	"Active Projects",
	"Attention Required",
	"Upcoming",
	"Recent Work",
] as const;

type ModuleHeading = (typeof MODULE_HEADINGS)[number];

function isModuleHeading(value: string): value is ModuleHeading {
	return (MODULE_HEADINGS as readonly string[]).includes(value);
}

function isLiveBlockKind(
	value: string
): value is "document" | "smartCollection" {
	return value === "document" || value === "smartCollection";
}

export default function WorkspaceOverview() {
	const overview = useQuery(orpc.workspaceOverview.get.queryOptions());
	const saveLayout = useMutation(
		orpc.workspaceOverview.saveLayout.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: orpc.workspaceOverview.get.queryKey(),
				});
			},
		})
	);
	const [openedHeadings, setOpenedHeadings] = useState<readonly string[]>([]);
	const [openedRecordId, setOpenedRecordId] = useState<string | null>(null);
	const persist = useCallback(
		(next: OverviewLayout) => {
			saveLayout.mutate({
				hidden: next.hidden.filter(isModuleHeading),
				liveBlocks: next.liveBlocks.flatMap((block) =>
					isLiveBlockKind(block.kind)
						? [{ kind: block.kind, sourceId: block.sourceId }]
						: []
				),
				order: next.order.filter(isModuleHeading),
			});
		},
		[saveLayout]
	);

	if (overview.isPending) {
		return (
			<FounderPage title={WORKSPACE_OVERVIEW_UI_COPY.workspace}>
				<p>{WORKSPACE_OVERVIEW_UI_COPY.loading}</p>
			</FounderPage>
		);
	}
	if (overview.isError || !overview.data) {
		return (
			<FounderPage title={WORKSPACE_OVERVIEW_UI_COPY.workspace}>
				<p role="alert">{WORKSPACE_OVERVIEW_UI_COPY.unavailable}</p>
			</FounderPage>
		);
	}

	const { data } = overview;
	const { layout } = data;
	const orderedCatalog = orderCatalog(data.catalog, layout.order);
	const visible = orderedCatalog.filter((module) => !module.hidden);
	const hidden = orderedCatalog.filter((module) => module.hidden);

	return (
		<FounderPage title={data.copy.workspace}>
			<div className="flex flex-col divide-y border-y">
				{visible.map((module, index) => (
					<OverviewModule
						canMoveDown={index < visible.length - 1}
						canMoveUp={index > 0}
						copy={data.copy}
						key={module.heading}
						layout={layout}
						module={module}
						opened={openedHeadings.includes(module.heading)}
						openedRecordId={openedRecordId}
						openSourceRecord={data.openSourceRecord}
						persist={persist}
						setOpenedHeadings={setOpenedHeadings}
						setOpenedRecordId={setOpenedRecordId}
					/>
				))}
			</div>
			{hidden.length > 0 ? (
				<ul className="mt-6 flex flex-col gap-2">
					{hidden.map((module) => (
						<HiddenModuleRow
							copy={data.copy}
							key={module.heading}
							layout={layout}
							module={module}
							persist={persist}
						/>
					))}
				</ul>
			) : null}
			<LiveBlocks
				available={data.availableLiveBlocks}
				blocks={data.liveBlocks}
				copy={data.copy}
				layout={layout}
				openedRecordId={openedRecordId}
				openSourceRecord={data.openSourceRecord}
				persist={persist}
				setOpenedRecordId={setOpenedRecordId}
			/>
		</FounderPage>
	);
}

function orderCatalog(
	catalog: readonly OverviewModuleView[],
	order: readonly string[]
): OverviewModuleView[] {
	const byHeading = new Map(catalog.map((module) => [module.heading, module]));
	return order.flatMap((heading) => {
		const module = byHeading.get(heading);
		return module ? [module] : [];
	});
}

function moveHeading(
	order: readonly string[],
	heading: string,
	direction: "down" | "up"
): string[] {
	const next = [...order];
	const index = next.indexOf(heading);
	const target = direction === "up" ? index - 1 : index + 1;
	if (index < 0 || target < 0 || target >= next.length) {
		return next;
	}
	const [moved] = next.splice(index, 1);
	if (!moved) {
		return next;
	}
	next.splice(target, 0, moved);
	return next;
}

function OverviewModule({
	canMoveDown,
	canMoveUp,
	copy,
	layout,
	module,
	opened,
	openedRecordId,
	openSourceRecord,
	persist,
	setOpenedHeadings,
	setOpenedRecordId,
}: {
	canMoveDown: boolean;
	canMoveUp: boolean;
	copy: OverviewCopy;
	layout: OverviewLayout;
	module: OverviewModuleView;
	opened: boolean;
	openedRecordId: string | null;
	openSourceRecord: string;
	persist: (layout: OverviewLayout) => void;
	setOpenedHeadings: (
		value:
			| readonly string[]
			| ((current: readonly string[]) => readonly string[])
	) => void;
	setOpenedRecordId: (recordId: string) => void;
}) {
	const onToggle = useCallback(() => {
		setOpenedHeadings((current) =>
			current.includes(module.heading)
				? current.filter((item) => item !== module.heading)
				: [...current, module.heading]
		);
	}, [module.heading, setOpenedHeadings]);
	const onHide = useCallback(() => {
		persist({
			...layout,
			hidden: layout.hidden.includes(module.heading)
				? layout.hidden
				: [...layout.hidden, module.heading],
		});
	}, [layout, module.heading, persist]);
	const onMoveUp = useCallback(() => {
		persist({
			...layout,
			order: moveHeading(layout.order, module.heading, "up"),
		});
	}, [layout, module.heading, persist]);
	const onMoveDown = useCallback(() => {
		persist({
			...layout,
			order: moveHeading(layout.order, module.heading, "down"),
		});
	}, [layout, module.heading, persist]);

	return (
		<section aria-label={module.heading}>
			<div className="flex flex-wrap items-center gap-2 py-3">
				<h2 className="min-w-0 flex-1">
					<Button
						aria-expanded={opened}
						aria-label={`${openSourceRecord}: ${module.heading} ${module.count}`}
						className="h-auto w-full justify-between px-0 py-0 font-medium text-sm"
						onClick={onToggle}
						type="button"
						variant="ghost"
					>
						<span>{module.heading}</span>
						<span className="font-normal text-muted-foreground tabular-nums">
							{module.count}
						</span>
					</Button>
				</h2>
				<Button onClick={onHide} type="button" variant="outline">
					{copy.hide}
				</Button>
				<Button
					disabled={!canMoveUp}
					onClick={onMoveUp}
					type="button"
					variant="ghost"
				>
					{copy.moveUp}
				</Button>
				<Button
					disabled={!canMoveDown}
					onClick={onMoveDown}
					type="button"
					variant="ghost"
				>
					{copy.moveDown}
				</Button>
			</div>
			{opened && module.records.length > 0 ? (
				<ul className="pb-3">
					{module.records.map((record) => (
						<OverviewSourceRow
							key={record.id}
							opened={openedRecordId === record.id}
							openSourceRecord={openSourceRecord}
							record={record}
							setOpenedRecordId={setOpenedRecordId}
						/>
					))}
				</ul>
			) : null}
		</section>
	);
}

function HiddenModuleRow({
	copy,
	layout,
	module,
	persist,
}: {
	copy: OverviewCopy;
	layout: OverviewLayout;
	module: OverviewModuleView;
	persist: (layout: OverviewLayout) => void;
}) {
	const onShow = useCallback(() => {
		persist({
			...layout,
			hidden: layout.hidden.filter((item) => item !== module.heading),
		});
	}, [layout, module.heading, persist]);
	return (
		<li>
			{module.heading}{" "}
			<Button onClick={onShow} type="button" variant="outline">
				{copy.show}
			</Button>
		</li>
	);
}

function OverviewSourceRow({
	opened,
	openSourceRecord,
	record,
	setOpenedRecordId,
}: {
	opened: boolean;
	openSourceRecord: string;
	record: OverviewRecordView;
	setOpenedRecordId: (recordId: string) => void;
}) {
	const onClick = useCallback(() => {
		setOpenedRecordId(record.id);
	}, [record.id, setOpenedRecordId]);
	return (
		<li>
			{record.title}
			{record.detail ? ` · ${record.detail}` : null}{" "}
			<Button
				aria-pressed={opened}
				onClick={onClick}
				type="button"
				variant="outline"
			>
				{openSourceRecord}
			</Button>
		</li>
	);
}

function LiveBlocks({
	available,
	blocks,
	copy,
	layout,
	openedRecordId,
	openSourceRecord,
	persist,
	setOpenedRecordId,
}: {
	available: readonly LiveBlockView[];
	blocks: readonly LiveBlockView[];
	copy: OverviewCopy;
	layout: OverviewLayout;
	openedRecordId: string | null;
	openSourceRecord: string;
	persist: (layout: OverviewLayout) => void;
	setOpenedRecordId: (recordId: string) => void;
}) {
	if (blocks.length === 0 && available.length === 0) {
		return null;
	}
	return (
		<section aria-label={copy.addLiveBlock} className="mt-8">
			<h2 className="font-medium text-sm">{copy.addLiveBlock}</h2>
			{blocks.length > 0 ? (
				<ul className="mt-2 flex flex-col gap-2">
					{blocks.map((block) => (
						<PlacedLiveBlockRow
							block={block}
							copy={copy}
							key={block.sourceId}
							layout={layout}
							opened={openedRecordId === block.sourceId}
							openSourceRecord={openSourceRecord}
							persist={persist}
							setOpenedRecordId={setOpenedRecordId}
						/>
					))}
				</ul>
			) : null}
			{available.length > 0 ? (
				<ul className="mt-3 flex flex-col gap-2">
					{available.map((block) => (
						<AvailableLiveBlockRow
							block={block}
							copy={copy}
							key={block.sourceId}
							layout={layout}
							persist={persist}
						/>
					))}
				</ul>
			) : null}
		</section>
	);
}

function PlacedLiveBlockRow({
	block,
	copy,
	layout,
	opened,
	openSourceRecord,
	persist,
	setOpenedRecordId,
}: {
	block: LiveBlockView;
	copy: OverviewCopy;
	layout: OverviewLayout;
	opened: boolean;
	openSourceRecord: string;
	persist: (layout: OverviewLayout) => void;
	setOpenedRecordId: (recordId: string) => void;
}) {
	const onOpen = useCallback(() => {
		setOpenedRecordId(block.sourceId);
	}, [block.sourceId, setOpenedRecordId]);
	const onRemove = useCallback(() => {
		persist({
			...layout,
			liveBlocks: layout.liveBlocks.filter(
				(item) => item.sourceId !== block.sourceId
			),
		});
	}, [block.sourceId, layout, persist]);
	return (
		<li>
			{block.title}{" "}
			<Button
				aria-pressed={opened}
				onClick={onOpen}
				type="button"
				variant="outline"
			>
				{openSourceRecord}
			</Button>{" "}
			<Button onClick={onRemove} type="button" variant="ghost">
				{copy.remove}
			</Button>
		</li>
	);
}

function AvailableLiveBlockRow({
	block,
	copy,
	layout,
	persist,
}: {
	block: LiveBlockView;
	copy: OverviewCopy;
	layout: OverviewLayout;
	persist: (layout: OverviewLayout) => void;
}) {
	const onAdd = useCallback(() => {
		persist({
			...layout,
			liveBlocks: [
				...layout.liveBlocks,
				{ kind: block.kind, sourceId: block.sourceId },
			],
		});
	}, [block.kind, block.sourceId, layout, persist]);
	return (
		<li>
			{block.title}{" "}
			<Button onClick={onAdd} type="button" variant="outline">
				{copy.addLiveBlock}
			</Button>
		</li>
	);
}
