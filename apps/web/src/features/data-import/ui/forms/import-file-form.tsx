// biome-ignore-all lint/performance/noJsxPropsBind: Fields bind to their own form state.
import {
  IMPORT_CATALOG_TYPES,
  IMPORT_LABEL,
  type ImportCatalogType,
  type ImportPreview,
  type PreviewImportInput,
} from "@cantiara/api/data-import";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm, useStore } from "@tanstack/react-form";
import { type FormEvent, useState } from "react";
import {
  buildPreviewInput,
  IMPORT_FILE_ACCEPT,
  importErrorText,
  projectScopeValue,
  WIKI_SCOPE,
  WORKSPACE_SCOPE,
} from "../../lib/import-form";

export interface ImportProjectChoice {
  id: string;
  name: string;
}

/**
 * Choose one file, where it goes and (for CSV/JSON) what one record type it
 * holds. Submitting reads the file and asks for the preview; nothing is
 * written. The picker takes several files only so that a multi-file choice is
 * refused with a visible reason instead of being silently reduced to one.
 */
export default function ImportFileForm({
  onPreview,
  projects,
}: {
  onPreview: (input: PreviewImportInput) => Promise<ImportPreview>;
  projects: readonly ImportProjectChoice[];
}) {
  const [error, setError] = useState<string>();
  const form = useForm({
    defaultValues: {
      catalogType: "" as ImportCatalogType | "",
      files: [] as File[],
      scopeChoice: "",
    },
    onSubmit: async ({ value }) => {
      const [file] = value.files;
      if (!file) {
        setError("Choose a file.");
        return;
      }
      setError(undefined);
      try {
        const built = buildPreviewInput({
          catalogType: value.catalogType,
          content: await file.text(),
          fileCount: value.files.length,
          fileName: file.name,
          scopeChoice: value.scopeChoice,
        });
        if ("error" in built) {
          setError(built.error);
          return;
        }
        await onPreview(built.input);
      } catch (caught) {
        setError(importErrorText(caught));
      }
    },
  });
  const pending = useStore(form.store, (state) => state.isSubmitting);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }

  return (
    <form
      aria-label={`${IMPORT_LABEL} file`}
      className="space-y-4 rounded-lg border border-border/70 p-5"
      onSubmit={submit}
    >
      <p className="text-muted-foreground text-sm">
        One Markdown, JSON or CSV file, one record type, one place. You see the
        mapping and the exact difference before anything is written.
      </p>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <div className="grid gap-2 text-sm">
        <label htmlFor="import-file">File</label>
        <form.Field name="files">
          {(field) => (
            <Input
              accept={IMPORT_FILE_ACCEPT}
              disabled={pending}
              id="import-file"
              multiple
              name={field.name}
              onChange={(event) =>
                field.handleChange(Array.from(event.target.files ?? []))
              }
              type="file"
            />
          )}
        </form.Field>
      </div>
      <div className="grid gap-2 text-sm">
        <label htmlFor="import-scope">Import into</label>
        <form.Field name="scopeChoice">
          {(field) => (
            <NativeSelect
              disabled={pending}
              id="import-scope"
              name={field.name}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            >
              <NativeSelectOption value="">Choose a place</NativeSelectOption>
              {projects.map((project) => (
                <NativeSelectOption
                  key={project.id}
                  value={projectScopeValue(project.id)}
                >
                  {project.name}
                </NativeSelectOption>
              ))}
              <NativeSelectOption value={WIKI_SCOPE}>
                Personal Wiki
              </NativeSelectOption>
              <NativeSelectOption value={WORKSPACE_SCOPE}>
                Workspace
              </NativeSelectOption>
            </NativeSelect>
          )}
        </form.Field>
      </div>
      <div className="grid gap-2 text-sm">
        <label htmlFor="import-type">Record type (CSV and JSON)</label>
        <form.Field name="catalogType">
          {(field) => (
            <NativeSelect
              disabled={pending}
              id="import-type"
              name={field.name}
              onChange={(event) =>
                field.handleChange(event.target.value as ImportCatalogType | "")
              }
              value={field.state.value}
            >
              <NativeSelectOption value="">
                Not needed for Markdown
              </NativeSelectOption>
              {IMPORT_CATALOG_TYPES.map((type) => (
                <NativeSelectOption key={type} value={type}>
                  {type}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </form.Field>
      </div>
      <Button disabled={pending} type="submit">
        {pending ? "Reading the file…" : "Preview import"}
      </Button>
    </form>
  );
}
