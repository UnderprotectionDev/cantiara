import { Button } from "@cantiara/ui/components/button";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import {
	type ChangeEvent,
	type FormEvent,
	type MouseEvent,
	useCallback,
	useEffect,
	useState,
} from "react";

import { FounderSection } from "@/features/personal-shell/components/founder-surface";

import {
	galleryAllowedFor,
	type Presentation,
	presentationLabel,
	type SMART_COLLECTIONS_COPY,
} from "./smart-collections-copy";
import {
	draftFromView,
	isDraftDirty,
	liveNewWorkMiss,
	type NamedViewSummary,
	type PresentationDraft,
} from "./smart-collections-named-view-model";

interface MemberRow {
	because: readonly { label: string }[];
	id: string;
	title: string;
}

export function useSyncedNamedView(namedViews: readonly NamedViewSummary[]) {
	const [selectedViewId, setSelectedViewId] = useState<string | null>(null);
	const [draft, setDraft] = useState<PresentationDraft | null>(null);
	useEffect(() => {
		if (namedViews.length === 0) {
			setSelectedViewId(null);
			setDraft(null);
			return;
		}
		const current =
			namedViews.find((item) => item.id === selectedViewId) ??
			namedViews.find((item) => item.isDefault) ??
			namedViews[0];
		if (!current) {
			return;
		}
		if (current.id !== selectedViewId) {
			setSelectedViewId(current.id);
			setDraft(draftFromView(current));
			return;
		}
		if (!draft) {
			setDraft(draftFromView(current));
		}
	}, [namedViews, selectedViewId, draft]);
	const savedView =
		namedViews.find((item) => item.id === selectedViewId) ?? null;
	const dirty = Boolean(savedView && draft && isDraftDirty(savedView, draft));
	return {
		dirty,
		draft,
		savedView,
		selectedViewId,
		setDraft,
		setSelectedViewId,
	};
}

export function NamedViewSection({
	copy,
	dirty,
	draft,
	gallerySourceKind,
	namedViews,
	onChangeNamedView,
	onChangePresentation,
	onFilter,
	onPurpose,
	onRevert,
	onSave,
	onSaveAs,
	onSaveAsName,
	onSort,
	presentations,
	saveAsName,
	selectedViewId,
}: {
	copy: typeof SMART_COLLECTIONS_COPY;
	dirty: boolean;
	draft: PresentationDraft;
	gallerySourceKind: string;
	namedViews: readonly NamedViewSummary[];
	onChangeNamedView: (event: ChangeEvent<HTMLSelectElement>) => void;
	onChangePresentation: (event: MouseEvent<HTMLButtonElement>) => void;
	onFilter: (event: ChangeEvent<HTMLInputElement>) => void;
	onPurpose: (event: ChangeEvent<HTMLInputElement>) => void;
	onRevert: () => void;
	onSave: () => void;
	onSaveAs: (event: FormEvent<HTMLFormElement>) => void;
	onSaveAsName: (event: ChangeEvent<HTMLInputElement>) => void;
	onSort: (event: ChangeEvent<HTMLSelectElement>) => void;
	presentations: readonly Presentation[];
	saveAsName: string;
	selectedViewId: string | null;
}) {
	return (
		<FounderSection
			title={copy.namedView}
			titleId="smart-collection-named-view"
		>
			<div className="flex flex-wrap items-end gap-3">
				<Field>
					<FieldLabel htmlFor="smart-collection-named-view-select">
						{copy.namedView}
					</FieldLabel>
					<NativeSelect
						id="smart-collection-named-view-select"
						onChange={onChangeNamedView}
						value={selectedViewId ?? ""}
					>
						{namedViews.map((item) => (
							<NativeSelectOption key={item.id} value={item.id}>
								{item.name}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</Field>
				<fieldset className="flex flex-wrap gap-2">
					<legend className="sr-only">{copy.namedView}</legend>
					{presentations.map((item) => (
						<Button
							key={item}
							onClick={onChangePresentation}
							type="button"
							value={item}
							variant={draft.presentation === item ? "default" : "outline"}
						>
							{presentationLabel(item)}
						</Button>
					))}
				</fieldset>
				<Field>
					<FieldLabel htmlFor="smart-collection-filter">
						{copy.filter}
					</FieldLabel>
					<Input
						id="smart-collection-filter"
						onChange={onFilter}
						value={draft.filterText}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="smart-collection-sort">{copy.sort}</FieldLabel>
					<NativeSelect
						id="smart-collection-sort"
						onChange={onSort}
						value={draft.sortField ?? ""}
					>
						<NativeSelectOption value="">{copy.none}</NativeSelectOption>
						<NativeSelectOption value="title">{copy.title}</NativeSelectOption>
					</NativeSelect>
				</Field>
			</div>
			<Field className="mt-3 max-w-xl">
				<FieldLabel htmlFor="smart-collection-purpose">
					{copy.purpose}
				</FieldLabel>
				<Input
					id="smart-collection-purpose"
					onChange={onPurpose}
					value={draft.purpose ?? ""}
				/>
			</Field>
			{dirty ? (
				<div className="mt-3 flex flex-wrap items-end gap-3">
					<p className="basis-full text-sm">{copy.unsavedChanges}</p>
					<Button onClick={onSave} type="button">
						{copy.save}
					</Button>
					<Button onClick={onRevert} type="button" variant="outline">
						{copy.revert}
					</Button>
					<form className="flex flex-wrap items-end gap-3" onSubmit={onSaveAs}>
						<Field>
							<FieldLabel htmlFor="smart-collection-save-as">
								{copy.saveAs}
							</FieldLabel>
							<Input
								id="smart-collection-save-as"
								onChange={onSaveAsName}
								value={saveAsName}
							/>
						</Field>
						<Button type="submit">{copy.saveAs}</Button>
					</form>
				</div>
			) : null}
			{draft.presentation === "Gallery" &&
			!galleryAllowedFor(gallerySourceKind) ? (
				<p className="mt-3 text-sm">{copy.galleryUnavailable}</p>
			) : null}
		</FounderSection>
	);
}

export function MembershipBody({
	copy,
	onPin,
	presentation,
	presented,
}: {
	copy: typeof SMART_COLLECTIONS_COPY;
	onPin: (event: MouseEvent<HTMLButtonElement>) => void;
	presentation: Presentation | undefined;
	presented: readonly MemberRow[];
}) {
	if (presented.length === 0) {
		return <p>{copy.empty}</p>;
	}
	if (presentation === "Table") {
		return (
			<table className="w-full text-sm">
				<thead>
					<tr>
						<th className="text-left">{copy.title}</th>
						<th className="text-left">{copy.because}</th>
					</tr>
				</thead>
				<tbody>
					{presented.map((member) => (
						<tr key={member.id}>
							<td>{member.title}</td>
							<td>{member.because.map((reason) => reason.label).join("; ")}</td>
						</tr>
					))}
				</tbody>
			</table>
		);
	}
	if (presentation === "Gallery") {
		return (
			<ul className="grid gap-3 sm:grid-cols-2">
				{presented.map((member) => (
					<li className="rounded-md border p-3" key={member.id}>
						<div className="font-medium text-sm">{member.title}</div>
						<p className="text-muted-foreground text-sm">{member.title}</p>
					</li>
				))}
			</ul>
		);
	}
	return (
		<ul className="space-y-3">
			{presented.map((member) => (
				<li key={member.id}>
					<div className="font-medium text-sm">{member.title}</div>
					<p className="text-muted-foreground text-sm">
						{copy.because}:{" "}
						{member.because.map((reason) => reason.label).join("; ")}
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
	);
}

export function NewWorkSection({
	collectionProjectId,
	copy,
	message,
	onSubmit,
	prefill,
	projects,
}: {
	collectionProjectId: string | null;
	copy: typeof SMART_COLLECTIONS_COPY;
	message: string | null;
	onSubmit: (event: FormEvent<HTMLFormElement>) => void;
	prefill: { projectId?: string; status?: string; type?: string };
	projects: readonly { id: string; name: string }[];
}) {
	const initialProject = prefill.projectId ?? collectionProjectId ?? "";
	const [type, setType] = useState(prefill.type ?? "");
	const [status, setStatus] = useState(prefill.status ?? "");
	const [projectId, setProjectId] = useState(initialProject);
	useEffect(() => {
		setType(prefill.type ?? "");
		setStatus(prefill.status ?? "");
		setProjectId(prefill.projectId ?? collectionProjectId ?? "");
	}, [collectionProjectId, prefill.projectId, prefill.status, prefill.type]);
	const onType = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setType(event.currentTarget.value);
	}, []);
	const onStatus = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setStatus(event.currentTarget.value);
	}, []);
	const onProject = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
		setProjectId(event.currentTarget.value);
	}, []);
	const liveMiss = liveNewWorkMiss(prefill, {
		projectId: projectId.length > 0 ? projectId : undefined,
		status: status.length > 0 ? status : undefined,
		type: type.length > 0 ? type : undefined,
	});
	return (
		<FounderSection title={copy.newWork} titleId="smart-collection-new-work">
			<form className="flex flex-wrap items-end gap-3" onSubmit={onSubmit}>
				<Field>
					<FieldLabel htmlFor="smart-collection-new-work-title">
						{copy.name}
					</FieldLabel>
					<Input
						id="smart-collection-new-work-title"
						name="title"
						required={true}
						type="text"
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="smart-collection-new-work-type">
						{copy.type}
					</FieldLabel>
					<Input
						id="smart-collection-new-work-type"
						name="type"
						onChange={onType}
						value={type}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="smart-collection-new-work-status">
						{copy.status}
					</FieldLabel>
					<Input
						id="smart-collection-new-work-status"
						name="status"
						onChange={onStatus}
						value={status}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="smart-collection-new-work-project">
						{copy.project}
					</FieldLabel>
					<NativeSelect
						id="smart-collection-new-work-project"
						name="projectId"
						onChange={onProject}
						value={projectId}
					>
						<NativeSelectOption value="">{copy.allProjects}</NativeSelectOption>
						{projects.map((project) => (
							<NativeSelectOption key={project.id} value={project.id}>
								{project.name}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</Field>
				<Button type="submit">{copy.newWork}</Button>
			</form>
			{liveMiss ? (
				<p className="mt-3 text-sm">{copy.mayMissCollection}</p>
			) : null}
			{message ? <p className="mt-3 text-sm">{message}</p> : null}
		</FounderSection>
	);
}
