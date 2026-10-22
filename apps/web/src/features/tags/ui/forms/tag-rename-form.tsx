// biome-ignore-all lint/performance/noJsxPropsBind: Tag controls close over their current form fields.
import { createTagInputSchema, type TagSuggestion } from "@cantiara/api/tags";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { Label } from "@cantiara/ui/components/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import type { FormEvent } from "react";

export interface TagRenameRequest {
  baseRevision: number;
  name: string;
  tagId: string;
}

export function TagRenameControl({
  onRename,
  onValidationError,
  pending,
  tags,
  tagsError,
  tagsPending,
}: {
  onRename: (input: TagRenameRequest) => void;
  onValidationError: (message: string | null) => void;
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
      if (!parsed.success) {
        onValidationError(
          parsed.error.issues[0]?.message ?? "Check the tag name.",
        );
        return;
      }
      if (!selectedTag) {
        onValidationError("Tag is unavailable.");
        return;
      }
      onValidationError(null);
      onRename({
        baseRevision: selectedTag.revision,
        name: parsed.data.name,
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
