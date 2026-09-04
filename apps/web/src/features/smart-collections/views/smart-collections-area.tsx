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
	useMemo,
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
	allowedPresentationsFor,
	BUILDER_FIELDS,
	type BuilderField,
	type Presentation,
	SMART_COLLECTIONS_COPY,
	SOURCE_KIND_OPTIONS,
} from "./smart-collections-copy";
import {
	MembershipBody,
	NamedViewSection,
	NewWorkSection,
	useSyncedNamedView,
} from "./smart-collections-named-view";
import {
	draftFromView,
	type NamedViewSummary,
} from "./smart-collections-named-view-model";

interface MembershipCondition {
	field: BuilderField;
	operator: "equals";
	value: string;
}

interface CollectionSummary {
	id: string;
	name: string;
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

function prefillEquals(
	conditions: readonly { field: string; operator: string; value: string }[]
): { projectId?: string; status?: string; type?: string } {
	const next: { projectId?: string; status?: string; type?: string } = {};
	for (const condition of conditions) {
		if (condition.operator !== "equals") {
			continue;
		}
		if (condition.field === "status") {
			next.status = condition.value;
		}
		if (condition.field === "type") {
			next.type = condition.value;
		}
		if (condition.field === "projectId") {
			next.projectId = condition.value;
		}
	}
	return next;
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

function CreateCollectionForm({
	copy,
	createMessage,
	onSourceKind,
	onSubmit,
	projects,
	sourceKind,
}: {
	copy: typeof SMART_COLLECTIONS_COPY;
	createMessage: string | null;
	onSourceKind: (event: ChangeEvent<HTMLSelectElement>) => void;
	onSubmit: (event: FormEvent<HTMLFormElement>) => void;
	projects: readonly { id: string; name: string }[];
	sourceKind: string;
}) {
	return (
		<form className="flex flex-wrap items-end gap-3" onSubmit={onSubmit}>
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
					<NativeSelectOption value="">{copy.allProjects}</NativeSelectOption>
					{projects.map((project) => (
						<NativeSelectOption key={project.id} value={project.id}>
							{project.name}
						</NativeSelectOption>
					))}
				</NativeSelect>
			</Field>
			<Field>
				<FieldLabel htmlFor="smart-collection-field">{copy.field}</FieldLabel>
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
				<FieldLabel htmlFor="smart-collection-value">{copy.value}</FieldLabel>
				<Input id="smart-collection-value" name="value" type="text" />
			</Field>
			<Button type="submit">{copy.create}</Button>
			{createMessage ? (
				<p className="basis-full text-sm">{createMessage}</p>
			) : null}
		</form>
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
	const [sourceKind, setSourceKind] = useState<string>(
		RECORD_DISCOVERY_COPY.work
	);
	const [saveAsName, setSaveAsName] = useState("");
	const [newWorkMessage, setNewWorkMessage] = useState<string | null>(null);
	const view = useQuery({
		...orpc.smartCollections.view.queryOptions({
			input: { collectionId: selectedId ?? "" },
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
						input: { collectionId: viewId },
					}),
				});
			}
		},
		[selectedId]
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
	const persistView = useMutation(
		orpc.smartCollections.saveNamedView.mutationOptions({
			onSuccess: async (result) => {
				if (result.status === "ok") {
					setDraft(draftFromView(result.view as NamedViewSummary));
				}
				await invalidate();
			},
		})
	);
	const persistAsView = useMutation(
		orpc.smartCollections.saveAsNamedView.mutationOptions({
			onSuccess: async (result) => {
				setSaveAsName("");
				if (result.status === "ok") {
					setSelectedViewId(result.view.id);
					setDraft(draftFromView(result.view as NamedViewSummary));
				}
				await invalidate();
			},
		})
	);
	const createWork = useMutation(
		orpc.smartCollections.newWork.mutationOptions({
			onSuccess: async (result) => {
				if (result.status !== "ok") {
					return;
				}
				setNewWorkMessage(result.missWarning);
				await invalidate();
			},
		})
	);
	const namedViews = (view.data?.namedViews ?? []) as NamedViewSummary[];
	const {
		dirty,
		draft,
		savedView,
		selectedViewId,
		setDraft,
		setSelectedViewId,
	} = useSyncedNamedView(namedViews);
	const collections = list.data ?? [];
	const members = view.data?.membership.members ?? [];
	const presented = useMemo(() => {
		if (!draft) {
			return members;
		}
		const filter = draft.filterText.trim().toLowerCase();
		let rows = members;
		if (filter.length > 0) {
			rows = rows.filter((member) =>
				member.title.toLowerCase().includes(filter)
			);
		}
		if (draft.sortField === "title") {
			const direction = draft.sortDirection === "desc" ? -1 : 1;
			rows = [...rows].sort(
				(left, right) => left.title.localeCompare(right.title) * direction
			);
		}
		return rows;
	}, [draft, members]);
	const dropCandidates = view.data?.dropCandidates ?? [];
	const presentations = allowedPresentationsFor(
		view.data?.collection.sourceKind ?? sourceKind
	);
	const newWorkValues = prefillEquals(view.data?.collection.conditions ?? []);

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
			setSelectedViewId(null);
			setDraft(null);
			setPinMessage(null);
			setDragPreview(null);
			setNewWorkMessage(null);
		},
		[setDraft, setSelectedViewId]
	);
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
	const onSaveView = useCallback(() => {
		if (!(selectedId && selectedViewId && draft)) {
			return;
		}
		persistView.mutate({
			collectionId: selectedId,
			draft: {
				...draft,
				purpose: draft.purpose,
				visibleFields: [...draft.visibleFields],
			},
			viewId: selectedViewId,
		});
	}, [draft, persistView, selectedId, selectedViewId]);
	const onRevertView = useCallback(() => {
		if (savedView) {
			setDraft(draftFromView(savedView));
		}
	}, [savedView, setDraft]);
	const onSaveAsView = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			if (!(selectedId && draft && saveAsName.trim().length > 0)) {
				return;
			}
			persistAsView.mutate({
				collectionId: selectedId,
				draft: {
					...draft,
					visibleFields: [...draft.visibleFields],
				},
				name: saveAsName,
			});
		},
		[draft, persistAsView, saveAsName, selectedId]
	);
	const onNewWork = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			if (!selectedId) {
				return;
			}
			const form = new FormData(event.currentTarget);
			const title = String(form.get("title") ?? "");
			const type = String(form.get("type") ?? "");
			const status = String(form.get("status") ?? "");
			const projectId = String(form.get("projectId") ?? "");
			createWork.mutate({
				collectionId: selectedId,
				draft: {
					projectId: projectId.length > 0 ? projectId : undefined,
					status: status.length > 0 ? status : undefined,
					title,
					type: type.length > 0 ? type : undefined,
				},
				idempotencyKey: crypto.randomUUID(),
			});
		},
		[createWork, selectedId]
	);
	const onChangeNamedView = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			const next = namedViews.find(
				(item) => item.id === event.currentTarget.value
			);
			if (!next) {
				return;
			}
			setSelectedViewId(next.id);
			setDraft(draftFromView(next));
		},
		[namedViews, setDraft, setSelectedViewId]
	);
	const onChangePresentation = useCallback(
		(event: MouseEvent<HTMLButtonElement>) => {
			if (!draft) {
				return;
			}
			const next = event.currentTarget.value as Presentation;
			setDraft({
				...draft,
				presentation: next,
			});
		},
		[draft, setDraft]
	);
	const onFilter = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			if (!draft) {
				return;
			}
			setDraft({
				...draft,
				filterText: event.currentTarget.value,
			});
		},
		[draft, setDraft]
	);
	const onPurpose = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			if (!draft) {
				return;
			}
			const next = event.currentTarget.value;
			setDraft({
				...draft,
				purpose: next.trim().length === 0 ? null : next,
			});
		},
		[draft, setDraft]
	);
	const onSort = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			if (!draft) {
				return;
			}
			const { value } = event.currentTarget;
			setDraft({
				...draft,
				sortDirection: value === "" ? null : "asc",
				sortField: value === "" ? null : value,
			});
		},
		[draft, setDraft]
	);
	const onSaveAsName = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setSaveAsName(event.currentTarget.value);
	}, []);

	return (
		<FounderPage title={copy.smartCollection}>
			<FounderToolbar>
				<CreateCollectionForm
					copy={copy}
					createMessage={createMessage}
					onSourceKind={onSourceKind}
					onSubmit={onCreate}
					projects={projects.data ?? []}
					sourceKind={sourceKind}
				/>
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
				<>
					<FounderSection
						title={copy.readableSummary}
						titleId="smart-collection-summary"
					>
						<p>{view.data.membership.summary || copy.empty}</p>
						<form
							className="mt-3 flex flex-wrap items-end gap-3"
							onSubmit={onAddCondition}
						>
							<Field>
								<FieldLabel htmlFor="smart-collection-add-field">
									{copy.field}
								</FieldLabel>
								<NativeSelect
									defaultValue={
										builderFieldsFor(view.data.collection.sourceKind)[0]
									}
									id="smart-collection-add-field"
									name="field"
								>
									{builderFieldsFor(view.data.collection.sourceKind).map(
										(field) => (
											<NativeSelectOption key={field} value={field}>
												{fieldLabel(field)}
											</NativeSelectOption>
										)
									)}
								</NativeSelect>
							</Field>
							<Field>
								<FieldLabel htmlFor="smart-collection-add-value">
									{copy.value}
								</FieldLabel>
								<Input
									id="smart-collection-add-value"
									name="value"
									type="text"
								/>
							</Field>
							<Button type="submit">{copy.addCondition}</Button>
						</form>
					</FounderSection>
					{draft ? (
						<NamedViewSection
							copy={copy}
							dirty={dirty}
							draft={draft}
							gallerySourceKind={view.data.collection.sourceKind}
							namedViews={namedViews}
							onChangeNamedView={onChangeNamedView}
							onChangePresentation={onChangePresentation}
							onFilter={onFilter}
							onPurpose={onPurpose}
							onRevert={onRevertView}
							onSave={onSaveView}
							onSaveAs={onSaveAsView}
							onSaveAsName={onSaveAsName}
							onSort={onSort}
							presentations={presentations}
							saveAsName={saveAsName}
							selectedViewId={selectedViewId}
						/>
					) : null}
					{view.data.collection.sourceKind === RECORD_DISCOVERY_COPY.work ? (
						<NewWorkSection
							collectionProjectId={view.data.collection.projectId}
							copy={copy}
							message={newWorkMessage}
							onSubmit={onNewWork}
							prefill={newWorkValues}
							projects={projects.data ?? []}
						/>
					) : null}
					<FounderSection
						title={copy.members}
						titleId="smart-collection-members"
					>
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
							<MembershipBody
								copy={copy}
								onPin={onPin}
								presentation={draft?.presentation}
								presented={presented}
							/>
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
		</FounderPage>
	);
}
