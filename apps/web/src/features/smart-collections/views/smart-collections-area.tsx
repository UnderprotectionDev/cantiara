import { Button } from "@cantiara/ui/components/button";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
	type ChangeEvent,
	type DragEvent,
	type FormEvent,
	type MouseEvent,
	useCallback,
	useState,
} from "react";

import { FounderPage } from "@/features/personal-shell/components/founder-page";
import {
	FounderSection,
	FounderToolbar,
} from "@/features/personal-shell/components/founder-surface";
import { RECORD_DISCOVERY_COPY } from "@/features/record-discovery/views/record-discovery-copy";
import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { orpc, queryClient } from "@/utils/orpc";

import {
	BUILDER_FIELDS,
	type BuilderField,
	SMART_COLLECTIONS_COPY,
	SOURCE_KIND_OPTIONS,
} from "./smart-collections-copy";

interface MembershipCondition {
	field: BuilderField;
	operator: "equals";
	value: string;
}

interface CollectionSummary {
	id: string;
	name: string;
}

type InsightDimension = "status" | "effort" | "age" | "timeInStatus";

interface InsightSlice {
	dimension: InsightDimension;
	value: string;
}

interface InsightBucket {
	count: number;
	value: string;
}

function fieldLabel(field: string): string {
	switch (field) {
		case "projectId":
			return SMART_COLLECTIONS_COPY.project;
		case "scopeKind":
			return SMART_COLLECTIONS_COPY.scope;
		case "status":
			return SMART_COLLECTIONS_COPY.status;
		case "tagId":
			return SMART_COLLECTIONS_COPY.tags;
		case "type":
			return SMART_COLLECTIONS_COPY.type;
		default:
			return field;
	}
}

function builderFieldsFor(sourceKind: string): readonly BuilderField[] {
	if (
		sourceKind === RECORD_DISCOVERY_COPY.document ||
		sourceKind === RECORD_DISCOVERY_COPY.wikiDocument
	) {
		return BUILDER_FIELDS.filter((field) => field !== "status");
	}
	return BUILDER_FIELDS.filter((field) => field !== "scopeKind");
}

function CollectionList({
	collections,
	copy,
	onSelect,
	pending,
	selectedId,
}: {
	collections: readonly CollectionSummary[];
	copy: typeof SMART_COLLECTIONS_COPY;
	onSelect: (event: MouseEvent<HTMLButtonElement>) => void;
	pending: boolean;
	selectedId: string | null;
}) {
	if (pending) {
		return <p>{copy.loading}</p>;
	}
	if (collections.length === 0) {
		return <p>{copy.noneYet}</p>;
	}
	return (
		<ul className="mb-6 space-y-2">
			{collections.map((collection) => (
				<li key={collection.id}>
					<Button
						onClick={onSelect}
						type="button"
						value={collection.id}
						variant={selectedId === collection.id ? "default" : "outline"}
					>
						{collection.name}
					</Button>
				</li>
			))}
		</ul>
	);
}

function InsightGroup({
	buckets,
	copy,
	dimension,
	onSelect,
	title,
}: {
	buckets: readonly InsightBucket[];
	copy: typeof SMART_COLLECTIONS_COPY;
	dimension: InsightDimension;
	onSelect: (event: MouseEvent<HTMLButtonElement>) => void;
	title: string;
}) {
	return (
		<div className="mb-4">
			<h3 className="mb-2 font-medium text-sm">{title}</h3>
			{buckets.length === 0 ? (
				<p>{copy.empty}</p>
			) : (
				<ul className="flex flex-wrap gap-2">
					{buckets.map((bucket) => (
						<li key={`${dimension}-${bucket.value}`}>
							<Button
								onClick={onSelect}
								type="button"
								value={JSON.stringify({ dimension, value: bucket.value })}
								variant="outline"
							>
								{bucket.value} ({bucket.count})
							</Button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

function CollectionTabs({
	copy,
	onSelect,
	surface,
}: {
	copy: typeof SMART_COLLECTIONS_COPY;
	onSelect: (event: MouseEvent<HTMLButtonElement>) => void;
	surface: "members" | "insights";
}) {
	return (
		<div
			aria-label={copy.smartCollection}
			className="mb-6 flex flex-wrap gap-2"
			role="tablist"
		>
			<Button
				aria-selected={surface === "members"}
				onClick={onSelect}
				role="tab"
				type="button"
				value="members"
				variant={surface === "members" ? "default" : "outline"}
			>
				{copy.members}
			</Button>
			<Button
				aria-selected={surface === "insights"}
				onClick={onSelect}
				role="tab"
				type="button"
				value="insights"
				variant={surface === "insights" ? "default" : "outline"}
			>
				{copy.insights}
			</Button>
		</div>
	);
}

function InsightsPanel({
	copy,
	insights,
	onSelectSlice,
	onShowAllRecords,
	sliced,
}: {
	copy: typeof SMART_COLLECTIONS_COPY;
	insights: {
		age: readonly InsightBucket[];
		effort: readonly InsightBucket[];
		recordCount: number;
		status: readonly InsightBucket[];
		timeInStatus: readonly InsightBucket[];
	};
	onSelectSlice: (event: MouseEvent<HTMLButtonElement>) => void;
	onShowAllRecords: () => void;
	sliced: boolean;
}) {
	return (
		<FounderSection title={copy.insights} titleId="smart-collection-insights">
			<p className="mb-4">
				{copy.records}: {insights.recordCount}
			</p>
			{sliced ? (
				<Button
					className="mb-4"
					onClick={onShowAllRecords}
					type="button"
					variant="outline"
				>
					{copy.showAllRecords}
				</Button>
			) : null}
			<InsightGroup
				buckets={insights.status}
				copy={copy}
				dimension="status"
				onSelect={onSelectSlice}
				title={copy.status}
			/>
			<InsightGroup
				buckets={insights.effort}
				copy={copy}
				dimension="effort"
				onSelect={onSelectSlice}
				title={copy.effort}
			/>
			<InsightGroup
				buckets={insights.age}
				copy={copy}
				dimension="age"
				onSelect={onSelectSlice}
				title={copy.age}
			/>
			<InsightGroup
				buckets={insights.timeInStatus}
				copy={copy}
				dimension="timeInStatus"
				onSelect={onSelectSlice}
				title={copy.timeInStatus}
			/>
		</FounderSection>
	);
}

function SelectedCollectionView({
	copy,
	dragPreview,
	dropCandidates,
	insights,
	members,
	onAddCondition,
	onDragOver,
	onDragStart,
	onDrop,
	onInsightSlice,
	onPin,
	onShowAllRecords,
	onSurface,
	pinMessage,
	sliced,
	sourceKind,
	summary,
	surface,
	workCollection,
}: {
	copy: typeof SMART_COLLECTIONS_COPY;
	dragPreview: string | null;
	dropCandidates: readonly { id: string; title: string }[];
	insights: {
		age: readonly InsightBucket[];
		effort: readonly InsightBucket[];
		recordCount: number;
		status: readonly InsightBucket[];
		timeInStatus: readonly InsightBucket[];
	} | null;
	members: readonly {
		because: readonly { label: string }[];
		id: string;
		title: string;
	}[];
	onAddCondition: (event: FormEvent<HTMLFormElement>) => void;
	onDragOver: (event: DragEvent<HTMLElement>) => void;
	onDragStart: (event: DragEvent<HTMLButtonElement>) => void;
	onDrop: (event: DragEvent<HTMLElement>) => void;
	onInsightSlice: (event: MouseEvent<HTMLButtonElement>) => void;
	onPin: (event: MouseEvent<HTMLButtonElement>) => void;
	onShowAllRecords: () => void;
	onSurface: (event: MouseEvent<HTMLButtonElement>) => void;
	pinMessage: string | null;
	sliced: boolean;
	sourceKind: string;
	summary: string;
	surface: "members" | "insights";
	workCollection: boolean;
}) {
	return (
		<>
			<FounderSection
				title={copy.readableSummary}
				titleId="smart-collection-summary"
			>
				<p>{summary || copy.empty}</p>
				<form
					className="mt-3 flex flex-wrap items-end gap-3"
					onSubmit={onAddCondition}
				>
					<Field>
						<FieldLabel htmlFor="smart-collection-add-field">
							{copy.field}
						</FieldLabel>
						<NativeSelect
							defaultValue={builderFieldsFor(sourceKind)[0]}
							id="smart-collection-add-field"
							name="field"
						>
							{builderFieldsFor(sourceKind).map((field) => (
								<NativeSelectOption key={field} value={field}>
									{fieldLabel(field)}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</Field>
					<Field>
						<FieldLabel htmlFor="smart-collection-add-value">
							{copy.value}
						</FieldLabel>
						<Input id="smart-collection-add-value" name="value" type="text" />
					</Field>
					<Button type="submit">{copy.addCondition}</Button>
				</form>
			</FounderSection>
			{workCollection ? (
				<CollectionTabs copy={copy} onSelect={onSurface} surface={surface} />
			) : null}
			{workCollection && surface === "insights" && insights ? (
				<InsightsPanel
					copy={copy}
					insights={insights}
					onSelectSlice={onInsightSlice}
					onShowAllRecords={onShowAllRecords}
					sliced={sliced}
				/>
			) : null}
			{surface === "members" ? (
				<>
					<FounderSection
						title={copy.members}
						titleId="smart-collection-members"
					>
						{sliced ? (
							<Button
								className="mb-3"
								onClick={onShowAllRecords}
								type="button"
								variant="outline"
							>
								{copy.showAllRecords}
							</Button>
						) : null}
						{/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: drop previews a field write, not a pin */}
						<section
							aria-label={copy.dropHere}
							className="min-h-24 rounded-md border border-dashed p-3"
							onDragOver={onDragOver}
							onDrop={onDrop}
						>
							<p className="mb-3 text-muted-foreground text-sm">
								{copy.dropHere}
							</p>
							{members.length === 0 ? (
								<p>{copy.empty}</p>
							) : (
								<ul className="space-y-3">
									{members.map((member) => (
										<li key={member.id}>
											<div className="font-medium text-sm">{member.title}</div>
											<p className="text-muted-foreground text-sm">
												{copy.because}:{" "}
												{member.because
													.map((reason) => reason.label)
													.join("; ")}
											</p>
											<Button
												onClick={onPin}
												size="sm"
												type="button"
												value={member.id}
												variant="ghost"
											>
												{copy.pin}
											</Button>
										</li>
									))}
								</ul>
							)}
						</section>
						{pinMessage ? <p className="mt-3 text-sm">{pinMessage}</p> : null}
						{dragPreview ? <p className="mt-3 text-sm">{dragPreview}</p> : null}
					</FounderSection>
					<FounderSection
						title={copy.notMembers}
						titleId="smart-collection-not-members"
					>
						<ul className="space-y-2">
							{dropCandidates.map((record) => (
								<li key={record.id}>
									<Button
										draggable={true}
										onDragStart={onDragStart}
										type="button"
										value={record.id}
										variant="ghost"
									>
										{record.title}
									</Button>
								</li>
							))}
						</ul>
					</FounderSection>
				</>
			) : null}
		</>
	);
}

export default function SmartCollectionsArea() {
	const { attemptOnlineWork, markUnsaved } = useClientShell();
	const catalog = useQuery(orpc.smartCollections.catalog.queryOptions());
	const copy = catalog.data?.copy ?? SMART_COLLECTIONS_COPY;
	const list = useQuery(orpc.smartCollections.list.queryOptions());
	const projects = useQuery(orpc.projectShell.list.queryOptions());
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [createMessage, setCreateMessage] = useState<string | null>(null);
	const [pinMessage, setPinMessage] = useState<string | null>(null);
	const [dragPreview, setDragPreview] = useState<string | null>(null);
	const [slices, setSlices] = useState<InsightSlice[]>([]);
	const [surface, setSurface] = useState<"members" | "insights">("members");
	const [sourceKind, setSourceKind] = useState<string>(
		RECORD_DISCOVERY_COPY.work
	);
	const view = useQuery({
		...orpc.smartCollections.view.queryOptions({
			input: {
				collectionId: selectedId ?? "",
				slices,
			},
		}),
		enabled: Boolean(selectedId),
	});
	const invalidate = useCallback(
		async (collectionId?: string) => {
			await queryClient.invalidateQueries({
				queryKey: orpc.smartCollections.list.queryKey(),
			});
			const viewId = collectionId ?? selectedId;
			if (viewId) {
				await queryClient.invalidateQueries({
					queryKey: orpc.smartCollections.view.queryKey({
						input: { collectionId: viewId, slices },
					}),
				});
			}
		},
		[selectedId, slices]
	);
	const create = useMutation(
		orpc.smartCollections.create.mutationOptions({
			onSuccess: async (result) => {
				if (result.status !== "ok") {
					setCreateMessage(copy.couldNotCreate);
					return;
				}
				setCreateMessage(null);
				setSelectedId(result.collection.id);
				await invalidate(result.collection.id);
			},
		})
	);
	const update = useMutation(
		orpc.smartCollections.update.mutationOptions({
			onSuccess: async () => {
				await invalidate();
			},
		})
	);
	const pin = useMutation(
		orpc.smartCollections.pin.mutationOptions({
			onSuccess: (result) => {
				if (result.status === "refused") {
					setPinMessage(copy.noPin);
				}
			},
		})
	);
	const previewDrag = useMutation(
		orpc.smartCollections.previewDrag.mutationOptions({
			onSuccess: (result) => {
				if (result.status === "preview") {
					const writes = result.writes
						.map((write) => `${fieldLabel(write.field)} is ${write.value}`)
						.join(", ");
					setDragPreview(`${copy.dragPreview} ${writes}`);
					return;
				}
				setDragPreview(copy.alreadyMatches);
			},
		})
	);
	const collections = list.data ?? [];
	const members = view.data?.membership.members ?? [];
	const dropCandidates = view.data?.dropCandidates ?? [];
	const insights = view.data?.insights ?? null;
	const workCollection =
		view.data?.collection.sourceKind === RECORD_DISCOVERY_COPY.work;

	const onCreate = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			const form = new FormData(event.currentTarget);
			const name = String(form.get("name") ?? "");
			const projectValue = String(form.get("projectId") ?? "");
			const field = String(form.get("field") ?? "status") as BuilderField;
			const value = String(form.get("value") ?? "");
			const conditions: MembershipCondition[] =
				value.length > 0 ? [{ field, operator: "equals", value }] : [];
			setCreateMessage(null);
			markUnsaved();
			const result = attemptOnlineWork("record-create", () =>
				create.mutateAsync({
					conditions,
					name,
					projectId: projectValue.length > 0 ? projectValue : null,
					sourceKind,
				})
			);
			if (result.status === "refused") {
				setCreateMessage(copy.couldNotCreate);
			}
		},
		[attemptOnlineWork, copy.couldNotCreate, create, markUnsaved, sourceKind]
	);
	const onSourceKind = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
		setSourceKind(event.currentTarget.value);
	}, []);
	const onAddCondition = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			if (!(selectedId && view.data)) {
				return;
			}
			const form = new FormData(event.currentTarget);
			const field = String(form.get("field") ?? "status") as BuilderField;
			const value = String(form.get("value") ?? "");
			if (value.length === 0) {
				return;
			}
			update.mutate({
				collectionId: selectedId,
				conditions: [
					...view.data.collection.conditions,
					{ field, operator: "equals", value },
				],
				name: view.data.collection.name,
			});
		},
		[selectedId, update, view.data]
	);
	const onSelectCollection = useCallback(
		(event: MouseEvent<HTMLButtonElement>) => {
			setSelectedId(event.currentTarget.value);
			setPinMessage(null);
			setDragPreview(null);
			setSlices([]);
			setSurface("members");
		},
		[]
	);
	const onInsightSlice = useCallback((event: MouseEvent<HTMLButtonElement>) => {
		const parsed = JSON.parse(event.currentTarget.value) as InsightSlice;
		setSlices((current) => [
			...current.filter((item) => item.dimension !== parsed.dimension),
			parsed,
		]);
		setSurface("members");
	}, []);
	const onShowAllRecords = useCallback(() => {
		setSlices([]);
	}, []);
	const onSurface = useCallback((event: MouseEvent<HTMLButtonElement>) => {
		const next = event.currentTarget.value;
		if (next === "members" || next === "insights") {
			setSurface(next);
		}
	}, []);
	const onPin = useCallback(
		(event: MouseEvent<HTMLButtonElement>) => {
			if (!selectedId) {
				return;
			}
			pin.mutate({
				collectionId: selectedId,
				recordId: event.currentTarget.value,
			});
		},
		[pin, selectedId]
	);
	const onDragOver = useCallback((event: DragEvent<HTMLElement>) => {
		event.preventDefault();
	}, []);
	const onDrop = useCallback(
		(event: DragEvent<HTMLElement>) => {
			event.preventDefault();
			const recordId = event.dataTransfer.getData("text/plain");
			if (!(selectedId && recordId)) {
				return;
			}
			previewDrag.mutate({ collectionId: selectedId, recordId });
		},
		[previewDrag, selectedId]
	);
	const onDragStart = useCallback((event: DragEvent<HTMLButtonElement>) => {
		event.dataTransfer.setData("text/plain", event.currentTarget.value);
	}, []);

	return (
		<FounderPage title={copy.smartCollection}>
			<FounderToolbar>
				<form className="flex flex-wrap items-end gap-3" onSubmit={onCreate}>
					<Field>
						<FieldLabel htmlFor="smart-collection-name">{copy.name}</FieldLabel>
						<Input
							id="smart-collection-name"
							name="name"
							required={true}
							type="text"
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor="smart-collection-source">
							{copy.sourceKind}
						</FieldLabel>
						<NativeSelect
							id="smart-collection-source"
							name="sourceKind"
							onChange={onSourceKind}
							value={sourceKind}
						>
							{SOURCE_KIND_OPTIONS.map((kind) => (
								<NativeSelectOption key={kind} value={kind}>
									{kind}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</Field>
					<Field>
						<FieldLabel htmlFor="smart-collection-project">
							{copy.project}
						</FieldLabel>
						<NativeSelect
							defaultValue=""
							id="smart-collection-project"
							name="projectId"
						>
							<NativeSelectOption value="">
								{copy.allProjects}
							</NativeSelectOption>
							{(projects.data ?? []).map((project) => (
								<NativeSelectOption key={project.id} value={project.id}>
									{project.name}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</Field>
					<Field>
						<FieldLabel htmlFor="smart-collection-field">
							{copy.field}
						</FieldLabel>
						<NativeSelect
							defaultValue="status"
							id="smart-collection-field"
							name="field"
						>
							{builderFieldsFor(sourceKind).map((field) => (
								<NativeSelectOption key={field} value={field}>
									{fieldLabel(field)}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</Field>
					<Field>
						<FieldLabel htmlFor="smart-collection-value">
							{copy.value}
						</FieldLabel>
						<Input id="smart-collection-value" name="value" type="text" />
					</Field>
					<Button type="submit">{copy.create}</Button>
					{createMessage ? (
						<p className="basis-full text-sm">{createMessage}</p>
					) : null}
				</form>
			</FounderToolbar>
			<FounderSection title={copy.smartCollection} titleId="smart-collections">
				<CollectionList
					collections={collections}
					copy={copy}
					onSelect={onSelectCollection}
					pending={list.isPending}
					selectedId={selectedId}
				/>
			</FounderSection>
			{view.data ? (
				<SelectedCollectionView
					copy={copy}
					dragPreview={dragPreview}
					dropCandidates={dropCandidates}
					insights={insights}
					members={members}
					onAddCondition={onAddCondition}
					onDragOver={onDragOver}
					onDragStart={onDragStart}
					onDrop={onDrop}
					onInsightSlice={onInsightSlice}
					onPin={onPin}
					onShowAllRecords={onShowAllRecords}
					onSurface={onSurface}
					pinMessage={pinMessage}
					sliced={slices.length > 0}
					sourceKind={view.data.collection.sourceKind}
					summary={view.data.membership.summary}
					surface={surface}
					workCollection={workCollection}
				/>
			) : null}
		</FounderPage>
	);
}
