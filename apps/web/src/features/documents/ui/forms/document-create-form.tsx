// biome-ignore-all lint/performance/noJsxPropsBind: Document controls close over the selected record and current editor state.

import { type Document, documentTypeSchema } from "@cantiara/api/documents";
import type { StarterSkeletonSelection } from "@cantiara/api/project-shell";
import { Button } from "@cantiara/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@cantiara/ui/components/dialog";
import { Input } from "@cantiara/ui/components/input";
import { Label } from "@cantiara/ui/components/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client } from "@/utils/orpc";
import { createDocumentFormSchema } from "../../lib/document-form";

type DocumentStarterSkeleton = Extract<
  StarterSkeletonSelection,
  { surface: "Document" }
>["skeleton"];
type DocumentCreateInput =
  | { skeleton: DocumentStarterSkeleton }
  | { title: string; type: Document["type"] };
export type DocumentStarterSkeletonSelection = Extract<
  StarterSkeletonSelection,
  { surface: "Document" }
>;

export default function DocumentCreateForm({
  documentStarterSkeletons,
  onCreated,
  onOpenChange,
  open: createOpen,
  projectId,
}: {
  documentStarterSkeletons: readonly DocumentStarterSkeletonSelection[];
  onCreated: (created: Document) => Promise<void>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  projectId: string | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const pendingCreate = useRef<{
    clientIdempotencyKey: string;
    projectId: string | null;
    value: DocumentCreateInput;
  } | null>(null);

  function createIdempotencyKey(value: DocumentCreateInput) {
    const pending = pendingCreate.current;
    if (
      pending &&
      pending.projectId === projectId &&
      ("skeleton" in value
        ? "skeleton" in pending.value &&
          pending.value.skeleton === value.skeleton
        : !("skeleton" in pending.value) &&
          pending.value.title === value.title &&
          pending.value.type === value.type)
    ) {
      return pending.clientIdempotencyKey;
    }
    const clientIdempotencyKey = crypto.randomUUID();
    pendingCreate.current = {
      clientIdempotencyKey,
      projectId,
      value: { ...value },
    };
    return clientIdempotencyKey;
  }

  const create = useMutation({
    mutationFn: (command: {
      clientIdempotencyKey: string;
      value: DocumentCreateInput;
    }) =>
      runOnlineOnlyWrite(() => {
        const mutationEnvelope = {
          projectId,
          baseRevision: 0,
          clientIdempotencyKey: command.clientIdempotencyKey,
        };
        if ("skeleton" in command.value) {
          if (projectId === null) {
            throw new Error("Starter skeletons require a Project.");
          }
          return client.createDocument({
            ...mutationEnvelope,
            projectId,
            skeleton: command.value.skeleton,
          });
        }
        return client.createDocument({
          ...mutationEnvelope,
          ...command.value,
          body: "",
        });
      }),
    onSuccess: async (created, command) => {
      if (
        pendingCreate.current?.clientIdempotencyKey ===
        command.clientIdempotencyKey
      ) {
        pendingCreate.current = null;
      }
      setError(null);
      form.reset();
      await onCreated(created);
    },
    onError: (failure) =>
      setError(
        failure instanceof Error
          ? failure.message
          : "Document could not be created.",
      ),
  });
  const form = useForm({
    defaultValues: {
      skeleton: "" as "" | DocumentStarterSkeleton,
      title: "",
      type: "General" as Document["type"],
    },
    onSubmit: async ({ value }) => {
      const parsed = createDocumentFormSchema.safeParse(value);
      if (!parsed.success) {
        setError(
          parsed.error.issues[0]?.message ?? "Document could not be created.",
        );
        return;
      }
      const createValue: DocumentCreateInput = parsed.data;
      await create.mutateAsync({
        clientIdempotencyKey: createIdempotencyKey(createValue),
        value: createValue,
      });
    },
  });

  return (
    <Dialog
      onOpenChange={(open) => {
        onOpenChange(open);
        if (!open) {
          form.reset();
          setError(null);
        }
      }}
      open={createOpen}
    >
      <DialogContent className="rounded-xl p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">Create Document</DialogTitle>
          <DialogDescription>
            {documentStarterSkeletons.length > 0
              ? "Choose a starter skeleton, or give this Document a title and type."
              : "Give this Document a title and choose its type."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            form.handleSubmit().catch(() => undefined);
          }}
        >
          {documentStarterSkeletons.length > 0 ? (
            <form.Field name="skeleton">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor="new-document-starter-skeleton">
                    Starter skeleton
                  </Label>
                  <NativeSelect
                    id="new-document-starter-skeleton"
                    onBlur={field.handleBlur}
                    onChange={(event) =>
                      field.handleChange(
                        documentStarterSkeletons.find(
                          ({ skeleton }) => skeleton === event.target.value,
                        )?.skeleton ?? "",
                      )
                    }
                    value={field.state.value}
                  >
                    <NativeSelectOption value="">
                      No starter skeleton
                    </NativeSelectOption>
                    {documentStarterSkeletons.map(({ skeleton }) => (
                      <NativeSelectOption key={skeleton} value={skeleton}>
                        {skeleton}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>
              )}
            </form.Field>
          ) : null}
          <form.Subscribe selector={(state) => state.values.skeleton}>
            {(skeleton) =>
              skeleton ? null : (
                <>
                  <form.Field name="title">
                    {(field) => (
                      <div className="space-y-2">
                        <Label htmlFor="new-document-title">Title</Label>
                        <Input
                          autoFocus
                          id="new-document-title"
                          onBlur={field.handleBlur}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
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
                </>
              )
            }
          </form.Subscribe>
          {error ? (
            <p className="text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              onClick={() => onOpenChange(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <form.Subscribe
              selector={(state) => ({
                skeleton: state.values.skeleton,
                title: state.values.title,
                isSubmitting: state.isSubmitting,
              })}
            >
              {({ skeleton, title, isSubmitting }) => (
                <Button
                  disabled={isSubmitting || !(skeleton || title.trim())}
                  type="submit"
                >
                  Create Document
                </Button>
              )}
            </form.Subscribe>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
