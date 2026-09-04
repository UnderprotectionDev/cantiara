import { Badge } from "@cantiara/ui/components/badge";
import { buttonVariants } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
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
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type { ChangeEvent } from "react";
import { useCallback, useId } from "react";

import { DECISIONS_COPY } from "@/features/decisions/forms/decisions-copy";
import { FounderPage } from "@/features/personal-shell/components/founder-page";
import { FounderToolbar } from "@/features/personal-shell/components/founder-surface";
import { orpc } from "@/utils/orpc";

import {
	PREPARED_INDEX_LABELS,
	type PreparedIndexSearch,
	preparedIndexSearch,
	preparedIndexTypeFilters,
	preparedIndexUsesFolderFilters,
	preparedIndexUsesStatusFilters,
} from "./prepared-index-search";
import { RECORD_DISCOVERY_COPY } from "./record-discovery-copy";

type IndexCopy = typeof RECORD_DISCOVERY_COPY;

interface IndexRow {
	diagramAuthorityMode: string | null;
	folder: string | null;
	id: string;
	metadata: string;
	openSourceRecord: string;
	recordType: string;
	scope: string;
	sourceHref: string;
	status: string;
	title: string;
}

export default function PreparedIndexArea({
	search,
}: {
	search: PreparedIndexSearch;
}) {
	const navigate = useNavigate();
	const catalog = useQuery(orpc.recordDiscovery.catalog.queryOptions());
	const copy = catalog.data?.copy ?? RECORD_DISCOVERY_COPY;
	const indexes = catalog.data?.indexes ?? PREPARED_INDEX_LABELS;
	const archiveId = useId();
	const browse = useQuery({
		...orpc.recordDiscovery.browseIndex.queryOptions({
			input: {
				folder: search.folder ?? null,
				includeArchived: search.includeArchived ?? false,
				index: search.index,
				metadata: search.metadata ?? null,
				recordType: search.recordType ?? null,
				scope: search.scope ?? null,
				status: search.status ?? null,
			},
		}),
	});
	const rows = browse.data?.rows ?? [];
	const folders = browse.data?.folders ?? [];
	const typeFilters = preparedIndexTypeFilters(search.index);
	const folderFilters = preparedIndexUsesFolderFilters(search.index);
	const statusFilters = preparedIndexUsesStatusFilters(search.index);
	const showAuthority =
		search.index === RECORD_DISCOVERY_COPY.allTechnicalDiagrams;
	const go = useCallback(
		(next: Record<string, unknown>) => {
			navigate({
				search: preparedIndexSearch(next),
				to: "/indexes",
			}).catch(() => undefined);
		},
		[navigate]
	);
	const onIndexChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			go({ index: event.target.value });
		},
		[go]
	);
	const onScopeChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			const scope = event.target.value;
			go({
				folder: search.folder,
				includeArchived: search.includeArchived,
				index: search.index,
				metadata: search.metadata,
				recordType: search.recordType,
				scope:
					scope === copy.project || scope === copy.personalWiki
						? scope
						: undefined,
				status: search.status,
			});
		},
		[copy.personalWiki, copy.project, go, search]
	);
	const onTypeChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			go({
				folder: search.folder,
				includeArchived: search.includeArchived,
				index: search.index,
				metadata: search.metadata,
				recordType: event.target.value || undefined,
				scope: search.scope,
				status: search.status,
			});
		},
		[go, search]
	);
	const onFolderChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			go({
				folder: event.target.value || undefined,
				includeArchived: search.includeArchived,
				index: search.index,
				metadata: search.metadata,
				recordType: search.recordType,
				scope: search.scope,
				status: search.status,
			});
		},
		[go, search]
	);
	const onMetadataChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			go({
				folder: search.folder,
				includeArchived: search.includeArchived,
				index: search.index,
				metadata: event.target.value || undefined,
				recordType: search.recordType,
				scope: search.scope,
				status: search.status,
			});
		},
		[go, search]
	);
	const onStatusChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			go({
				folder: search.folder,
				includeArchived: search.includeArchived,
				index: search.index,
				metadata: search.metadata,
				recordType: search.recordType,
				scope: search.scope,
				status: event.target.value || undefined,
			});
		},
		[go, search]
	);
	const onArchiveChange = useCallback(
		(next: boolean | "indeterminate") => {
			go({
				folder: search.folder,
				includeArchived: next === true ? true : undefined,
				index: search.index,
				metadata: search.metadata,
				recordType: search.recordType,
				scope: search.scope,
				status: search.status,
			});
		},
		[go, search]
	);

	return (
		<FounderPage title={search.index} wide>
			<FounderToolbar>
				<NativeSelect
					aria-label={search.index}
					onChange={onIndexChange}
					value={search.index}
				>
					{indexes.map((label) => (
						<NativeSelectOption key={label} value={label}>
							{label}
						</NativeSelectOption>
					))}
				</NativeSelect>
				<Field>
					<FieldLabel htmlFor="prepared-index-scope">{copy.scope}</FieldLabel>
					<NativeSelect
						id="prepared-index-scope"
						onChange={onScopeChange}
						value={search.scope ?? ""}
					>
						<NativeSelectOption value="">{copy.anyScope}</NativeSelectOption>
						<NativeSelectOption value={copy.project}>
							{copy.project}
						</NativeSelectOption>
						<NativeSelectOption value={copy.personalWiki}>
							{copy.personalWiki}
						</NativeSelectOption>
					</NativeSelect>
				</Field>
				{typeFilters.length > 0 ? (
					<Field>
						<FieldLabel htmlFor="prepared-index-type">
							{copy.recordType}
						</FieldLabel>
						<NativeSelect
							id="prepared-index-type"
							onChange={onTypeChange}
							value={search.recordType ?? ""}
						>
							<NativeSelectOption value="">{copy.anyScope}</NativeSelectOption>
							{typeFilters.map((type) => (
								<NativeSelectOption key={type} value={type}>
									{type}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</Field>
				) : null}
				{folderFilters ? (
					<Field>
						<FieldLabel htmlFor="prepared-index-folder">
							{copy.folder}
						</FieldLabel>
						<NativeSelect
							id="prepared-index-folder"
							onChange={onFolderChange}
							value={search.folder ?? ""}
						>
							<NativeSelectOption value="">{copy.anyScope}</NativeSelectOption>
							{folders.map((folder) => (
								<NativeSelectOption key={folder} value={folder}>
									{folder}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</Field>
				) : null}
				{folderFilters ? (
					<Field>
						<FieldLabel htmlFor="prepared-index-metadata">
							{copy.metadata}
						</FieldLabel>
						<Input
							defaultValue={search.metadata ?? ""}
							id="prepared-index-metadata"
							onBlur={onMetadataChange}
						/>
					</Field>
				) : null}
				{statusFilters ? (
					<Field>
						<FieldLabel htmlFor="prepared-index-status">
							{copy.filter}
						</FieldLabel>
						<NativeSelect
							id="prepared-index-status"
							onChange={onStatusChange}
							value={search.status ?? ""}
						>
							<NativeSelectOption value="">{copy.anyScope}</NativeSelectOption>
							<NativeSelectOption value={DECISIONS_COPY.valid}>
								{DECISIONS_COPY.valid}
							</NativeSelectOption>
							<NativeSelectOption value={DECISIONS_COPY.superseded}>
								{DECISIONS_COPY.superseded}
							</NativeSelectOption>
							<NativeSelectOption value={DECISIONS_COPY.withdrawn}>
								{DECISIONS_COPY.withdrawn}
							</NativeSelectOption>
						</NativeSelect>
					</Field>
				) : null}
				<Field orientation="horizontal">
					<Checkbox
						checked={search.includeArchived === true}
						id={archiveId}
						onCheckedChange={onArchiveChange}
					/>
					<FieldLabel htmlFor={archiveId}>{copy.includeArchived}</FieldLabel>
				</Field>
			</FounderToolbar>
			<IndexTable
				badgeScope={search.index === RECORD_DISCOVERY_COPY.allDocuments}
				browse={browse}
				copy={copy}
				rows={rows}
				showAuthority={showAuthority}
			/>
		</FounderPage>
	);
}

function IndexTable({
	badgeScope,
	browse,
	copy,
	rows,
	showAuthority,
}: {
	badgeScope: boolean;
	browse: { isError: boolean; isPending: boolean };
	copy: IndexCopy;
	rows: readonly IndexRow[];
	showAuthority: boolean;
}) {
	if (browse.isError) {
		return <p className="text-muted-foreground text-sm">{copy.unavailable}</p>;
	}
	if (!browse.isPending && rows.length === 0) {
		return <p className="text-muted-foreground text-sm">{copy.emptyIndex}</p>;
	}
	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead />
					<TableHead>{copy.recordType}</TableHead>
					<TableHead>{copy.scope}</TableHead>
					{showAuthority ? (
						<TableHead>{copy.diagramAuthorityMode}</TableHead>
					) : null}
					<TableHead>{copy.openSourceRecord}</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{rows.map((row) => (
					<TableRow key={row.id}>
						<TableCell>
							<p className="font-medium">{row.title}</p>
							<p className="flex flex-wrap gap-1">
								<Badge variant="outline">{row.status}</Badge>
								{row.folder ? (
									<Badge variant="outline">{row.folder}</Badge>
								) : null}
								{row.metadata ? (
									<Badge variant="ghost">{row.metadata}</Badge>
								) : null}
							</p>
						</TableCell>
						<TableCell>{row.recordType}</TableCell>
						<TableCell>
							{badgeScope ? (
								<Badge variant="outline">{row.scope}</Badge>
							) : (
								row.scope
							)}
						</TableCell>
						{showAuthority ? (
							<TableCell>{row.diagramAuthorityMode ?? ""}</TableCell>
						) : null}
						<TableCell>
							<a
								className={buttonVariants({ variant: "outline" })}
								href={row.sourceHref}
							>
								{row.openSourceRecord}
							</a>
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}
