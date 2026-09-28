// biome-ignore-all lint/performance/noJsxPropsBind: Document controls close over the selected record and current editor state.
import { type Document, documentTypeSchema } from "@cantiara/api/documents";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { Label } from "@cantiara/ui/components/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import { Mathematics } from "@tiptap/extension-mathematics";
import { TableKit } from "@tiptap/extension-table";
import { Markdown as TiptapMarkdown } from "@tiptap/markdown";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { common, createLowlight } from "lowlight";
import { useState } from "react";

import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";

import DocumentPreview from "./document-preview";

const lowlight = createLowlight(common);

function DocumentEditor({
  record,
  onSaved,
}: {
  record: Document;
  onSaved: () => Promise<void>;
}) {
  const [revision, setRevision] = useState(record.revision);
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (value: {
      title: string;
      type: Document["type"];
      body: string;
    }) =>
      runOnlineOnlyWrite(() =>
        client.updateDocument({
          documentId: record.id,
          baseRevision: revision,
          ...value,
        }),
      ),
    onSuccess: async (saved) => {
      setRevision(saved.revision);
      setError(null);
      await onSaved();
    },
    onError: (failure) =>
      setError(
        failure instanceof Error
          ? failure.message
          : "Document could not be saved.",
      ),
  });
  const form = useForm({
    defaultValues: {
      title: record.title,
      type: record.type,
      body: record.body,
    },
    onSubmit: async ({ value }) => {
      await save.mutateAsync(value);
    },
  });
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      CodeBlockLowlight.configure({ lowlight }),
      Mathematics,
      TableKit,
      TiptapMarkdown.configure({ markedOptions: { gfm: true } }),
    ],
    content: record.body,
    contentType: "markdown",
    editorProps: {
      attributes: {
        "aria-label": "Document editor",
        class:
          "document-rich-editor min-h-36 rounded-md border p-3 focus-visible:outline-2 focus-visible:outline-ring",
      },
    },
    onUpdate: ({ editor: current }) =>
      form.setFieldValue("body", current.getMarkdown()),
  });

  return (
    <section aria-label="Document">
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          form.handleSubmit().catch(() => undefined);
        }}
      >
        <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
          <form.Field name="title">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor="document-title">Title</Label>
                <Input
                  id="document-title"
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  value={field.state.value}
                />
              </div>
            )}
          </form.Field>
          <form.Field name="type">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor="document-type">Type</Label>
                <NativeSelect
                  id="document-type"
                  onBlur={field.handleBlur}
                  onChange={(event) =>
                    field.handleChange(
                      documentTypeSchema.parse(event.target.value),
                    )
                  }
                  value={field.state.value}
                >
                  {documentTypeSchema.options.map((option) => (
                    <NativeSelectOption key={option} value={option}>
                      {option}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
            )}
          </form.Field>
        </div>
        <div className="space-y-2">
          <Label>Document editor</Label>
          <EditorContent editor={editor} />
        </div>
        <form.Field name="body">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor="document-markdown">Markdown</Label>
              <textarea
                className="min-h-44 w-full rounded-md border bg-background p-3 font-mono text-sm focus-visible:outline-2 focus-visible:outline-ring"
                id="document-markdown"
                onChange={(event) => {
                  const next = event.target.value;
                  field.handleChange(next);
                  try {
                    editor?.commands.setContent(next, {
                      contentType: "markdown",
                      emitUpdate: false,
                    });
                  } catch {
                    /* The source stays editable when rich parsing fails. */
                  }
                }}
                value={field.state.value}
              />
            </div>
          )}
        </form.Field>
        {error ? (
          <p className="text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <form.Subscribe
          selector={(state) => ({
            body: state.values.body,
            title: state.values.title,
            isSubmitting: state.isSubmitting,
          })}
        >
          {({ body, title, isSubmitting }) => (
            <>
              <Button disabled={isSubmitting || !title.trim()} type="submit">
                Save
              </Button>
              <DocumentPreview source={body} />
            </>
          )}
        </form.Subscribe>
      </form>
    </section>
  );
}

export default function ProjectDocumentsSurface({
  projectId,
}: {
  projectId: string;
}) {
  const queryClient = useQueryClient();
  const options = orpc.documents.queryOptions({ input: { projectId } });
  const documents = useQuery(options);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: (value: { title: string; type: Document["type"] }) =>
      runOnlineOnlyWrite(() =>
        client.createDocument({
          projectId,
          ...value,
          body: "",
        }),
      ),
    onSuccess: async (created) => {
      setError(null);
      form.reset();
      setSelectedId(created.id);
      await queryClient.invalidateQueries({ queryKey: options.queryKey });
    },
    onError: (failure) =>
      setError(
        failure instanceof Error
          ? failure.message
          : "Document could not be created.",
      ),
  });
  const form = useForm({
    defaultValues: { title: "", type: "General" as Document["type"] },
    onSubmit: async ({ value }) => {
      await create.mutateAsync(value);
    },
  });
  const selected = documents.data?.find((item) => item.id === selectedId);

  return (
    <section aria-label="Documents" className="space-y-6">
      <header>
        <h2 className="font-semibold text-2xl">Documents</h2>
      </header>
      <form
        className="grid items-end gap-3 sm:grid-cols-[1fr_12rem_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          form.handleSubmit().catch(() => undefined);
        }}
      >
        <form.Field name="title">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor="new-document-title">Title</Label>
              <Input
                id="new-document-title"
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                required
                value={field.state.value}
              />
            </div>
          )}
        </form.Field>
        <form.Field name="type">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor="new-document-type">Type</Label>
              <NativeSelect
                id="new-document-type"
                onBlur={field.handleBlur}
                onChange={(event) =>
                  field.handleChange(
                    documentTypeSchema.parse(event.target.value),
                  )
                }
                value={field.state.value}
              >
                {documentTypeSchema.options.map((option) => (
                  <NativeSelectOption key={option} value={option}>
                    {option}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          )}
        </form.Field>
        <form.Subscribe
          selector={(state) => ({
            title: state.values.title,
            isSubmitting: state.isSubmitting,
          })}
        >
          {({ title, isSubmitting }) => (
            <Button disabled={isSubmitting || !title.trim()} type="submit">
              Create Document
            </Button>
          )}
        </form.Subscribe>
      </form>
      {error ? (
        <p className="text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {documents.isError ? (
        <p role="alert">Documents could not be loaded.</p>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
        <nav aria-label="Documents" className="space-y-2">
          {documents.data?.map((item) => (
            <Button
              className="w-full justify-start"
              key={item.id}
              onClick={() => setSelectedId(item.id)}
              variant={item.id === selectedId ? "secondary" : "ghost"}
            >
              {item.title}
            </Button>
          ))}
        </nav>
        {selected ? (
          <DocumentEditor
            key={selected.id}
            onSaved={() =>
              queryClient.invalidateQueries({ queryKey: options.queryKey })
            }
            record={selected}
          />
        ) : (
          <p>Select a Document.</p>
        )}
      </div>
    </section>
  );
}
