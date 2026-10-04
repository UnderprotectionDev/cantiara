import { type Document, documentTypeSchema } from "@cantiara/api/documents";
import {
  type DocumentDiscoveryInput,
  type DocumentDiscoveryResult,
  documentDiscoveryInputSchema,
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
import { useQuery } from "@tanstack/react-query";
import { useMatches, useRouteContext } from "@tanstack/react-router";
import { type ChangeEvent, useCallback, useState } from "react";
import { z } from "zod";
import { documentsInScope } from "@/features/personal-wiki/document-scope";
import {
  documentDiscoveryQueryOptions,
  universalSearchQueryOptions,
} from "@/utils/orpc";
import DocumentDiscoveryResults from "./document-discovery-results";
import UniversalSearchResults from "./universal-search-results";

const discoveryViewSchema = z.enum(["Search", "All Documents"]);
type DiscoveryView = z.infer<typeof discoveryViewSchema>;

export function parseDiscoveryView(value: string): DiscoveryView {
  return discoveryViewSchema.parse(value);
}

export function discoveryScopeValue(scope: DocumentDiscoveryInput["scope"]) {
  return scope.kind === "project" ? `project:${scope.projectId}` : scope.kind;
}

export function parseDiscoveryScope(
  value: string,
): DocumentDiscoveryInput["scope"] {
  if (value === "all") {
    return { kind: "all" };
  }
  if (value === "wiki") {
    return { kind: "wiki" };
  }
  if (!value.startsWith("project:")) {
    throw new Error("Invalid discovery scope");
  }
  return documentDiscoveryInputSchema.shape.scope.parse({
    kind: "project",
    projectId: value.slice("project:".length),
  });
}

function DiscoveryContent({
  failed,
  pending,
  data,
  onOpenSource,
}: {
  failed: boolean;
  pending: boolean;
  data?: DocumentDiscoveryResult[];
  onOpenSource: () => void;
}) {
  if (failed) {
    return <p role="alert">Search is unavailable.</p>;
  }
  if (pending) {
    return <p role="status">Loading…</p>;
  }
  if (!data?.length) {
    return <p>No matching records.</p>;
  }
  return (
    <DocumentDiscoveryResults
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
  const [scope, setScope] = useState<DocumentDiscoveryInput["scope"]>({
    kind: "all",
  });
  const [type, setType] = useState<Document["type"] | "">("");
  const [folder, setFolder] = useState("");
  const [archived, setArchived] = useState(false);
  const changeView = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) =>
      setView(parseDiscoveryView(event.target.value)),
    [],
  );
  const changeQuery = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value),
    [],
  );
  const changeScope = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
    setScope(parseDiscoveryScope(event.target.value));
    setFolder("");
  }, []);
  const changeType = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) =>
      setType(
        event.target.value === ""
          ? ""
          : documentTypeSchema.parse(event.target.value),
      ),
    [],
  );
  const changeFolder = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => setFolder(event.target.value),
    [],
  );
  const changeArchived = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setArchived(event.target.checked),
    [],
  );
  const inventory = useQuery({
    ...documentDiscoveryQueryOptions(accountId, { archived }),
    enabled: Boolean(accountId) && view === "All Documents",
  });
  const documentResults = useQuery({
    ...documentDiscoveryQueryOptions(accountId, {
      query: "",
      scope,
      archived,
      ...(type ? { type } : {}),
      ...(folder ? { folder } : {}),
      ...(currentProjectId ? { currentProjectId } : {}),
    }),
    enabled: Boolean(accountId) && view === "All Documents",
  });
  const searchResults = useQuery({
    ...universalSearchQueryOptions(accountId, {
      query,
      archived,
      ...(currentProjectId ? { currentProjectId } : {}),
    }),
    enabled: Boolean(accountId) && view === "Search" && Boolean(query.trim()),
  });
  const projects = new Map(
    (inventory.data ?? []).flatMap(({ document, projectName }) =>
      document.projectId === null
        ? []
        : [[document.projectId, projectName ?? document.projectId] as const],
    ),
  );
  const folders = [
    ...new Set(
      documentsInScope(
        (inventory.data ?? []).map(({ document }) => document),
        scope,
      ).flatMap((document) => (document.folder ? [document.folder] : [])),
    ),
  ].sort();
  return (
    <div className="space-y-4">
      <Label htmlFor="discovery-view">Discovery view</Label>
      <NativeSelect id="discovery-view" onChange={changeView} value={view}>
        <NativeSelectOption value="Search">Search</NativeSelectOption>
        <NativeSelectOption value="All Documents">
          All Documents
        </NativeSelectOption>
      </NativeSelect>
      {view === "Search" ? (
        <>
          <Label htmlFor="discovery-query">Search</Label>
          <Input
            id="discovery-query"
            maxLength={200}
            onChange={changeQuery}
            value={query}
          />
          <Label>
            <input
              checked={archived}
              onChange={changeArchived}
              type="checkbox"
            />
            Archived
          </Label>
          <UniversalSearchContent
            data={searchResults.data}
            failed={searchResults.isError}
            onOpenSource={onOpenSource}
            pending={searchResults.isPending && Boolean(query.trim())}
            query={query}
          />
        </>
      ) : (
        <>
          <p className="text-muted-foreground text-sm">Documents</p>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="discovery-scope">Scope</Label>
              <NativeSelect
                id="discovery-scope"
                onChange={changeScope}
                value={discoveryScopeValue(scope)}
              >
                <NativeSelectOption value="all">All scopes</NativeSelectOption>
                <NativeSelectOption value="wiki">
                  Personal Wiki
                </NativeSelectOption>
                {[...projects].map(([projectId, name]) => (
                  <NativeSelectOption
                    key={projectId}
                    value={`project:${projectId}`}
                  >
                    Project: {name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label htmlFor="discovery-type">Type</Label>
              <NativeSelect
                id="discovery-type"
                onChange={changeType}
                value={type}
              >
                <NativeSelectOption value="">All types</NativeSelectOption>
                {documentTypeSchema.options.map((option) => (
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
                onChange={changeFolder}
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
            <Label>
              <input
                checked={archived}
                onChange={changeArchived}
                type="checkbox"
              />
              Archived
            </Label>
          </div>
          <DiscoveryContent
            data={documentResults.data}
            failed={documentResults.isError || inventory.isError}
            onOpenSource={onOpenSource}
            pending={documentResults.isPending}
          />
        </>
      )}
    </div>
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
