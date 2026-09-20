// biome-ignore-all lint/performance/noJsxPropsBind: Tag controls close over their current record and selected tag.
import {
  type ApplyTagInput,
  createTagInputSchema,
  type RemoveTagInput,
  type TagRecord,
  type TagSuggestion,
} from "@cantiara/api/tags";
import { Badge } from "@cantiara/ui/components/badge";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { Label } from "@cantiara/ui/components/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type Dispatch,
  type FormEvent,
  type SetStateAction,
  useState,
} from "react";

import { useTags } from "@/features/tags/hooks/use-tags";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

interface TagRenameRequest {
  baseRevision: number;
  name: string;
  previousName: string;
  tagId: string;
}

interface TagRenameCommand extends TagRenameRequest {
  clientIdempotencyKey: string;
}

interface TagRenameUndo {
  baseRevision: number;
  name: string;
  receiptId: string;
  tagId: string;
}

function invalidateTagQueries(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: orpc.tags.key() }),
    queryClient.invalidateQueries({ queryKey: orpc.tagRecords.key() }),
  ]);
}

export default function ProjectTagsSurface({
  projectId,
}: {
  projectId: string;
}) {
  const [filterTagId, setFilterTagId] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [selectedTagByRecord, setSelectedTagByRecord] = useState<
    Record<string, string>
  >({});
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [renameUndo, setRenameUndo] = useState<TagRenameUndo | null>(null);
  const queryClient = useQueryClient();
  const { recordsQuery, tagsQuery } = useTags(
    projectId,
    filterTagId || undefined,
  );

  const create = useMutation({
    mutationFn: (name: string) =>
      runOnlineOnlyWrite(() => client.createTag({ name })),
    onError: (error) => {
      setFormError(errorMessage(error, "Tag could not be created."));
    },
    onSuccess: async () => {
      setFormError(null);
      setNewTagName("");
      await invalidateTagQueries(queryClient);
    },
  });

  const apply = useMutation({
    mutationFn: (input: Parameters<typeof client.applyTag>[0]) =>
      runOnlineOnlyWrite(() => client.applyTag(input)),
    onError: (error) => {
      setActionError(errorMessage(error, "Tag could not be applied."));
    },
    onSuccess: async (_assignment, input) => {
      setActionError(null);
      setSelectedTagByRecord((current) => ({
        ...current,
        [input.recordId]: "",
      }));
      await invalidateTagQueries(queryClient);
    },
  });

  const remove = useMutation({
    mutationFn: (input: Parameters<typeof client.removeTag>[0]) =>
      runOnlineOnlyWrite(() => client.removeTag(input)),
    onError: (error) => {
      setActionError(errorMessage(error, "Tag could not be removed."));
    },
    onSuccess: async () => {
      setActionError(null);
      await invalidateTagQueries(queryClient);
    },
  });

  const rename = useMutation({
    mutationFn: ({ previousName: _previousName, ...input }: TagRenameCommand) =>
      runOnlineOnlyWrite(() => client.renameTag(input)),
    onError: (error) => {
      setRenameError(errorMessage(error, "Tag could not be renamed."));
    },
    onSuccess: async (renamed, input) => {
      setRenameError(null);
      setRenameUndo({
        baseRevision: renamed.tag.revision,
        name: input.previousName,
        receiptId: renamed.receiptId,
        tagId: renamed.tag.id,
      });
      await invalidateTagQueries(queryClient);
    },
  });

  const undoRename = useMutation({
    mutationFn: (input: TagRenameUndo) =>
      runOnlineOnlyWrite(() =>
        client.undoTagRename({
          baseRevision: input.baseRevision,
          clientIdempotencyKey: crypto.randomUUID(),
          receiptId: input.receiptId,
          tagId: input.tagId,
        }),
      ),
    onError: (error) => {
      setRenameError(errorMessage(error, "Tag could not be undone safely."));
    },
    onSuccess: async () => {
      setRenameError(null);
      setRenameUndo(null);
      await invalidateTagQueries(queryClient);
    },
  });

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = createTagInputSchema.safeParse({ name: newTagName });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Check the tag name.");
      return;
    }
    setFormError(null);
    create.mutate(parsed.data.name);
  }

  return (
    <section aria-labelledby="tags-heading" className="space-y-8" id="tags">
      <header className="surface-header max-w-3xl">
        <p className="surface-kicker">Tags</p>
        <h2
          className="mt-2 text-balance font-semibold text-2xl tracking-tight sm:text-3xl"
          id="tags-heading"
        >
          Tags
        </h2>
        <p className="mt-3 text-muted-foreground text-sm/relaxed">
          Workspace-wide flat tags classify reachable Work records without
          changing their Project, status, or other memberships.
        </p>
      </header>

      <form
        aria-label="Create tag"
        className="grid gap-3 border-border/70 border-b pb-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
        noValidate
        onSubmit={handleCreate}
      >
        <div className="space-y-2">
          <Label htmlFor="tag-name">Name</Label>
          <Input
            disabled={create.isPending}
            id="tag-name"
            onChange={(event) => setNewTagName(event.target.value)}
            placeholder="e.g. roadmap/next"
            value={newTagName}
          />
        </div>
        <Button disabled={create.isPending} type="submit">
          Create tag
        </Button>
        {formError ? (
          <p className="text-destructive text-sm" role="alert">
            {formError}
          </p>
        ) : null}
      </form>

      {actionError ? (
        <p className="text-destructive text-sm" role="alert">
          {actionError}
        </p>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] lg:items-start">
        <TagPicker
          filterTagId={filterTagId}
          onFilterChange={setFilterTagId}
          onRename={(input) =>
            rename.mutate({
              ...input,
              clientIdempotencyKey: crypto.randomUUID(),
            })
          }
          renameError={renameError}
          renamePending={rename.isPending}
          tags={tagsQuery.data ?? []}
          tagsError={tagsQuery.isError}
          tagsPending={tagsQuery.isPending}
        />
        {renameUndo ? (
          <p className="flex items-center gap-3 text-sm" role="status">
            Tag renamed.
            <Button
              disabled={rename.isPending || undoRename.isPending}
              onClick={() => {
                const currentTag = tagsQuery.data?.find(
                  ({ tag }) => tag.id === renameUndo.tagId,
                )?.tag;
                if (!currentTag) {
                  setRenameError("Tag could not be undone. Reload this page.");
                  return;
                }
                undoRename.mutate({
                  baseRevision: renameUndo.baseRevision,
                  name: renameUndo.name,
                  receiptId: renameUndo.receiptId,
                  tagId: renameUndo.tagId,
                });
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              Undo
            </Button>
          </p>
        ) : null}
        <TagRecordList
          applyPending={apply.isPending}
          onApply={(input) => apply.mutate(input)}
          onRemove={(input) => remove.mutate(input)}
          records={recordsQuery.data ?? []}
          recordsError={recordsQuery.isError}
          recordsPending={recordsQuery.isPending}
          removePending={remove.isPending}
          selectedTagByRecord={selectedTagByRecord}
          setSelectedTagByRecord={setSelectedTagByRecord}
          tags={tagsQuery.data ?? []}
        />
      </div>
    </section>
  );
}

function TagPicker({
  filterTagId,
  onFilterChange,
  onRename,
  renameError,
  renamePending,
  tags,
  tagsError,
  tagsPending,
}: {
  filterTagId: string;
  onFilterChange: (tagId: string) => void;
  onRename: (input: TagRenameRequest) => void;
  renameError: string | null;
  renamePending: boolean;
  tags: readonly TagSuggestion[];
  tagsError: boolean;
  tagsPending: boolean;
}) {
  return (
    <section aria-labelledby="filter-by-tag-heading" className="space-y-3">
      <h3 className="font-medium text-base" id="filter-by-tag-heading">
        Filter by tag
      </h3>
      <TagFilterControl
        filterTagId={filterTagId}
        onFilterChange={onFilterChange}
        tags={tags}
        tagsError={tagsError}
        tagsPending={tagsPending}
      />
      <TagRenameControl
        onRename={onRename}
        pending={renamePending}
        tags={tags}
        tagsError={tagsError}
        tagsPending={tagsPending}
      />
      {renameError ? (
        <p className="text-destructive text-sm" role="alert">
          {renameError}
        </p>
      ) : null}
    </section>
  );
}

function TagRenameControl({
  onRename,
  pending,
  tags,
  tagsError,
  tagsPending,
}: {
  onRename: (input: TagRenameRequest) => void;
  pending: boolean;
  tags: readonly TagSuggestion[];
  tagsError: boolean;
  tagsPending: boolean;
}) {
  const form = useForm({
    defaultValues: {
      name: "",
      tagId: "",
    },
    onSubmit: ({ value }) => {
      const selectedTag = tags.find(({ tag }) => tag.id === value.tagId)?.tag;
      const parsed = createTagInputSchema.safeParse({ name: value.name });
      if (!(selectedTag && parsed.success)) {
        return;
      }
      onRename({
        baseRevision: selectedTag.revision,
        name: parsed.data.name,
        previousName: selectedTag.name,
        tagId: selectedTag.id,
      });
    },
  });

  if (tagsPending || tagsError || tags.length === 0) {
    return null;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }

  return (
    <form
      aria-label="Rename Tag"
      className="space-y-3 border-border/70 border-t pt-4"
      noValidate
      onSubmit={handleSubmit}
    >
      <h3 className="font-medium text-base">Rename Tag</h3>
      <form.Field name="tagId">
        {(field) => (
          <div className="space-y-2">
            <Label htmlFor="rename-tag-select">Tag</Label>
            <NativeSelect
              aria-label="Tag to rename"
              disabled={pending}
              id="rename-tag-select"
              name={field.name}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            >
              <NativeSelectOption value="">Select a tag</NativeSelectOption>
              {tags.map(({ tag }) => (
                <NativeSelectOption key={tag.id} value={tag.id}>
                  {tag.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        )}
      </form.Field>
      <form.Field name="name">
        {(field) => (
          <div className="space-y-2">
            <Label htmlFor="rename-tag-name">New name</Label>
            <Input
              disabled={pending}
              id="rename-tag-name"
              name={field.name}
              onChange={(event) => field.handleChange(event.target.value)}
              placeholder="e.g. launch/next"
              value={field.state.value}
            />
          </div>
        )}
      </form.Field>
      <form.Subscribe
        selector={(state) => [state.values.name, state.values.tagId] as const}
      >
        {([name, selectedTagId]) => (
          <Button
            disabled={pending || !selectedTagId || name.trim().length === 0}
            type="submit"
          >
            Rename Tag
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}

function TagFilterControl({
  filterTagId,
  onFilterChange,
  tags,
  tagsError,
  tagsPending,
}: {
  filterTagId: string;
  onFilterChange: (tagId: string) => void;
  tags: readonly TagSuggestion[];
  tagsError: boolean;
  tagsPending: boolean;
}) {
  if (tagsPending) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        Loading Tags…
      </p>
    );
  }
  if (tagsError) {
    return (
      <p className="text-destructive text-sm" role="alert">
        Tags could not be loaded. Try loading this page again.
      </p>
    );
  }
  if (tags.length === 0) {
    return <p className="text-muted-foreground text-sm">No tags yet.</p>;
  }
  return (
    <NativeSelect
      aria-label="Filter by tag"
      id="tag-filter"
      onChange={(event) => onFilterChange(event.target.value)}
      value={filterTagId}
    >
      <NativeSelectOption value="">All tags</NativeSelectOption>
      {tags.map(({ projectUsageCount, tag }) => (
        <NativeSelectOption key={tag.id} value={tag.id}>
          {tag.name}
          {projectUsageCount > 0 ? " — Suggested in this Project" : ""}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}

function TagRecordList({
  applyPending,
  onApply,
  onRemove,
  records,
  recordsError,
  recordsPending,
  removePending,
  selectedTagByRecord,
  setSelectedTagByRecord,
  tags,
}: {
  applyPending: boolean;
  onApply: (input: ApplyTagInput) => void;
  onRemove: (input: RemoveTagInput) => void;
  records: readonly TagRecord[];
  recordsError: boolean;
  recordsPending: boolean;
  removePending: boolean;
  selectedTagByRecord: Record<string, string>;
  setSelectedTagByRecord: Dispatch<SetStateAction<Record<string, string>>>;
  tags: readonly TagSuggestion[];
}) {
  if (recordsPending) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        Loading tagged records…
      </p>
    );
  }
  if (recordsError) {
    return (
      <p className="text-destructive text-sm" role="alert">
        Tagged records could not be loaded. Try loading this page again.
      </p>
    );
  }
  if (records.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">No matching records.</p>
    );
  }

  return (
    <ul aria-label="Tagged Work records" className="space-y-3">
      {records.map((record) => {
        const availableTags = tags.filter(
          ({ tag }) =>
            !record.tags.some((recordTag) => recordTag.id === tag.id),
        );
        const selectedTagId = selectedTagByRecord[record.id] ?? "";
        return (
          <li
            className="grid gap-4 rounded-lg border border-border/70 bg-card/40 px-4 py-4"
            key={record.id}
          >
            <div className="min-w-0">
              <p className="font-medium text-sm">
                <span className="text-muted-foreground">{record.key}</span>{" "}
                {record.title}
              </p>
              <ul
                aria-label={`Tags for ${record.title}`}
                className="mt-3 flex flex-wrap gap-2"
              >
                {record.tags.length > 0 ? (
                  record.tags.map((tag) => (
                    <li className="flex items-center gap-1" key={tag.id}>
                      <Badge variant="secondary">{tag.name}</Badge>
                      <Button
                        aria-label={`Remove tag ${tag.name} from ${record.title}`}
                        disabled={removePending}
                        onClick={() =>
                          onRemove({
                            projectId: record.projectId,
                            recordId: record.id,
                            recordType: record.recordType,
                            tagId: tag.id,
                          })
                        }
                        size="xs"
                        type="button"
                        variant="ghost"
                      >
                        Remove tag
                      </Button>
                    </li>
                  ))
                ) : (
                  <li className="text-muted-foreground text-xs">
                    No tags yet.
                  </li>
                )}
              </ul>
            </div>
            <div className="flex flex-wrap items-end gap-2 border-border/70 border-t pt-3">
              <div className="min-w-48 space-y-2">
                <Label htmlFor={`apply-tag-${record.id}`}>Apply tag</Label>
                <NativeSelect
                  disabled={availableTags.length === 0 || applyPending}
                  id={`apply-tag-${record.id}`}
                  onChange={(event) =>
                    setSelectedTagByRecord((current) => ({
                      ...current,
                      [record.id]: event.target.value,
                    }))
                  }
                  value={selectedTagId}
                >
                  <NativeSelectOption value="">
                    {availableTags.length === 0
                      ? "No matching tags."
                      : "Select a tag"}
                  </NativeSelectOption>
                  {availableTags.map(({ tag }) => (
                    <NativeSelectOption key={tag.id} value={tag.id}>
                      {tag.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              <Button
                disabled={!selectedTagId || applyPending}
                onClick={() =>
                  onApply({
                    projectId: record.projectId,
                    recordId: record.id,
                    recordType: record.recordType,
                    tagId: selectedTagId,
                  })
                }
                size="sm"
                type="button"
              >
                Apply tag
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
