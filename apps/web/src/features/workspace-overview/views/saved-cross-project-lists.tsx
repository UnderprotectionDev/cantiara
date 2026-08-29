import { Button } from "@cantiara/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@cantiara/ui/components/table";
import {
	createColumnHelper,
	tableFeatures,
	useTable,
} from "@tanstack/react-table";
import {
	type DragEvent,
	type FormEvent,
	type MouseEvent,
	useCallback,
	useMemo,
	useState,
} from "react";

import {
	AREA_FILTERS,
	CROSS_PROJECT_LIST_COLUMNS,
	type CrossProjectListColumn,
	type CrossProjectListRow,
	cellForColumn,
	LIFECYCLE_FILTERS,
	type SavedCrossProjectListView,
	type SavedListLayoutItem,
} from "./saved-cross-project-lists-model";

const TABLE_FEATURES = tableFeatures({});
const COLUMN_HELPER = createColumnHelper<
	typeof TABLE_FEATURES,
	CrossProjectListRow
>();

export interface SavedListsCopy {
	archived: string;
	areas: string;
	columns: string;
	grouping: string;
	lastReportedHealth: string;
	lifecycle: string;
	listName: string;
	membershipFromConditions: string;
	openSourceRecord: string;
	remove: string;
	savedLists: string;
	saveList: string;
	sort: string;
	stage: string;
	targetDate: string;
}

function columnHeader(
	column: CrossProjectListColumn,
	copy: SavedListsCopy
): string {
	switch (column) {
		case "areas":
			return copy.areas;
		case "lastReportedHealth":
			return copy.lastReportedHealth;
		case "lifecycle":
			return copy.lifecycle;
		case "name":
			return copy.listName;
		case "stage":
			return copy.stage;
		case "targetDate":
			return copy.targetDate;
		default:
			return column;
	}
}

function isListColumn(value: string): value is CrossProjectListColumn {
	return (CROSS_PROJECT_LIST_COLUMNS as readonly string[]).includes(value);
}

function archivedFromForm(value: string): boolean | null {
	if (value === "yes") {
		return true;
	}
	if (value === "no") {
		return false;
	}
	return null;
}

function ListTable({
	columns,
	copy,
	onOpen,
	openedRecordId,
	rows,
}: {
	columns: readonly CrossProjectListColumn[];
	copy: SavedListsCopy;
	onOpen: (id: string) => void;
	openedRecordId: string | null;
	rows: readonly CrossProjectListRow[];
}) {
	const tableColumns = useMemo(
		() =>
			COLUMN_HELPER.columns(
				columns.map((column) =>
					COLUMN_HELPER.accessor((row) => cellForColumn(row, column), {
						header: columnHeader(column, copy),
						id: column,
					})
				)
			),
		[columns, copy]
	);
	const data = useMemo(() => [...rows], [rows]);
	const table = useTable({
		columns: tableColumns,
		data,
		features: TABLE_FEATURES,
		getRowId: (row) => row.id,
	});
	const onOpenClick = useCallback(
		(event: MouseEvent<HTMLButtonElement>) => {
			onOpen(event.currentTarget.value);
		},
		[onOpen]
	);

	return (
		<Table>
			<TableHeader>
				{table.getHeaderGroups().map((group) => (
					<TableRow key={group.id}>
						{group.headers.map((header) => (
							<TableHead key={header.id}>
								{header.isPlaceholder ? null : (
									<table.FlexRender header={header} />
								)}
							</TableHead>
						))}
						<TableHead>{copy.openSourceRecord}</TableHead>
					</TableRow>
				))}
			</TableHeader>
			<TableBody>
				{table.getRowModel().rows.map((row) => (
					<TableRow key={row.id}>
						{row.getAllCells().map((cell) => (
							<TableCell key={cell.id}>
								<table.FlexRender cell={cell} />
							</TableCell>
						))}
						<TableCell>
							<Button
								aria-pressed={openedRecordId === row.id}
								onClick={onOpenClick}
								type="button"
								value={row.id}
								variant="outline"
							>
								{copy.openSourceRecord}
							</Button>
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}

function SavedListForm({
	copy,
	onSave,
}: {
	copy: SavedListsCopy;
	onSave: (item: SavedListLayoutItem) => void;
}) {
	const onSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			const form = new FormData(event.currentTarget);
			const name = String(form.get("name") ?? "").trim();
			if (name.length === 0) {
				return;
			}
			const columns = form.getAll("columns").map(String).filter(isListColumn);
			const groupingRaw = String(form.get("grouping") ?? "");
			onSave({
				columns:
					columns.length > 0
						? columns
						: ["name", "lifecycle", "lastReportedHealth"],
				conditions: {
					archived: archivedFromForm(String(form.get("archived") ?? "any")),
					enabledAreas: form.getAll("areas").map(String),
					lifecycleStatuses: form.getAll("lifecycle").map(String),
					stageNames: String(form.get("stages") ?? "")
						.split(",")
						.map((item) => item.trim())
						.filter((item) => item.length > 0),
					targetDateOnOrAfter: String(form.get("from") ?? "") || null,
					targetDateOnOrBefore: String(form.get("to") ?? "") || null,
				},
				grouping: isListColumn(groupingRaw) ? groupingRaw : null,
				id: crypto.randomUUID(),
				name,
				sort: {
					column: isListColumn(String(form.get("sortColumn") ?? ""))
						? (String(form.get("sortColumn")) as CrossProjectListColumn)
						: "name",
					direction:
						String(form.get("sortDirection")) === "desc" ? "desc" : "asc",
				},
			});
			event.currentTarget.reset();
		},
		[onSave]
	);

	return (
		<form className="mt-4 flex flex-col gap-3" onSubmit={onSubmit}>
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor="saved-list-name">{copy.listName}</FieldLabel>
					<Input id="saved-list-name" name="name" />
				</Field>
				<Field>
					<FieldLabel>{copy.lifecycle}</FieldLabel>
					<div className="flex flex-wrap gap-3">
						{LIFECYCLE_FILTERS.map((status) => (
							<Field key={status} orientation="horizontal">
								<input
									className="size-4"
									id={`lifecycle-${status}`}
									name="lifecycle"
									type="checkbox"
									value={status}
								/>
								<FieldLabel htmlFor={`lifecycle-${status}`}>
									{status}
								</FieldLabel>
							</Field>
						))}
					</div>
				</Field>
				<Field>
					<FieldLabel htmlFor="saved-list-archived">{copy.archived}</FieldLabel>
					<NativeSelect
						defaultValue="any"
						id="saved-list-archived"
						name="archived"
					>
						<NativeSelectOption value="any">Any</NativeSelectOption>
						<NativeSelectOption value="no">Not archived</NativeSelectOption>
						<NativeSelectOption value="yes">{copy.archived}</NativeSelectOption>
					</NativeSelect>
				</Field>
				<Field>
					<FieldLabel htmlFor="saved-list-stages">{copy.stage}</FieldLabel>
					<Input id="saved-list-stages" name="stages" />
				</Field>
				<Field>
					<FieldLabel>{copy.areas}</FieldLabel>
					<div className="flex flex-wrap gap-3">
						{AREA_FILTERS.map((area) => (
							<Field key={area} orientation="horizontal">
								<input
									className="size-4"
									id={`area-${area}`}
									name="areas"
									type="checkbox"
									value={area}
								/>
								<FieldLabel htmlFor={`area-${area}`}>{area}</FieldLabel>
							</Field>
						))}
					</div>
				</Field>
				<Field>
					<FieldLabel htmlFor="saved-list-from">{copy.targetDate}</FieldLabel>
					<div className="flex flex-wrap gap-2">
						<Input id="saved-list-from" name="from" type="date" />
						<Input aria-label={`${copy.targetDate} to`} name="to" type="date" />
					</div>
				</Field>
				<Field>
					<FieldLabel>{copy.columns}</FieldLabel>
					<div className="flex flex-wrap gap-3">
						{CROSS_PROJECT_LIST_COLUMNS.map((column) => (
							<Field key={column} orientation="horizontal">
								<input
									className="size-4"
									defaultChecked={
										column === "name" ||
										column === "lifecycle" ||
										column === "lastReportedHealth"
									}
									id={`column-${column}`}
									name="columns"
									type="checkbox"
									value={column}
								/>
								<FieldLabel htmlFor={`column-${column}`}>
									{columnHeader(column, copy)}
								</FieldLabel>
							</Field>
						))}
					</div>
				</Field>
				<Field>
					<FieldLabel htmlFor="saved-list-sort">{copy.sort}</FieldLabel>
					<div className="flex flex-wrap gap-2">
						<NativeSelect
							defaultValue="name"
							id="saved-list-sort"
							name="sortColumn"
						>
							{CROSS_PROJECT_LIST_COLUMNS.map((column) => (
								<NativeSelectOption key={column} value={column}>
									{columnHeader(column, copy)}
								</NativeSelectOption>
							))}
						</NativeSelect>
						<NativeSelect
							aria-label={copy.sort}
							defaultValue="asc"
							name="sortDirection"
						>
							<NativeSelectOption value="asc">A–Z</NativeSelectOption>
							<NativeSelectOption value="desc">Z–A</NativeSelectOption>
						</NativeSelect>
					</div>
				</Field>
				<Field>
					<FieldLabel htmlFor="saved-list-grouping">{copy.grouping}</FieldLabel>
					<NativeSelect
						defaultValue=""
						id="saved-list-grouping"
						name="grouping"
					>
						<NativeSelectOption value="">None</NativeSelectOption>
						{CROSS_PROJECT_LIST_COLUMNS.map((column) => (
							<NativeSelectOption key={column} value={column}>
								{columnHeader(column, copy)}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</Field>
			</FieldGroup>
			<Button type="submit">{copy.saveList}</Button>
		</form>
	);
}

export default function SavedCrossProjectLists({
	copy,
	lists,
	onOpen,
	onRemove,
	onSave,
	openedRecordId,
}: {
	copy: SavedListsCopy;
	lists: readonly SavedCrossProjectListView[];
	onOpen: (id: string) => void;
	onRemove: (id: string) => void;
	onSave: (item: SavedListLayoutItem) => void;
	openedRecordId: string | null;
}) {
	const [dragMessage, setDragMessage] = useState<string | null>(null);
	const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
		event.preventDefault();
	}, []);
	const onDrop = useCallback(
		(event: DragEvent<HTMLDivElement>) => {
			event.preventDefault();
			setDragMessage(copy.membershipFromConditions);
		},
		[copy.membershipFromConditions]
	);
	const onRemoveClick = useCallback(
		(event: MouseEvent<HTMLButtonElement>) => {
			onRemove(event.currentTarget.value);
		},
		[onRemove]
	);

	return (
		// biome-ignore lint/a11y/noNoninteractiveElementInteractions: drop rejects membership
		<section
			aria-label={copy.savedLists}
			className="mt-8"
			onDragOver={onDragOver}
			onDrop={onDrop}
		>
			<h2 className="font-medium text-sm">{copy.savedLists}</h2>
			{dragMessage ? <p role="status">{dragMessage}</p> : null}
			{lists.map((list) => (
				<div className="mt-4" key={list.id}>
					<div className="flex flex-wrap items-center gap-2">
						<h3 className="font-medium text-sm">{list.name}</h3>
						<Button
							onClick={onRemoveClick}
							type="button"
							value={list.id}
							variant="ghost"
						>
							{copy.remove}
						</Button>
					</div>
					{list.groups ? (
						list.groups.map((group) => (
							<div className="mt-2" key={group.heading}>
								<h4 className="text-muted-foreground text-xs">
									{group.heading}
								</h4>
								<ListTable
									columns={list.columns}
									copy={copy}
									onOpen={onOpen}
									openedRecordId={openedRecordId}
									rows={group.rows}
								/>
							</div>
						))
					) : (
						<ListTable
							columns={list.columns}
							copy={copy}
							onOpen={onOpen}
							openedRecordId={openedRecordId}
							rows={list.rows}
						/>
					)}
				</div>
			))}
			<SavedListForm copy={copy} onSave={onSave} />
		</section>
	);
}
