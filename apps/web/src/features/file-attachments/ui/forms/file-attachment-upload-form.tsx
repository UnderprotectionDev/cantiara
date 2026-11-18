// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the chosen file and the upload phase.
import {
  FILE_ATTACHMENT_TYPE_RULES,
  FILE_ATTACHMENT_UI_LABELS,
} from "@cantiara/api/file-attachments";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useRef,
  useState,
} from "react";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { orpc } from "@/utils/orpc";
import { uploadFileAttachment } from "../../lib/file-attachment-upload";
import { parseUploadSelection } from "../../lib/file-attachment-upload-form";

const FILE_ATTACHMENT_ACCEPT = Object.values(FILE_ATTACHMENT_TYPE_RULES)
  .flatMap((rule) => [...rule.extensions, ...rule.mimeTypes])
  .join(",");

function uploadErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  return "File Attachment upload could not be completed. Try again.";
}

function isUploadAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

type UploadPhase = "idle" | "staging" | "finalizing";

function uploadLabelForPhase(phase: UploadPhase) {
  if (phase === "staging") {
    return FILE_ATTACHMENT_UI_LABELS.uploading;
  }
  if (phase === "finalizing") {
    return FILE_ATTACHMENT_UI_LABELS.finalizing;
  }
  return FILE_ATTACHMENT_UI_LABELS.upload;
}

export function FileAttachmentUploadControl({
  projectId,
}: {
  projectId: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const pendingClientIdempotencyKey = useRef<string | null>(null);
  const stagingController = useRef<AbortController | null>(null);
  const attachmentsQuery = orpc.fileAttachments.queryOptions({
    input: { scope: { kind: "project", projectId } },
  });
  const form = useForm({
    defaultValues: { file: null as File | null },
    onSubmit: async ({ value }) => {
      const parsed = parseUploadSelection(value.file);
      if (!parsed.ok) {
        return;
      }
      try {
        await uploadMutation.mutateAsync(parsed.file);
      } catch {
        // `onError` already shows the failure; the chosen file stays selected.
      }
    },
  });
  const selectedFile = useStore(form.store, (state) => state.values.file);
  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      const clientIdempotencyKey =
        pendingClientIdempotencyKey.current ?? crypto.randomUUID();
      pendingClientIdempotencyKey.current = clientIdempotencyKey;
      const controller = new AbortController();
      stagingController.current = controller;
      setPhase("staging");
      return runOnlineOnlyWrite(() =>
        uploadFileAttachment(
          file,
          {
            kind: "project",
            projectId,
          },
          { createIdempotencyKey: () => clientIdempotencyKey },
          {
            onFinalizeStart: () => setPhase("finalizing"),
            signal: controller.signal,
          },
        ),
      );
    },
    onError: (uploadError) => {
      if (!isUploadAbortError(uploadError)) {
        setError(uploadErrorMessage(uploadError));
      }
    },
    onSettled: () => {
      stagingController.current = null;
      setPhase("idle");
    },
    onSuccess: async () => {
      setError(null);
      form.reset();
      pendingClientIdempotencyKey.current = null;
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      await queryClient.invalidateQueries({
        queryKey: attachmentsQuery.queryKey,
      });
    },
  });

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      form.setFieldValue("file", event.target.files?.[0] ?? null);
      pendingClientIdempotencyKey.current = null;
      setError(null);
    },
    [form],
  );

  const handleChooseFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      event.stopPropagation();
      form.handleSubmit().catch(() => undefined);
    },
    [form],
  );

  const handleCancel = useCallback(() => {
    if (phase === "finalizing") {
      // The barrier started with finalize; the spec forbids a fake Cancel.
      return;
    }
    if (phase === "staging") {
      stagingController.current?.abort();
    }
    setError(null);
    form.reset();
    pendingClientIdempotencyKey.current = null;
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [form, phase]);

  const uploadLabel = uploadLabelForPhase(phase);

  return (
    <form
      aria-label={FILE_ATTACHMENT_UI_LABELS.upload}
      className="max-w-3xl rounded-lg border border-border/70 bg-card/50 p-4"
      onSubmit={handleSubmit}
    >
      <div className="flex flex-wrap items-center gap-3">
        <Input
          accept={FILE_ATTACHMENT_ACCEPT}
          className="hidden"
          onChange={handleFileChange}
          ref={fileInputRef}
          type="file"
        />
        <Button
          disabled={phase !== "idle"}
          onClick={handleChooseFile}
          type="button"
          variant="outline"
        >
          {FILE_ATTACHMENT_UI_LABELS.chooseFile}
        </Button>
        <Button disabled={!selectedFile || phase !== "idle"} type="submit">
          {uploadLabel}
        </Button>
        {selectedFile && phase !== "finalizing" ? (
          <Button onClick={handleCancel} type="button" variant="ghost">
            {FILE_ATTACHMENT_UI_LABELS.cancel}
          </Button>
        ) : null}
        <p className="text-sm text-muted-foreground" role="status">
          {selectedFile?.name ?? FILE_ATTACHMENT_UI_LABELS.noFileSelected}
        </p>
      </div>
      {error ? (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
