import { Button } from "@cantiara/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@cantiara/ui/components/dialog";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
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
import { Textarea } from "@cantiara/ui/components/textarea";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
	createColumnHelper,
	tableFeatures,
	useTable,
} from "@tanstack/react-table";
import {
	type ChangeEvent,
	type FocusEvent,
	type FormEvent,
	useCallback,
	useId,
	useMemo,
	useState,
} from "react";

import { FounderPage } from "@/features/personal-shell/components/founder-page";
import { FounderToolbar } from "@/features/personal-shell/components/founder-surface";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import { RECORD_DISCOVERY_COPY } from "./record-discovery-copy";
import {
	defaultPasteMapping,
	parseTablePaste,
} from "./type-scoped-table-paste";

type TableSortField = "title" | "key" | "status";

interface TableRowView {
	id: string;
	kind: string;
	projectId: string | null;
	recordKey: string | null;
	revision: number;
	sessionTests: readonly { id: string; result: string; title: string }[];
	status: string;
	title: string;
}

interface PastePreviewRow {
	action: "create" | "update" | "invalid";
	index: number;
	key: string;
	title: string;
}

const TABLE_FEATURES = tableFeatures({});
const COLUMN_HELPER = createColumnHelper<typeof TABLE_FEATURES, TableRowView>();

async function invalidateTable() {
	await queryClient.invalidateQueries({
		predicate: (query) =>
			JSON.stringify(query.queryKey).includes("recordDiscovery"),
	});
}

function RecordsTable({
	copy,
	onTitleBlur,
	rows,
}: {
	copy: typeof RECORD_DISCOVERY_COPY;
	onTitleBlur: (
		row: TableRowView
	) => (event: FocusEvent<HTMLInputElement>) => void;
	rows: TableRowView[];
}) {
	const columns = useMemo(
		() =>
			COLUMN_HELPER.columns([
				COLUMN_HELPER.accessor((row) => row.recordKey ?? "", {
					header: "Key",
					id: "key",
				}),
				COLUMN_HELPER.accessor((row) => row.title, {
					header: "Title",
					id: "title",
				}),
				COLUMN_HELPER.accessor((row) => row.status, {
					header: "Status",
					id: "status",
				}),
				COLUMN_HELPER.accessor(
					(row) =>
						row.sessionTests
							.map((item) => `${item.title}: ${item.result}`)
							.join(", "),
					{
						header: copy.sessionTests,
						id: "sessionTests",
					}
				),
			]),
		[copy.sessionTests]
	);
	const data = useMemo(() => [...rows], [rows]);
	const table = useTable({
		columns,
		data,
		features: TABLE_FEATURES,
		getRowId: (row) => row.id,
	});
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
					</TableRow>
				))}
			</TableHeader>
			<TableBody>
				{table.getRowModel().rows.map((row) => (
					<TableRow key={row.id}>
						{row.getAllCells().map((cell) => (
							<TableCell key={cell.id}>
								{cell.column.id === "title" ? (
									<Input
										aria-label="Title"
										defaultValue={row.original.title}
										key={`${row.original.id}-${row.original.revision}`}
										onBlur={onTitleBlur(row.original)}
									/>
								) : (
									<table.FlexRender cell={cell} />
								)}
							</TableCell>
						))}
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}

export function TypeScopedTable({ kind }: { kind: string }) {
	const navigate = useNavigate();
	const filterId = useId();
	const typeId = useId();
	const sortId = useId();
	const pasteId = useId();
	const projectIdField = useId();
	const titleMapId = useId();
	const keyMapId = useId();
	const [filterText, setFilterText] = useState("");
	const [sortField, setSortField] = useState<TableSortField>("title");
	const [pasteText, setPasteText] = useState("");
	const [mapping, setMapping] = useState({
		key: null as number | null,
		title: 0,
	});
	const [projectId, setProjectId] = useState("");
	const [excludedIndexes, setExcludedIndexes] = useState<number[]>([]);
	const [saveNotice, setSaveNotice] = useState<string | null>(null);
	const [pasteOpen, setPasteOpen] = useState(false);
	const catalog = useQuery(orpc.recordDiscovery.catalog.queryOptions());
	const copy = catalog.data?.copy ?? RECORD_DISCOVERY_COPY;
	const tableKinds = catalog.data?.tableKinds ?? [copy.work];
	const projects = useQuery(orpc.projectShell.list.queryOptions());
	const table = useQuery({
		...orpc.recordDiscovery.tableQuery.queryOptions({
			input: {
				filterText,
				kind,
				sortDirection: "asc",
				sortField,
			},
		}),
		enabled: tableKinds.some((tableKind) => tableKind === kind),
	});
	const parsedPaste = useMemo(() => parseTablePaste(pasteText), [pasteText]);
	const preview = useQuery({
		...orpc.recordDiscovery.tablePreviewPaste.queryOptions({
			input: {
				headers: parsedPaste.headers,
				kind,
				mapping,
				projectId: projectId || null,
				rows: parsedPaste.rows,
			},
		}),
		enabled:
			parsedPaste.rows.length > 0 &&
			tableKinds.some((tableKind) => tableKind === kind),
	});
	const applyCell = useMutation(
		orpc.recordDiscovery.tableApplyCell.mutationOptions({
			onSuccess: async () => {
				await invalidateTable();
			},
		})
	);
	const applyPaste = useMutation(
		orpc.recordDiscovery.tableApplyPaste.mutationOptions({
			onSuccess: async (result) => {
				if (result.decided.status === "ok") {
					setPasteText("");
					await invalidateTable();
				}
			},
		})
	);
	const saveCollection = useMutation(
		orpc.recordDiscovery.saveTableAsSmartCollection.mutationOptions({
			onSuccess: (result) => {
				if (result.status === "refused" && !result.membershipStored) {
					setSaveNotice(copy.saveDoesNotStoreMembership);
				}
			},
		})
	);
	const onKindChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			const next = event.target.value;
			navigate({ search: { kind: next }, to: "/table" }).catch(() => undefined);
		},
		[navigate]
	);
	const onFilterChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setFilterText(event.target.value);
	}, []);
	const onSortChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
		const { value } = event.target;
		if (value === "title" || value === "key" || value === "status") {
			setSortField(value);
		}
	}, []);
	const onPasteChange = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			const { value } = event.target;
			const parsed = parseTablePaste(value);
			setPasteText(value);
			setExcludedIndexes([]);
			setMapping(defaultPasteMapping(parsed.headers));
		},
		[]
	);
	const onProjectChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			setProjectId(event.target.value);
		},
		[]
	);
	const onTitleMapChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			setMapping((current) => ({
				...current,
				title: Number(event.target.value),
			}));
		},
		[]
	);
	const onKeyMapChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			const { value } = event.target;
			setMapping((current) => ({
				...current,
				key: value.length === 0 ? null : Number(value),
			}));
		},
		[]
	);
	const onSaveCollection = useCallback(() => {
		saveCollection.mutate({ kind });
	}, [kind, saveCollection]);
	const onApplyPaste = useCallback(
		(event: FormEvent) => {
			event.preventDefault();
			applyPaste.mutate({
				excludedIndexes,
				headers: parsedPaste.headers,
				idempotencyKey: newIdempotencyKey(),
				kind,
				mapping,
				projectId: projectId || null,
				rows: parsedPaste.rows,
			});
		},
		[applyPaste, excludedIndexes, kind, mapping, parsedPaste, projectId]
	);
	const onOpenPaste = useCallback(() => {
		setPasteOpen(true);
	}, []);
	const onPasteOpenChange = useCallback((open: boolean) => {
		setPasteOpen(open);
	}, []);
	const onTitleBlur = useCallback(
		(row: TableRowView) => (event: FocusEvent<HTMLInputElement>) => {
			const value = event.target.value.trim();
			if (value.length === 0 || value === row.title) {
				return;
			}
			applyCell.mutate({
				baseRevision: row.revision,
				field: "title",
				idempotencyKey: newIdempotencyKey(),
				kind,
				recordId: row.id,
				value,
			});
		},
		[applyCell, kind]
	);
	const toggleExclude = useCallback((index: number) => {
		setExcludedIndexes((current) =>
			current.includes(index)
				? current.filter((item) => item !== index)
				: [...current, index]
		);
	}, []);
	const onExcludeChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			const index = Number(event.target.dataset.index);
			if (Number.isInteger(index)) {
				toggleExclude(index);
			}
		},
		[toggleExclude]
	);
	const rows = (table.data?.rows ?? []) as TableRowView[];
	const previewRows = (preview.data?.rows ?? []) as PastePreviewRow[];
	const allowed = tableKinds.some((tableKind) => tableKind === kind);

	return (
		<FounderPage title={copy.table} wide>
			<div className="flex flex-col gap-6">
				<FounderToolbar>
					<Field>
						<FieldLabel htmlFor={typeId}>{copy.type}</FieldLabel>
						<NativeSelect id={typeId} onChange={onKindChange} value={kind}>
							{tableKinds.map((tableKind) => (
								<NativeSelectOption key={tableKind} value={tableKind}>
									{tableKind}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</Field>
					<Field>
						<FieldLabel htmlFor={filterId}>{copy.filter}</FieldLabel>
						<Input id={filterId} onChange={onFilterChange} value={filterText} />
					</Field>
					<Field>
						<FieldLabel htmlFor={sortId}>{copy.sort}</FieldLabel>
						<NativeSelect id={sortId} onChange={onSortChange} value={sortField}>
							<NativeSelectOption value="title">Title</NativeSelectOption>
							<NativeSelectOption value="key">Key</NativeSelectOption>
							<NativeSelectOption value="status">Status</NativeSelectOption>
						</NativeSelect>
					</Field>
					<Button onClick={onSaveCollection} type="button" variant="outline">
						{copy.saveAsSmartCollection}
					</Button>
					<Button onClick={onOpenPaste} type="button" variant="outline">
						{copy.previewPaste}
					</Button>
				</FounderToolbar>
				{saveNotice ? (
					<p className="text-muted-foreground text-sm">{saveNotice}</p>
				) : null}
				{!allowed || table.isError ? (
					<p className="text-muted-foreground text-sm">
						{copy.tableUnavailable}
					</p>
				) : (
					<RecordsTable copy={copy} onTitleBlur={onTitleBlur} rows={rows} />
				)}
				<Dialog onOpenChange={onPasteOpenChange} open={pasteOpen}>
					<DialogContent className="max-h-[min(40rem,90vh)] overflow-y-auto sm:max-w-lg">
						<DialogHeader>
							<DialogTitle>{copy.previewPaste}</DialogTitle>
						</DialogHeader>
						<form className="flex flex-col gap-3" onSubmit={onApplyPaste}>
							<Field>
								<FieldLabel htmlFor={pasteId}>{copy.previewPaste}</FieldLabel>
								<Textarea
									id={pasteId}
									onChange={onPasteChange}
									rows={6}
									value={pasteText}
								/>
							</Field>
							{parsedPaste.headers.length > 0 ? (
								<div className="flex flex-wrap gap-3">
									<Field>
										<FieldLabel htmlFor={titleMapId}>Title</FieldLabel>
										<NativeSelect
											id={titleMapId}
											onChange={onTitleMapChange}
											value={String(mapping.title)}
										>
											{parsedPaste.headers.map((header, index) => (
												<NativeSelectOption
													key={`title-${header}`}
													value={String(index)}
												>
													{header}
												</NativeSelectOption>
											))}
										</NativeSelect>
									</Field>
									<Field>
										<FieldLabel htmlFor={keyMapId}>Key</FieldLabel>
										<NativeSelect
											id={keyMapId}
											onChange={onKeyMapChange}
											value={mapping.key === null ? "" : String(mapping.key)}
										>
											<NativeSelectOption value="">Key</NativeSelectOption>
											{parsedPaste.headers.map((header, index) => (
												<NativeSelectOption
													key={`key-${header}`}
													value={String(index)}
												>
													{header}
												</NativeSelectOption>
											))}
										</NativeSelect>
									</Field>
								</div>
							) : null}
							<Field>
								<FieldLabel htmlFor={projectIdField}>{copy.project}</FieldLabel>
								<NativeSelect
									id={projectIdField}
									onChange={onProjectChange}
									value={projectId}
								>
									<NativeSelectOption value="">
										{copy.project}
									</NativeSelectOption>
									{(projects.data ?? []).map((project) => (
										<NativeSelectOption key={project.id} value={project.id}>
											{project.name}
										</NativeSelectOption>
									))}
								</NativeSelect>
							</Field>
							{previewRows.length > 0 ? (
								<ul className="flex flex-col gap-1 text-sm">
									{previewRows.map((row) => (
										<li key={row.index}>
											<label className="flex items-center gap-2">
												<input
													checked={excludedIndexes.includes(row.index)}
													data-index={row.index}
													onChange={onExcludeChange}
													type="checkbox"
												/>
												<span>
													{copy.excludeFromApply}: {row.action} {row.key}{" "}
													{row.title}
												</span>
											</label>
										</li>
									))}
								</ul>
							) : null}
							<Button type="submit">{copy.applyPaste}</Button>
							{applyPaste.data &&
							applyPaste.data.decided.status === "rejected" ? (
								<p className="text-muted-foreground text-sm">
									{copy.pasteNotApplied}
								</p>
							) : null}
						</form>
					</DialogContent>
				</Dialog>
			</div>
		</FounderPage>
	);
}
