// biome-ignore-all lint/performance/noJsxPropsBind: Fields bind to their own form state.

import {
  IMPORT_CATALOG_TYPES,
  IMPORT_LABEL,
  type ImportCatalogType,
  type PreviewImportInput,
} from "@cantiara/api/data-import";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm, useSelector } from "@tanstack/react-form";
import type { SubmitEvent } from "react";
import { submitForm } from "@/lib/submit-form";
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
  previewing,
  projects,
}: {
  onPreview: (input: PreviewImportInput) => void;
  previewing: boolean;
  projects: readonly ImportProjectChoice[];
}) {
  const form = useForm({
    defaultValues: {
      catalogType: "" as ImportCatalogType | "",
      files: [] as File[],
      scopeChoice: "",
    },
    onSubmit: async ({ value }) => {
      const [file] = value.files;
      if (!file) {
        form.setErrorMap({ onSubmit: { form: "Choose a file.", fields: {} } });
        return;
      }
      form.setErrorMap({ onSubmit: undefined });
      try {
        const built = buildPreviewInput({
          catalogType: value.catalogType,
          content: await file.text(),
          fileCount: value.files.length,
          fileName: file.name,
          scopeChoice: value.scopeChoice,
        });
        if ("error" in built) {
          form.setErrorMap({ onSubmit: { form: built.error, fields: {} } });
          return;
        }
        onPreview(built.input);
      } catch (caught) {
        form.setErrorMap({
          onSubmit: { form: importErrorText(caught), fields: {} },
        });
      }
    },
  });
  const error = useSelector(
    form.store,
    (state): string | undefined => state.errorMap.onSubmit,
  );
  const pending = useSelector(form.store, (state) => state.isSubmitting);

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    submitForm(form).catch(() => undefined);
  }

  return (
    <form
      aria-label={`${IMPORT_LABEL} file`}
      className="space-y-4 rounded-lg border border-border/70 p-5"
      onSubmit={submit}
    >
      <p className="text-sm text-muted-foreground">
        One Markdown, JSON or CSV file, one record type, one place. You see the
        mapping and the exact difference before anything is written.
      </p>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
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
      <Button disabled={pending || previewing} type="submit">
        {pending || previewing ? "Reading the file…" : "Preview import"}
      </Button>
    </form>
  );
}
