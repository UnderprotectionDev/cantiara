// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the chosen file and the upload phase.
import {
  FILE_ATTACHMENT_TYPE_RULES,
  FILE_ATTACHMENT_UI_LABELS,
} from "@cantiara/api/file-attachments";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { useForm, useSelector } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type ChangeEvent,
  type SubmitEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
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
  const [finalizingKey, setFinalizingKey] = useState<string>();
  const uploadInput = useRef<{
    file: File;
    key: string;
    projectId: string;
  } | null>(null);
  const staging = useRef<{ controller: AbortController; key: string } | null>(
    null,
  );
  useEffect(() => () => staging.current?.controller.abort(), []);
  const form = useForm({
    defaultValues: { file: null as File | null },
    onSubmit: async ({ value }) => {
      const parsed = parseUploadSelection(value.file);
      if (!parsed.ok || uploadMutation.isPending || staging.current) {
        return;
      }
      try {
        if (
          uploadInput.current?.file !== parsed.file ||
          uploadInput.current.projectId !== projectId
        ) {
          uploadInput.current = {
            file: parsed.file,
            key: crypto.randomUUID(),
            projectId,
          };
        }
        const { key } = uploadInput.current;
        staging.current = { controller: new AbortController(), key };
        await uploadMutation.mutateAsync({
          clientIdempotencyKey: key,
          projectId,
        });
      } catch {
        // Query reports the failure and the chosen file stays selected.
      }
    },
  });
  const selectedFile = useSelector(form.store, (state) => state.values.file);
  const uploadMutation = useMutation({
    gcTime: 0,
    meta: { onlineWrite: true, privateInput: true },
    mutationKey: orpc.finalizeFileAttachment.mutationKey(),
    mutationFn: ({
      clientIdempotencyKey,
      projectId: targetProjectId,
    }: {
      clientIdempotencyKey: string;
      projectId: string;
    }) => {
      const prepared = uploadInput.current;
      const attempt = staging.current;
      if (
        prepared?.key !== clientIdempotencyKey ||
        attempt?.key !== clientIdempotencyKey
      ) {
        throw new DOMException(
          "The staging upload was cancelled.",
          "AbortError",
        );
      }
      return uploadFileAttachment(
        prepared.file,
        { kind: "project", projectId: targetProjectId },
        { createIdempotencyKey: () => clientIdempotencyKey },
        {
          onFinalizeStart: () => {
            staging.current = null;
            setFinalizingKey(clientIdempotencyKey);
          },
          signal: attempt.controller.signal,
        },
      );
    },
    onSettled: (_, _failure, { clientIdempotencyKey }) => {
      if (staging.current?.key === clientIdempotencyKey) {
        staging.current = null;
      }
      setFinalizingKey((key) =>
        key === clientIdempotencyKey ? undefined : key,
      );
    },
    onSuccess: async (
      _,
      { clientIdempotencyKey, projectId: targetProjectId },
    ) => {
      if (uploadInput.current?.key === clientIdempotencyKey) {
        form.reset();
        uploadInput.current = null;
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
      await queryClient.invalidateQueries({
        queryKey: orpc.fileAttachments.queryKey({
          input: { scope: { kind: "project", projectId: targetProjectId } },
        }),
      });
    },
  });
  const { reset: resetUpload } = uploadMutation;
  const pendingPhase =
    finalizingKey &&
    uploadMutation.variables?.clientIdempotencyKey === finalizingKey
      ? "finalizing"
      : "staging";
  const phase = uploadMutation.isPending ? pendingPhase : "idle";
  const error =
    uploadMutation.isError && !isUploadAbortError(uploadMutation.error)
      ? uploadErrorMessage(uploadMutation.error)
      : null;

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      form.setFieldValue("file", event.target.files?.[0] ?? null);
      uploadInput.current = null;
      resetUpload();
    },
    [form, resetUpload],
  );

  const handleChooseFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleSubmit = useCallback(
    (event: SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();
      event.stopPropagation();
      form.handleSubmit().catch(() => undefined);
    },
    [form],
  );

  const handleCancel = useCallback(() => {
    if (phase !== "idle" && !staging.current) {
      // Cancel is available only while staging still owns an abort signal.
      return;
    }
    staging.current?.controller.abort();
    staging.current = null;
    resetUpload();
    form.reset();
    uploadInput.current = null;
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [form, phase, resetUpload]);

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
