// biome-ignore-all lint/performance/noJsxPropsBind: The file control binds to the form field.
import { TEST_SESSION_LABEL } from "@cantiara/api/test-report";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { useForm, useStore } from "@tanstack/react-form";
import { type FormEvent, useState } from "react";
import { refusalText } from "../../lib/refusal-text";
import {
  parseTestSessionImport,
  reportFormatOf,
} from "../../lib/test-report-form";

export type ImportTestSessionFile = (file: {
  content: string;
  format: "json" | "markdown";
}) => Promise<unknown>;

export default function TestSessionImportForm({
  onImport,
}: {
  onImport: ImportTestSessionFile;
}) {
  const [error, setError] = useState<string>();
  const form = useForm({
    defaultValues: { file: null as File | null },
    onSubmit: async ({ value }) => {
      const { file } = value;
      if (!file) {
        return;
      }
      const format = reportFormatOf(file.name);
      if (!format) {
        setError("Choose a .json, .md or .markdown file.");
        return;
      }
      setError(undefined);
      try {
        const parsed = parseTestSessionImport({
          content: await file.text(),
          format,
        });
        if (!parsed.success) {
          setError(
            parsed.error.issues[0]?.message ??
              `${TEST_SESSION_LABEL} was not imported.`,
          );
          return;
        }
        await onImport(parsed.data);
        form.reset();
      } catch (caught) {
        setError(
          refusalText(caught, `${TEST_SESSION_LABEL} was not imported.`),
        );
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
      aria-label={`Import ${TEST_SESSION_LABEL} file`}
      className="space-y-3 rounded-lg border border-border/70 p-5"
      onSubmit={submit}
    >
      <h3 className="font-medium">{`Import ${TEST_SESSION_LABEL} file`}</h3>
      <p className="text-muted-foreground text-xs">
        A JSON file or a Markdown file with YAML frontmatter, using the
        test-report/1 contract. The file is checked as a whole; nothing is
        imported if any part is refused.
      </p>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <div className="grid gap-2 text-sm">
        <label htmlFor="test-session-file">Test report file</label>
        <form.Field name="file">
          {(field) => (
            <Input
              accept=".json,.md,.markdown"
              disabled={pending}
              id="test-session-file"
              name={field.name}
              onChange={(event) =>
                field.handleChange(event.target.files?.[0] ?? null)
              }
              type="file"
            />
          )}
        </form.Field>
      </div>
      <form.Subscribe selector={(state) => state.values.file}>
        {(file) => (
          <Button disabled={pending || !file} type="submit">
            {`Import ${TEST_SESSION_LABEL} file`}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
