import { documentTypeSchema } from "@cantiara/api/documents";
import {
  DECISION_LIFE_OPTIONS,
  decisionLifeSchema,
} from "@cantiara/api/project-source-records";
import {
  type RecordDiscoveryIndex,
  type RecordDiscoveryScope,
  type RecordDiscoveryView,
  type RecordTableCellUpdateInput,
  type RecordTablePasteInput,
  recordDiscoveryIndexLabels,
  recordDiscoveryScopeSchema,
  recordDiscoveryViewSchema,
  type recordTableTypes,
  type UniversalSearchResult,
} from "@cantiara/api/record-discovery";
import { Button } from "@cantiara/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@cantiara/ui/components/dialog";
import { Input } from "@cantiara/ui/components/input";
import { Label } from "@cantiara/ui/components/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMatches, useRouteContext } from "@tanstack/react-router";
import {
  type ChangeEvent,
  type ReactNode,
  useCallback,
  useMemo,
  useState,
} from "react";
import {
  client,
  orpc,
  projectsQueryOptions,
  universalSearchQueryOptions,
} from "@/utils/orpc";
import { RecordTableView } from "./record-table";
import UniversalSearchResults from "./universal-search-results";

interface ProjectScopeOption {
  id: string;
  name: string;
}

type DiscoveryView = RecordDiscoveryView | "Table";
type RecordTableType = (typeof recordTableTypes)[number];

export function parseDiscoveryView(value: string): DiscoveryView {
  return value === "Table" ? value : recordDiscoveryViewSchema.parse(value);
}

export function discoveryScopeValue(scope: RecordDiscoveryScope) {
  return scope.kind === "project" ? `project:${scope.projectId}` : scope.kind;
}

export function parseDiscoveryScope(value: string): RecordDiscoveryScope {
  if (value === "all") {
    return { kind: "all" };
  }
  if (value === "wiki") {
    return { kind: "wiki" };
  }
  if (!value.startsWith("project:")) {
    throw new Error("Invalid discovery scope");
  }
  return recordDiscoveryScopeSchema.parse({
    kind: "project",
    projectId: value.slice("project:".length),
  });
}

function hasMetadataFilters(index: RecordDiscoveryIndex) {
  return index === "All Documents" || index === "All Files";
}

export function discoveryIndexFailed({
  index,
  inventoryFailed,
  projectsFailed,
  resultsFailed,
}: {
  index: RecordDiscoveryIndex;
  inventoryFailed: boolean;
  projectsFailed: boolean;
  resultsFailed: boolean;
}) {
  return (
    projectsFailed ||
    resultsFailed ||
    (hasMetadataFilters(index) && inventoryFailed)
  );
}

function discoveryIndexInput(
  view: RecordDiscoveryView,
  scope: RecordDiscoveryScope,
  archived: boolean,
  currentProjectId?: string,
) {
  return {
    query: "",
    index: view,
    scope,
    archived,
    ...(currentProjectId ? { currentProjectId } : {}),
  };
}

function indexTypeOptions(
  index: RecordDiscoveryIndex,
  results: UniversalSearchResult[],
  selectedType: string,
) {
  if (index === "All Documents") {
    return [...documentTypeSchema.options];
  }
  if (index !== "All Files") {
    return [];
  }
  const types = new Set(
    results.flatMap(({ category }) => (category ? [category] : [])),
  );
  if (selectedType) {
    types.add(selectedType);
  }
  return [...types].sort();
}

function indexFolderOptions(results: UniversalSearchResult[]) {
  return [
    ...new Set(results.flatMap(({ folder }) => (folder ? [folder] : []))),
  ].sort();
}

export function DiscoveryContent({
  failed,
  pending,
  data,
  index,
  onOpenSource,
}: {
  failed: boolean;
  pending: boolean;
  data?: UniversalSearchResult[];
  index: RecordDiscoveryIndex;
  onOpenSource: () => void;
}) {
  if (failed) {
    return <p role="alert">Search is unavailable.</p>;
  }
  if (pending) {
    return <p role="status">Loading…</p>;
  }
  if (!data?.length) {
    return <p>No records in this index.</p>;
  }
  return (
    <UniversalSearchResults
      index={index}
      onOpenSource={onOpenSource}
      query=""
      results={data}
    />
  );
}

function UniversalSearchContent({
  failed,
  pending,
  data,
  query,
  onOpenSource,
}: {
  failed: boolean;
  pending: boolean;
  data?: UniversalSearchResult[];
  query: string;
  onOpenSource: () => void;
}) {
  if (failed) {
    return <p role="alert">Search is unavailable.</p>;
  }
  if (!query.trim()) {
    return <p>Type to search authorized records.</p>;
  }
  if (pending) {
    return <p role="status">Loading…</p>;
  }
  if (!data?.length) {
    return <p>No matching records.</p>;
  }
  return (
    <UniversalSearchResults
      onOpenSource={onOpenSource}
      query={query}
      results={data}
    />
  );
}

function ArchivedFilter({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <Label>
      <input checked={checked} onChange={onChange} type="checkbox" />
      Archived
    </Label>
  );
}

type DecisionStatus = (typeof DECISION_LIFE_OPTIONS)[number];

export function DecisionStatusFilter({
  value,
  onChange,
}: {
  value: DecisionStatus;
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor="discovery-decision-status">Status</Label>
      <NativeSelect
        id="discovery-decision-status"
        onChange={onChange}
        value={value}
      >
        {DECISION_LIFE_OPTIONS.map((status) => (
          <NativeSelectOption key={status} value={status}>
            {status}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <p className="text-muted-foreground text-xs">Filters Decisions only.</p>
    </div>
  );
}

function useDecisionStatus() {
  const [status, setStatus] = useState<DecisionStatus>("Valid");
  const changeStatus = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
    const result = decisionLifeSchema.safeParse(event.target.value);
    if (result.success) {
      setStatus(result.data);
    }
  }, []);
  return { status, changeStatus };
}

function SearchPanel({
  archived,
  failed,
  onChangeArchived,
  onChangeQuery,
  onOpenSource,
  pending,
  query,
  results,
}: {
  archived: boolean;
  failed: boolean;
  onChangeArchived: (event: ChangeEvent<HTMLInputElement>) => void;
  onChangeQuery: (event: ChangeEvent<HTMLInputElement>) => void;
  onOpenSource: () => void;
  pending: boolean;
  query: string;
  results?: UniversalSearchResult[];
}) {
  return (
    <>
      <Label htmlFor="discovery-query">Search</Label>
      <Input
        id="discovery-query"
        maxLength={200}
        onChange={onChangeQuery}
        value={query}
      />
      <ArchivedFilter checked={archived} onChange={onChangeArchived} />
      <UniversalSearchContent
        data={results}
        failed={failed}
        onOpenSource={onOpenSource}
        pending={pending}
        query={query}
      />
    </>
  );
}

function ScopeFilter({
  onChange,
  projects,
  scope,
}: {
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  projects: readonly ProjectScopeOption[];
  scope: RecordDiscoveryScope;
}) {
  return (
    <div>
      <Label htmlFor="discovery-scope">Scope</Label>
      <NativeSelect
        id="discovery-scope"
        onChange={onChange}
        value={discoveryScopeValue(scope)}
      >
        <NativeSelectOption value="all">All scopes</NativeSelectOption>
        <NativeSelectOption value="wiki">Personal Wiki</NativeSelectOption>
        {projects.map((project) => (
          <NativeSelectOption key={project.id} value={`project:${project.id}`}>
            Project: {project.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}

function MetadataFilters({
  folder,
  folders,
  onChangeFolder,
  onChangeType,
  type,
  typeOptions,
}: {
  folder: string;
  folders: string[];
  onChangeFolder: (event: ChangeEvent<HTMLSelectElement>) => void;
  onChangeType: (event: ChangeEvent<HTMLSelectElement>) => void;
  type: string;
  typeOptions: string[];
}) {
  return (
    <>
      <div>
        <Label htmlFor="discovery-type">Type</Label>
        <NativeSelect id="discovery-type" onChange={onChangeType} value={type}>
          <NativeSelectOption value="">All types</NativeSelectOption>
          {typeOptions.map((option) => (
            <NativeSelectOption key={option} value={option}>
              {option}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div>
        <Label htmlFor="discovery-folder">Folder</Label>
        <NativeSelect
          id="discovery-folder"
          onChange={onChangeFolder}
          value={folder}
        >
          <NativeSelectOption value="">All folders</NativeSelectOption>
          {folders.map((option) => (
            <NativeSelectOption key={option} value={option}>
              {option}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
    </>
  );
}

function IndexPanel({
  archived,
  failed,
  folder,
  folders,
  index,
  onChangeArchived,
  onChangeFolder,
  onChangeScope,
  onChangeType,
  onOpenSource,
  pending,
  projects,
  results,
  scope,
  type,
  typeOptions,
}: {
  archived: boolean;
  failed: boolean;
  folder: string;
  folders: string[];
  index: RecordDiscoveryIndex;
  onChangeArchived: (event: ChangeEvent<HTMLInputElement>) => void;
  onChangeFolder: (event: ChangeEvent<HTMLSelectElement>) => void;
  onChangeScope: (event: ChangeEvent<HTMLSelectElement>) => void;
  onChangeType: (event: ChangeEvent<HTMLSelectElement>) => void;
  onOpenSource: () => void;
  pending: boolean;
  projects: readonly ProjectScopeOption[];
  results?: UniversalSearchResult[];
  scope: RecordDiscoveryScope;
  type: string;
  typeOptions: string[];
}) {
  return (
    <>
      <div className="flex flex-wrap items-end gap-3">
        <ScopeFilter
          onChange={onChangeScope}
          projects={projects}
          scope={scope}
        />
        {hasMetadataFilters(index) ? (
          <MetadataFilters
            folder={folder}
            folders={folders}
            onChangeFolder={onChangeFolder}
            onChangeType={onChangeType}
            type={type}
            typeOptions={typeOptions}
          />
        ) : null}
        <ArchivedFilter checked={archived} onChange={onChangeArchived} />
      </div>
      <DiscoveryContent
        data={results}
        failed={failed}
        index={index}
        onOpenSource={onOpenSource}
        pending={pending}
      />
    </>
  );
}

function DiscoverySurface({
  accountId,
  currentProjectId,
  onOpenSource,
}: {
  accountId: string;
  currentProjectId?: string;
  onOpenSource: () => void;
}) {
  const [view, setView] = useState<DiscoveryView>("Search");
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<RecordDiscoveryScope>({ kind: "all" });
  const [archived, setArchived] = useState(false);
  const [tableRecordType, setTableRecordType] =
    useState<RecordTableType>("Work");
  const [tableProjectId, setTableProjectId] = useState(currentProjectId ?? "");
  const changeView = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
    setView(parseDiscoveryView(event.target.value));
  }, []);
  const changeQuery = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value),
    [],
  );
  const changeScope = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) =>
      setScope(parseDiscoveryScope(event.target.value)),
    [],
  );
  const changeArchived = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setArchived(event.target.checked);
  }, []);
  let content: ReactNode;
  if (view === "Search") {
    content = (
      <RecordSearchSurface
        {...{
          accountId,
          archived,
          currentProjectId,
          onChangeArchived: changeArchived,
          onChangeQuery: changeQuery,
          onOpenSource,
          query,
        }}
      />
    );
  } else if (view === "Table") {
    content = (
      <RecordTableSurface
        accountId={accountId}
        onProjectChange={setTableProjectId}
        onRecordTypeChange={setTableRecordType}
        projectId={tableProjectId}
        recordType={tableRecordType}
      />
    );
  } else {
    content = (
      <RecordIndexSurface
        accountId={accountId}
        archived={archived}
        currentProjectId={currentProjectId}
        index={view}
        key={view}
        onChangeArchived={changeArchived}
        onChangeScope={changeScope}
        onOpenSource={onOpenSource}
        scope={scope}
      />
    );
  }
  return (
    <div className="space-y-4">
      <Label htmlFor="discovery-view">Discovery view</Label>
      <NativeSelect id="discovery-view" onChange={changeView} value={view}>
        <NativeSelectOption value="Search">Search</NativeSelectOption>
        {recordDiscoveryIndexLabels.map((label) => (
          <NativeSelectOption key={label} value={label}>
            {label}
          </NativeSelectOption>
        ))}
        <NativeSelectOption value="Table">Table</NativeSelectOption>
      </NativeSelect>
      {content}
    </div>
  );
}

function RecordSearchSurface({
  accountId,
  archived,
  currentProjectId,
  onChangeArchived,
  onChangeQuery,
  onOpenSource,
  query,
}: {
  accountId: string;
  archived: boolean;
  currentProjectId?: string;
  onChangeArchived: (event: ChangeEvent<HTMLInputElement>) => void;
  onChangeQuery: (event: ChangeEvent<HTMLInputElement>) => void;
  onOpenSource: () => void;
  query: string;
}) {
  const { status, changeStatus } = useDecisionStatus();
  const searchResults = useQuery({
    ...universalSearchQueryOptions(accountId, {
      query,
      index: "Search",
      decisionStatus: status,
      archived,
      ...(currentProjectId ? { currentProjectId } : {}),
    }),
    enabled: Boolean(accountId) && Boolean(query.trim()),
  });
  return (
    <>
      <DecisionStatusFilter onChange={changeStatus} value={status} />
      <SearchPanel
        archived={archived}
        failed={searchResults.isError}
        onChangeArchived={onChangeArchived}
        onChangeQuery={onChangeQuery}
        onOpenSource={onOpenSource}
        pending={searchResults.isPending && Boolean(query.trim())}
        query={query}
        results={searchResults.data}
      />
    </>
  );
}

function RecordIndexSurface({
  accountId,
  archived,
  currentProjectId,
  index,
  onChangeArchived,
  onChangeScope,
  onOpenSource,
  scope,
}: {
  accountId: string;
  archived: boolean;
  currentProjectId?: string;
  index: RecordDiscoveryIndex;
  onChangeArchived: (event: ChangeEvent<HTMLInputElement>) => void;
  onChangeScope: (event: ChangeEvent<HTMLSelectElement>) => void;
  onOpenSource: () => void;
  scope: RecordDiscoveryScope;
}) {
  const { status, changeStatus } = useDecisionStatus();
  const [type, setType] = useState("");
  const [folder, setFolder] = useState("");
  const changeType = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => setType(event.target.value),
    [],
  );
  const changeFolder = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => setFolder(event.target.value),
    [],
  );
  const changeScope = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      onChangeScope(event);
      setFolder("");
    },
    [onChangeScope],
  );
  const indexInput = discoveryIndexInput(
    index,
    scope,
    archived,
    currentProjectId,
  );
  const metadataIndex = hasMetadataFilters(index);
  const projectsQuery = useQuery({
    ...projectsQueryOptions(),
    enabled: Boolean(accountId),
  });
  const indexInventory = useQuery({
    ...universalSearchQueryOptions(accountId, indexInput),
    enabled: Boolean(accountId) && metadataIndex,
  });
  const indexResults = useQuery({
    ...universalSearchQueryOptions(accountId, {
      ...indexInput,
      ...(index === "All Decisions" ? { decisionStatus: status } : {}),
      ...(metadataIndex && type ? { type } : {}),
      ...(metadataIndex && folder ? { folder } : {}),
    }),
    enabled: Boolean(accountId),
  });
  const projects = projectsQuery.data ?? [];
  const inventory = indexInventory.data ?? [];
  return (
    <>
      {index === "All Decisions" ? (
        <DecisionStatusFilter onChange={changeStatus} value={status} />
      ) : null}
      <IndexPanel
        archived={archived}
        failed={discoveryIndexFailed({
          index,
          inventoryFailed: indexInventory.isError,
          projectsFailed: projectsQuery.isError,
          resultsFailed: indexResults.isError,
        })}
        folder={folder}
        folders={indexFolderOptions(inventory)}
        index={index}
        onChangeArchived={onChangeArchived}
        onChangeFolder={changeFolder}
        onChangeScope={changeScope}
        onChangeType={changeType}
        onOpenSource={onOpenSource}
        pending={
          indexResults.isPending ||
          projectsQuery.isPending ||
          (metadataIndex && indexInventory.isPending)
        }
        projects={projects}
        results={indexResults.data}
        scope={scope}
        type={type}
        typeOptions={indexTypeOptions(index, inventory, type)}
      />
    </>
  );
}

function RecordTableSurface({
  accountId,
  onProjectChange,
  onRecordTypeChange,
  projectId,
  recordType,
}: {
  accountId: string;
  onProjectChange: (projectId: string) => void;
  onRecordTypeChange: (recordType: RecordTableType) => void;
  projectId: string;
  recordType: RecordTableType;
}) {
  const queryClient = useQueryClient();
  const projectsQuery = useQuery({
    ...projectsQueryOptions(),
    enabled: Boolean(accountId),
  });
  const tableRecordsOptions = useMemo(
    () =>
      orpc.tableRecords.queryOptions({
        input: {
          recordType,
          ...(projectId ? { projectId } : {}),
        },
      }),
    [projectId, recordType],
  );
  const tableRecords = useQuery({
    ...tableRecordsOptions,
    enabled: Boolean(accountId),
  });
  const tableQueryKey = tableRecordsOptions.queryKey;
  const saveTableCell = useCallback(
    async (input: RecordTableCellUpdateInput) => {
      await client.updateTableCell(input);
      await queryClient.invalidateQueries({ queryKey: tableQueryKey });
    },
    [queryClient, tableQueryKey],
  );
  const applyTablePaste = useCallback(
    async (input: RecordTablePasteInput) => {
      await client.applyTablePaste(input);
      await queryClient.invalidateQueries({ queryKey: tableQueryKey });
    },
    [queryClient, tableQueryKey],
  );
  return (
    <RecordTableView
      failed={tableRecords.isError || projectsQuery.isError}
      onApplyPaste={applyTablePaste}
      onProjectChange={onProjectChange}
      onRecordTypeChange={onRecordTypeChange}
      onSaveCell={saveTableCell}
      pending={tableRecords.isPending || projectsQuery.isPending}
      projectId={projectId}
      projects={projectsQuery.data ?? []}
      records={tableRecords.data ?? []}
      recordType={recordType}
    />
  );
}

export default function DocumentDiscovery() {
  const { session } = useRouteContext({ from: "/_auth" });
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const [currentProjectId] = useMatches().flatMap((match) =>
    "projectId" in match.params ? [match.params.projectId] : [],
  );
  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger render={<Button variant="ghost" />}>Search</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Search</DialogTitle>
          <DialogDescription>
            Find authorized records across Projects and the Personal Wiki.
          </DialogDescription>
        </DialogHeader>
        <DiscoverySurface
          accountId={session.data.user.id}
          currentProjectId={currentProjectId}
          onOpenSource={close}
        />
      </DialogContent>
    </Dialog>
  );
}
