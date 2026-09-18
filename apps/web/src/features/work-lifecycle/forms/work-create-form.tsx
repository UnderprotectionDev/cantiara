// biome-ignore-all lint/performance/noJsxPropsBind: Form field render props close over the current Work form state.
import {
  createWorkInputSchema,
  WORK_TYPE_OPTIONS,
  type WorkType,
} from "@cantiara/api/work-lifecycle";
import { Button } from "@cantiara/ui/components/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useRef, useState } from "react";

import {
  runOnlineOnlyWrite,
  useClientShellConnection,
} from "@/features/web-macos-client/views/client-shell";
import { client, orpc } from "@/utils/orpc";

const INITIAL_VALUES = {
  title: "",
  type: "Task" as WorkType,
};

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Work could not be created. Try again.";
}

export default function WorkCreateForm({ projectId }: { projectId: string }) {
  const connection = useClientShellConnection();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const [createdWorkKey, setCreatedWorkKey] = useState<string | null>(null);
  const pendingCreate = useRef<{
    clientIdempotencyKey: string;
    values: string;
  } | null>(null);
  const worksQueryKey = orpc.projectWorks.queryOptions({
    input: { projectId },
  }).queryKey;
  const projectQueryKey = orpc.project.queryOptions({
    input: { projectId },
  }).queryKey;

  const createWork = useMutation({
    mutationFn: (input: Parameters<typeof client.createWork>[0]) =>
      runOnlineOnlyWrite(() => client.createWork(input)),
    onError: (error) => {
      setFormError(errorMessage(error));
    },
    onSuccess: async (work) => {
      pendingCreate.current = null;
      setFormError(null);
      setCreatedWorkKey(work.key);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: worksQueryKey }),
        queryClient.invalidateQueries({ queryKey: projectQueryKey }),
      ]);
    },
  });

  const form = useForm({
    defaultValues: INITIAL_VALUES,
    onSubmit: async ({ value }) => {
      const parsed = createWorkInputSchema.safeParse({
        projectId,
        title: value.title,
        type: value.type,
      });
      if (!parsed.success) {
        setFormError(parsed.error.issues[0]?.message ?? "Check the form.");
        return;
      }

      setFormError(null);
      const serialized = JSON.stringify(parsed.data);
      const pending = pendingCreate.current;
      const clientIdempotencyKey =
        pending?.values === serialized
          ? pending.clientIdempotencyKey
          : crypto.randomUUID();
      pendingCreate.current = { clientIdempotencyKey, values: serialized };
      const work = await createWork.mutateAsync({
        ...parsed.data,
        baseRevision: 0,
        clientIdempotencyKey,
      });
      form.reset();
      setCreatedWorkKey(work.key);
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }

  return (
    <div className="mt-4 border-t pt-4">
      {formError ? (
        <div
          className="mb-4 border border-destructive/25 bg-destructive/5 p-3"
          role="alert"
        >
          {formError}
        </div>
      ) : null}
      {createdWorkKey ? (
        <p
          className="mb-4 border border-primary/25 bg-primary/5 p-3"
          role="status"
        >
          Work {createdWorkKey} created.
        </p>
      ) : null}
      {connection === "offline" ? (
        <p
          className="mb-4 border border-destructive/40 bg-destructive/5 p-3 text-destructive"
          role="status"
        >
          Work creation needs an active internet connection.
        </p>
      ) : null}
      <form className="space-y-5" noValidate onSubmit={handleSubmit}>
        <FieldGroup>
          <form.Field name="title">
            {(field) => (
              <Field>
                <FieldLabel htmlFor="work-title">Title</FieldLabel>
                <Input
                  autoComplete="off"
                  autoFocus
                  id="work-title"
                  name={field.name}
                  onChange={(event) => {
                    field.handleChange(event.target.value);
                    setCreatedWorkKey(null);
                  }}
                  placeholder="What needs to be done?"
                  value={field.state.value}
                />
                <FieldDescription>
                  Only a title is required. The Work opens as Not Started.
                </FieldDescription>
              </Field>
            )}
          </form.Field>
          <form.Field name="type">
            {(field) => (
              <Field>
                <FieldLabel htmlFor="work-type">Type</FieldLabel>
                <NativeSelect
                  id="work-type"
                  name={field.name}
                  onChange={(event) =>
                    field.handleChange(event.target.value as WorkType)
                  }
                  value={field.state.value}
                >
                  {WORK_TYPE_OPTIONS.map((type) => (
                    <NativeSelectOption key={type} value={type}>
                      {type}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            )}
          </form.Field>
        </FieldGroup>
        <Button
          disabled={connection === "offline" || createWork.isPending}
          type="submit"
        >
          {createWork.isPending ? "Creating…" : "Create Work"}
        </Button>
      </form>
    </div>
  );
}
