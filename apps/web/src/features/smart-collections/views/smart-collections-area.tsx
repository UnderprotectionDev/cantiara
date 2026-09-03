import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
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
	const subscribe = useMutation(
		orpc.smartCollections.subscribe.mutationOptions({
			onSuccess: async () => {
				await invalidate();
			},
		})
	);
	const collections = list.data ?? [];
	const members = view.data?.membership.members ?? [];
	const dropCandidates = view.data?.dropCandidates ?? [];

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
		},
		[]
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
	const onSubscribeEntry = useCallback(
		(checked: boolean | "indeterminate") => {
			if (!selectedId) {
				return;
			}
			subscribe.mutate({
				collectionId: selectedId,
				onEntry: checked === true,
				onExit:
					checked === true
						? Boolean(view.data?.collection.subscribeOnExit)
						: false,
			});
		},
		[selectedId, subscribe, view.data?.collection.subscribeOnExit]
	);
	const onSubscribeExit = useCallback(
		(checked: boolean | "indeterminate") => {
			if (!selectedId) {
				return;
			}
			subscribe.mutate({
				collectionId: selectedId,
				onEntry: true,
				onExit: checked === true,
			});
		},
		[selectedId, subscribe]
	);

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
					<FounderSection
						title={copy.subscribe}
						titleId="smart-collection-subscribe"
					>
						<label
							className="flex items-center gap-2 text-sm"
							htmlFor="smart-collection-subscribe"
						>
							<Checkbox
								checked={Boolean(view.data.collection.subscribeOnEntry)}
								id="smart-collection-subscribe"
								onCheckedChange={onSubscribeEntry}
							/>
							{copy.subscribe}
						</label>
						<label
							className="mt-3 flex items-center gap-2 text-sm"
							htmlFor="smart-collection-notify-on-leave"
						>
							<Checkbox
								checked={Boolean(view.data.collection.subscribeOnExit)}
								disabled={!view.data.collection.subscribeOnEntry}
								id="smart-collection-notify-on-leave"
								onCheckedChange={onSubscribeExit}
							/>
							{copy.notifyOnLeave}
						</label>
					</FounderSection>
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
		</FounderPage>
	);
}
