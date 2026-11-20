// biome-ignore-all lint/performance/noJsxPropsBind: Tag controls close over their current record and selected tag.
import type {
  ApplyTagInput,
  RemoveTagInput,
  TagRecord,
  TagSuggestion,
} from "@cantiara/api/tags";
import { Badge } from "@cantiara/ui/components/badge";
import { Button } from "@cantiara/ui/components/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTags } from "@/features/tags/hooks/use-tags";
import { commandVariables } from "@/lib/command-variables";
import {
  client,
  invalidateSmartCollectionMembership,
  orpc,
} from "@/utils/orpc";
import { CreateTagForm } from "../forms/create-tag-form";
import { TagApplyForm } from "../forms/tag-apply-form";
import {
  TagRenameControl,
  type TagRenameRequest,
} from "../forms/tag-rename-form";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function invalidateTagQueries(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: orpc.tags.key() }),
    queryClient.invalidateQueries({ queryKey: orpc.tagRecords.key() }),
  ]);
}

// Smart Collection conditions match tag identity, so a tag assignment or
// rename can change live membership.
function invalidateTagMembershipQueries(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  return Promise.all([
    invalidateTagQueries(queryClient),
    ...invalidateSmartCollectionMembership(queryClient),
  ]);
}

function invalidateTagRenameQueries(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  return Promise.all([
    invalidateTagMembershipQueries(queryClient),
    queryClient.invalidateQueries({ queryKey: orpc.documents.key() }),
    queryClient.invalidateQueries({ queryKey: orpc.document.key() }),
    queryClient.invalidateQueries({ queryKey: orpc.documentVersions.key() }),
  ]);
}

export default function ProjectTagsSurface({
  projectId,
}: {
  projectId: string;
}) {
  const [filterTagId, setFilterTagId] = useState("");
  const [formValidationError, setFormValidationError] = useState<string | null>(
    null,
  );
  const [renameValidationError, setRenameValidationError] = useState<
    string | null
  >(null);
  const queryClient = useQueryClient();
  const { recordsQuery, tagsQuery } = useTags(
    projectId,
    filterTagId || undefined,
  );

  const create = useMutation(
    orpc.createTag.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.createTag(input),
      onSuccess: async () => {
        await invalidateTagQueries(queryClient);
      },
    }),
  );

  const apply = useMutation(
    orpc.applyTag.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.applyTag(input),
      onSuccess: async () => {
        await invalidateTagMembershipQueries(queryClient);
      },
    }),
  );

  const remove = useMutation(
    orpc.removeTag.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.removeTag(input),
      onSuccess: async () => {
        await invalidateTagMembershipQueries(queryClient);
      },
    }),
  );

  const rename = useMutation(
    orpc.renameTag.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.renameTag(input),
      onSuccess: async () => {
        undoRename.reset();
        await invalidateTagRenameQueries(queryClient);
      },
    }),
  );

  const undoRename = useMutation(
    orpc.undoTagRename.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.undoTagRename(input),
      onSuccess: async (_result, { receiptId }) => {
        if (rename.data?.receiptId === receiptId) {
          rename.reset();
        }
        await invalidateTagRenameQueries(queryClient);
      },
    }),
  );

  const renameUndo = rename.data && {
    baseRevision: rename.data.tag.revision,
    receiptId: rename.data.receiptId,
    tagId: rename.data.tag.id,
  };
  const applyError = apply.isError
    ? errorMessage(apply.error, "Tag could not be applied.")
    : null;
  const actionError = remove.isError
    ? errorMessage(remove.error, "Tag could not be removed.")
    : applyError;
  const formError =
    formValidationError ??
    (create.isError
      ? errorMessage(create.error, "Tag could not be created.")
      : null);
  const renameFailure = rename.isError
    ? errorMessage(rename.error, "Tag could not be renamed.")
    : null;
  const renameError =
    renameValidationError ??
    (undoRename.isError
      ? errorMessage(undoRename.error, "Tag could not be undone safely.")
      : renameFailure);

  return (
    <section aria-labelledby="tags-heading" className="space-y-8" id="tags">
      <header className="surface-header max-w-3xl">
        <p className="surface-kicker">Tags</p>
        <h2
          className="mt-2 text-2xl font-semibold tracking-tight text-balance sm:text-3xl"
          id="tags-heading"
        >
          Tags
        </h2>
        <p className="mt-3 text-sm/relaxed text-muted-foreground">
          Workspace-wide flat tags classify reachable Work records without
          changing their Project, status, or other memberships.
        </p>
      </header>

      <CreateTagForm
        error={formError}
        onCreate={(name) => {
          setFormValidationError(null);
          return create.mutateAsync(
            commandVariables(
              { name },
              create.isError && create.variables?.clientIdempotencyKey
                ? {
                    name: create.variables.name,
                    clientIdempotencyKey: create.variables.clientIdempotencyKey,
                  }
                : undefined,
            ),
          );
        }}
        onValidationError={setFormValidationError}
        pending={create.isPending}
      />

      {actionError ? (
        <p className="text-sm text-destructive" role="alert">
          {actionError}
        </p>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] lg:items-start">
        <TagPicker
          filterTagId={filterTagId}
          onFilterChange={setFilterTagId}
          onRename={(input) => {
            rename.mutate(
              commandVariables(
                input,
                rename.isError ? rename.variables : undefined,
              ),
            );
          }}
          onRenameValidationError={setRenameValidationError}
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
                  setRenameValidationError(
                    "Tag could not be undone. Reload this page.",
                  );
                  return;
                }
                setRenameValidationError(null);
                undoRename.mutate(
                  commandVariables(
                    renameUndo,
                    undoRename.isError ? undoRename.variables : undefined,
                  ),
                );
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
          onApply={(input) => {
            remove.reset();
            return apply.mutateAsync(input);
          }}
          onRemove={(input) => {
            apply.reset();
            remove.mutate(input);
          }}
          records={recordsQuery.data ?? []}
          recordsError={recordsQuery.isError}
          recordsPending={recordsQuery.isPending}
          removePending={remove.isPending}
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
  onRenameValidationError,
  renameError,
  renamePending,
  tags,
  tagsError,
  tagsPending,
}: {
  filterTagId: string;
  onFilterChange: (tagId: string) => void;
  onRename: (input: TagRenameRequest) => void;
  onRenameValidationError: (message: string | null) => void;
  renameError: string | null;
  renamePending: boolean;
  tags: readonly TagSuggestion[];
  tagsError: boolean;
  tagsPending: boolean;
}) {
  return (
    <section aria-labelledby="filter-by-tag-heading" className="space-y-3">
      <h3 className="text-base font-medium" id="filter-by-tag-heading">
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
        onValidationError={onRenameValidationError}
        pending={renamePending}
        tags={tags}
        tagsError={tagsError}
        tagsPending={tagsPending}
      />
      {renameError ? (
        <p className="text-sm text-destructive" role="alert">
          {renameError}
        </p>
      ) : null}
    </section>
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
      <p className="text-sm text-muted-foreground" role="status">
        Loading Tags…
      </p>
    );
  }
  if (tagsError) {
    return (
      <p className="text-sm text-destructive" role="alert">
        Tags could not be loaded. Try loading this page again.
      </p>
    );
  }
  if (tags.length === 0) {
    return <p className="text-sm text-muted-foreground">No tags yet.</p>;
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
  tags,
}: {
  applyPending: boolean;
  onApply: (input: ApplyTagInput) => Promise<unknown>;
  onRemove: (input: RemoveTagInput) => void;
  records: readonly TagRecord[];
  recordsError: boolean;
  recordsPending: boolean;
  removePending: boolean;
  tags: readonly TagSuggestion[];
}) {
  if (recordsPending) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        Loading tagged records…
      </p>
    );
  }
  if (recordsError) {
    return (
      <p className="text-sm text-destructive" role="alert">
        Tagged records could not be loaded. Try loading this page again.
      </p>
    );
  }
  if (records.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No matching records.</p>
    );
  }

  return (
    <ul aria-label="Tagged Work records" className="space-y-3">
      {records.map((record) => {
        const availableTags = tags.filter(
          ({ tag }) =>
            !record.tags.some((recordTag) => recordTag.id === tag.id),
        );
        return (
          <li
            className="grid gap-4 rounded-lg border border-border/70 bg-card/40 px-4 py-4"
            key={record.id}
          >
            <div className="min-w-0">
              <p className="text-sm font-medium">
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
                  <li className="text-xs text-muted-foreground">
                    No tags yet.
                  </li>
                )}
              </ul>
            </div>
            <TagApplyForm
              availableTags={availableTags.map(({ tag }) => tag)}
              onApply={onApply}
              pending={applyPending}
              record={{
                projectId: record.projectId,
                recordId: record.id,
                recordType: record.recordType,
              }}
            />
          </li>
        );
      })}
    </ul>
  );
}
