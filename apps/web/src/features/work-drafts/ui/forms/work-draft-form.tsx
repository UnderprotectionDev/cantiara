// biome-ignore-all lint/performance/noJsxPropsBind: Draft fields close over the current form state and save seam.

import { type WorkDraft, workDraftFormSchema } from "@cantiara/api/work-drafts";
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
import { Textarea } from "@cantiara/ui/components/textarea";
import { LiteDebouncer } from "@tanstack/pacer-lite";
import { useForm } from "@tanstack/react-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  useClientShell,
  useClientShellConnection,
} from "@/features/web-macos-client/hooks/use-client-shell";
import { client, orpc } from "@/utils/orpc";

interface WorkDraftFormValues {
  description: string;
  title: string;
  type: WorkType;
}

const EMPTY_VALUES: WorkDraftFormValues = {
  description: "",
  title: "",
  type: "Task",
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function serializeValues(values: WorkDraftFormValues) {
  return JSON.stringify(values);
}

function draftValues(draft: WorkDraft): WorkDraftFormValues {
  return {
    description: draft.description ?? "",
    title: draft.title,
    type: draft.type,
  };
}

export default function WorkDraftForm({ projectId }: { projectId: string }) {
  const shell = useClientShell();
  const connection = useClientShellConnection();
  const queryClient = useQueryClient();
  const [activeDraftId, setActiveDraftId] = useState<string>(() =>
    crypto.randomUUID(),
  );
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [createdWorkKey, setCreatedWorkKey] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const draftIdRef = useRef<string>(activeDraftId);
  const revisionRef = useRef(0);
  const saveSequenceRef = useRef(Promise.resolve());
  const saveDraftRef = useRef<
    (values: WorkDraftFormValues) => Promise<WorkDraft>
  >(() => Promise.reject(new Error("Draft save is not ready.")));

  const draftsQueryOptions = orpc.workDrafts.queryOptions({
    input: { projectId },
  });
  const draftsQuery = useQuery(draftsQueryOptions);
  const draftsQueryKey = draftsQueryOptions.queryKey;
  const worksQueryKey = orpc.projectWorks.queryOptions({
    input: { projectId },
  }).queryKey;
  const projectQueryKey = orpc.project.queryOptions({
    input: { projectId },
  }).queryKey;
  const scopeTreeQueryKey = orpc.scopeTree.queryOptions({
    input: { projectId },
  }).queryKey;

  const form = useForm({
    defaultValues: EMPTY_VALUES,
    onSubmit: async () => undefined,
  });

  async function updateDraftList(saved: WorkDraft) {
    await queryClient.cancelQueries({ queryKey: draftsQueryKey });
    queryClient.setQueryData<WorkDraft[]>(draftsQueryKey, (drafts = []) => [
      saved,
      ...drafts.filter((draft) => draft.id !== saved.id),
    ]);
  }

  function setNewDraft() {
    const nextDraftId = crypto.randomUUID();
    draftIdRef.current = nextDraftId;
    revisionRef.current = 0;
    setActiveDraftId(nextDraftId);
    form.reset(EMPTY_VALUES);
    shell.markUnsavedChanges(false);
  }

  function resumeDraft(draft: WorkDraft) {
    debouncer.cancel();
    draftIdRef.current = draft.id;
    revisionRef.current = draft.revision;
    setActiveDraftId(draft.id);
    form.reset(draftValues(draft), { keepDefaultValues: true });
    setActionMessage("Draft resumed.");
    setCreatedWorkKey(null);
    setFormError(null);
    shell.recordSuccessfulSave(new Date(draft.updatedAt));
  }

  const saveDraftNow = (values: WorkDraftFormValues) => {
    const operation = async () => {
      setIsSaving(true);
      try {
        const parsed = workDraftFormSchema.parse({
          checklist: [],
          description: values.description.trim() ? values.description : null,
          projectId,
          title: values.title,
          type: values.type,
        });
        const saved = await shell.runWrite(() =>
          client.saveWorkDraft({
            ...parsed,
            baseRevision: revisionRef.current,
            clientIdempotencyKey: crypto.randomUUID(),
            draftId: draftIdRef.current,
          }),
        );
        revisionRef.current = saved.revision;
        setActiveDraftId(saved.id);
        draftIdRef.current = saved.id;
        await updateDraftList(saved);

        if (serializeValues(form.state.values) === serializeValues(values)) {
          shell.recordSuccessfulSave(new Date(saved.updatedAt));
        } else {
          shell.markUnsavedChanges();
        }
        return saved;
      } finally {
        setIsSaving(false);
      }
    };

    const sequenced = saveSequenceRef.current.then(operation, operation);
    saveSequenceRef.current = sequenced.then(
      () => undefined,
      () => undefined,
    );
    return sequenced;
  };

  saveDraftRef.current = saveDraftNow;

  const debouncer = useMemo(
    () =>
      new LiteDebouncer(
        (values: WorkDraftFormValues) => {
          saveDraftRef.current(values).catch((error: unknown) => {
            setFormError(
              errorMessage(error, "Draft could not be saved. Try again."),
            );
          });
        },
        { wait: 700 },
      ),
    // saveDraftRef intentionally reads the current form, draft revision, and connection.
    // The debouncer is created once so reconnect cannot replay a prior keystroke.
    [],
  );

  useEffect(() => {
    if (connection === "offline") {
      debouncer.cancel();
    }
  }, [connection, debouncer]);

  useEffect(() => {
    const subscription = shell.subscribe((state) => {
      if (state.connection === "offline") {
        debouncer.cancel();
      }
    });
    return subscription.unsubscribe;
  }, [debouncer, shell]);

  useEffect(() => () => debouncer.cancel(), [debouncer]);

  function queueAutosave(values: WorkDraftFormValues) {
    setActionMessage(null);
    setCreatedWorkKey(null);
    setFormError(null);
    shell.markUnsavedChanges();
    if (connection === "online") {
      debouncer.maybeExecute(values);
    }
  }

  async function saveCurrentDraft() {
    debouncer.cancel();
    setFormError(null);
    setActionMessage(null);
    try {
      await saveDraftNow(form.state.values);
      setActionMessage("Draft saved.");
    } catch (error) {
      setFormError(errorMessage(error, "Draft could not be saved. Try again."));
    }
  }

  async function createWork() {
    debouncer.cancel();
    setFormError(null);
    setActionMessage(null);
    setCreatedWorkKey(null);

    const parsed = createWorkInputSchema.safeParse({
      description: form.state.values.description.trim()
        ? form.state.values.description
        : null,
      projectId,
      title: form.state.values.title,
      type: form.state.values.type,
    });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Check the form.");
      return;
    }

    setIsCreating(true);
    try {
      const saved = await saveDraftNow(form.state.values);
      const work = await shell.runWrite(() =>
        client.finalizeWorkDraft({
          baseRevision: saved.revision,
          clientIdempotencyKey: crypto.randomUUID(),
          draftId: saved.id,
        }),
      );
      setCreatedWorkKey(work.key);
      setActionMessage(null);
      setNewDraft();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: draftsQueryKey }),
        queryClient.invalidateQueries({ queryKey: worksQueryKey }),
        queryClient.invalidateQueries({ queryKey: projectQueryKey }),
        queryClient.invalidateQueries({ queryKey: scopeTreeQueryKey }),
      ]);
    } catch (error) {
      setFormError(
        errorMessage(error, "Work could not be created. Try again."),
      );
    } finally {
      setIsCreating(false);
    }
  }

  async function deleteDraft(draft: WorkDraft) {
    debouncer.cancel();
    setFormError(null);
    setActionMessage(null);
    try {
      await saveSequenceRef.current;
      await shell.runWrite(() =>
        client.deleteWorkDraft({
          baseRevision: draft.revision,
          clientIdempotencyKey: crypto.randomUUID(),
          draftId: draft.id,
        }),
      );
      queryClient.setQueryData<WorkDraft[]>(draftsQueryKey, (drafts = []) =>
        drafts.filter((candidate) => candidate.id !== draft.id),
      );
      if (draft.id === draftIdRef.current) {
        setNewDraft();
      }
      setActionMessage("Draft deleted.");
    } catch (error) {
      setFormError(
        errorMessage(error, "Draft could not be deleted. Try again."),
      );
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    createWork().catch(() => undefined);
  }

  const isBusy = isCreating || isSaving;

  function draftsContent(): ReactNode {
    if (draftsQuery.isPending) {
      return (
        <p className="mt-2 text-muted-foreground text-sm">Loading Drafts…</p>
      );
    }
    if (draftsQuery.isError) {
      return (
        <p className="mt-2 text-destructive text-sm" role="alert">
          Drafts are unavailable. Try loading this page again.
        </p>
      );
    }
    const drafts = draftsQuery.data ?? [];
    if (drafts.length === 0) {
      return (
        <p className="mt-2 text-muted-foreground text-sm">No Drafts yet.</p>
      );
    }
    return (
      <ul aria-label="Drafts" className="mt-3 space-y-2">
        {drafts.map((draft) => (
          <li
            className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/70 px-3 py-2"
            key={draft.id}
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-sm">
                {draft.title || "Untitled Draft"}
              </p>
              <p className="text-muted-foreground text-xs">{draft.type}</p>
            </div>
            <div className="flex gap-2">
              <Button
                disabled={connection === "offline" || isBusy}
                onClick={() => resumeDraft(draft)}
                size="xs"
                type="button"
                variant="outline"
              >
                Resume
              </Button>
              <Button
                disabled={isBusy || connection === "offline"}
                onClick={() => deleteDraft(draft).catch(() => undefined)}
                size="xs"
                type="button"
                variant="destructive"
              >
                Delete
              </Button>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="mt-4 space-y-6 border-t pt-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h5 className="font-medium text-foreground">Draft</h5>
          <p className="mt-1 text-muted-foreground text-xs/relaxed">
            Changes save automatically while you are online. Create turns this
            Draft into one Work.
          </p>
        </div>
        {activeDraftId ? (
          <span className="rounded-full border border-border/70 px-2 py-1 text-muted-foreground text-xs">
            {isSaving ? "Saving…" : "Ready"}
          </span>
        ) : null}
      </div>

      {formError ? (
        <div
          className="rounded-md border border-destructive/25 bg-destructive/5 p-3 text-destructive text-sm"
          role="alert"
        >
          {formError}
        </div>
      ) : null}
      {actionMessage ? (
        <p
          className="rounded-md border border-primary/25 bg-primary/5 p-3 text-sm"
          role="status"
        >
          {actionMessage}
        </p>
      ) : null}
      {createdWorkKey ? (
        <p
          className="rounded-md border border-primary/25 bg-primary/5 p-3 text-sm"
          role="status"
        >
          Work {createdWorkKey} created.
        </p>
      ) : null}

      <form className="space-y-5" noValidate onSubmit={handleSubmit}>
        <FieldGroup className="sm:grid sm:grid-cols-[minmax(0,1fr)_12rem]">
          <form.Field name="title">
            {(field) => (
              <Field>
                <FieldLabel htmlFor="work-draft-title">Title</FieldLabel>
                <Input
                  autoComplete="off"
                  autoFocus
                  id="work-draft-title"
                  name={field.name}
                  onChange={(event) => {
                    const title = event.target.value;
                    field.handleChange(title);
                    queueAutosave({ ...form.state.values, title });
                  }}
                  placeholder="What needs to be done?"
                  value={field.state.value}
                />
                <FieldDescription>
                  A title is required when you Create the Work.
                </FieldDescription>
              </Field>
            )}
          </form.Field>
          <form.Field name="type">
            {(field) => (
              <Field>
                <FieldLabel htmlFor="work-draft-type">Type</FieldLabel>
                <NativeSelect
                  id="work-draft-type"
                  name={field.name}
                  onChange={(event) => {
                    const type = event.target.value as WorkType;
                    field.handleChange(type);
                    queueAutosave({ ...form.state.values, type });
                  }}
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

        <form.Field name="description">
          {(field) => (
            <Field>
              <FieldLabel htmlFor="work-draft-description">
                Description
              </FieldLabel>
              <Textarea
                id="work-draft-description"
                name={field.name}
                onChange={(event) => {
                  const description = event.target.value;
                  field.handleChange(description);
                  queueAutosave({ ...form.state.values, description });
                }}
                placeholder="Add context for the Work."
                rows={4}
                value={field.state.value}
              />
            </Field>
          )}
        </form.Field>

        <div className="flex flex-wrap gap-2">
          <Button
            disabled={connection === "offline" || isBusy}
            onClick={() => saveCurrentDraft().catch(() => undefined)}
            type="button"
            variant="outline"
          >
            Save
          </Button>
          <Button disabled={connection === "offline" || isBusy} type="submit">
            {isCreating ? "Creating…" : "Create"}
          </Button>
        </div>
      </form>

      <section
        aria-labelledby="work-drafts-heading"
        className="border-border/70 border-t pt-5"
      >
        <h6 className="font-medium text-foreground" id="work-drafts-heading">
          Drafts
        </h6>
        {draftsContent()}
      </section>
    </div>
  );
}
