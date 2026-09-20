// biome-ignore-all lint/performance/noJsxPropsBind: Draft fields close over the current form state and save seam.

import {
  type AccountPreferences,
  DEFAULT_ACCOUNT_PREFERENCES,
} from "@cantiara/api/account-preferences";
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
import { ClientShellStatus } from "@/features/web-macos-client/ui/components/client-shell";
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

export default function WorkDraftForm({
  accountFormattingPreferences = DEFAULT_ACCOUNT_PREFERENCES,
  projectId,
}: {
  accountFormattingPreferences?: AccountPreferences;
  projectId: string;
}) {
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
  // The Draft editor's target Project follows the resumed Draft; new Drafts
  // target the Project whose surface opened the form.
  const [targetProjectId, setTargetProjectId] = useState(projectId);
  const draftIdRef = useRef<string>(activeDraftId);
  const revisionRef = useRef(0);
  const saveSequenceRef = useRef(Promise.resolve());
  const lastFinalizeKeyRef = useRef<{
    draftId: string;
    key: string;
  } | null>(null);
  const saveDraftRef = useRef<
    (values: WorkDraftFormValues) => Promise<WorkDraft>
  >(() => Promise.reject(new Error("Draft save is not ready.")));

  // Drafts are personal to the account: the Drafts surface lists every Draft
  // regardless of Project, so it can resume or delete across Projects.
  const draftsQueryOptions = orpc.workDrafts.queryOptions({ input: {} });
  const draftsQuery = useQuery(draftsQueryOptions);
  const draftsQueryKey = draftsQueryOptions.queryKey;
  const projectsQuery = useQuery(orpc.projects.queryOptions());
  const projectNameById = new Map(
    (projectsQuery.data ?? []).map((project) => [project.id, project.name]),
  );
  const worksQueryKey = orpc.projectWorks.queryOptions({
    input: { projectId },
  }).queryKey;
  const projectQueryKey = orpc.project.queryOptions({
    input: { projectId },
  }).queryKey;
  const scopeTreeQueryKey = orpc.scopeTree.queryOptions({
    input: { projectId },
  }).queryKey;

  useEffect(() => {
    setTargetProjectId(projectId);
  }, [projectId]);

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
    setTargetProjectId(projectId);
    form.reset(EMPTY_VALUES);
    shell.markUnsavedChanges(false);
  }

  function resumeDraft(draft: WorkDraft) {
    debouncer.cancel();
    draftIdRef.current = draft.id;
    revisionRef.current = draft.revision;
    setActiveDraftId(draft.id);
    setTargetProjectId(draft.projectId);
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
        const parsed = workDraftFormSchema.safeParse({
          checklist: [],
          description: values.description.trim() ? values.description : null,
          projectId: targetProjectId,
          title: values.title,
          type: values.type,
        });
        if (!parsed.success) {
          throw new Error(
            parsed.error.issues[0]?.message ??
              "Draft could not be saved. Check the form.",
          );
        }
        const saved = await shell.runWrite(() =>
          client.saveWorkDraft({
            ...parsed.data,
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
      projectId: targetProjectId,
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
      // Reuse the finalization key for this Draft across retries so a lost
      // response or server restart replays the same Work instead of wedging
      // the Draft behind a stale finalization reservation.
      const priorFinalization = lastFinalizeKeyRef.current;
      const finalizeKey =
        priorFinalization?.draftId === saved.id
          ? priorFinalization.key
          : crypto.randomUUID();
      lastFinalizeKeyRef.current = { draftId: saved.id, key: finalizeKey };
      const work = await shell.runWrite(() =>
        client.finalizeWorkDraft({
          baseRevision: saved.revision,
          clientIdempotencyKey: finalizeKey,
          draftId: saved.id,
        }),
      );
      lastFinalizeKeyRef.current = null;
      setCreatedWorkKey(work.key);
      setActionMessage(null);
      setNewDraft();
      queryClient.setQueryData<WorkDraft[]>(draftsQueryKey, (drafts = []) =>
        drafts.filter((draft) => draft.id !== saved.id),
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: draftsQueryKey }),
        queryClient.invalidateQueries({ queryKey: worksQueryKey }),
        queryClient.invalidateQueries({ queryKey: projectQueryKey }),
        queryClient.invalidateQueries({ queryKey: scopeTreeQueryKey }),
        ...(work.projectId === projectId
          ? []
          : [
              queryClient.invalidateQueries({
                queryKey: orpc.projectWorks.queryOptions({
                  input: { projectId: work.projectId },
                }).queryKey,
              }),
              queryClient.invalidateQueries({
                queryKey: orpc.project.queryOptions({
                  input: { projectId: work.projectId },
                }).queryKey,
              }),
              queryClient.invalidateQueries({
                queryKey: orpc.scopeTree.queryOptions({
                  input: { projectId: work.projectId },
                }).queryKey,
              }),
            ]),
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
        {drafts.map((draft) => {
          const projectName = projectNameById.get(draft.projectId);
          return (
            <li
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/70 px-3 py-2"
              key={draft.id}
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-sm">
                  {draft.title || "Untitled Draft"}
                </p>
                <p className="text-muted-foreground text-xs">
                  {projectName ? `${draft.type} · ${projectName}` : draft.type}
                </p>
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
          );
        })}
      </ul>
    );
  }

  return (
    <div className="mt-4 space-y-6 border-t pt-4">
      <ClientShellStatus
        accountFormattingPreferences={accountFormattingPreferences}
        presentation="inline"
      />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h5 className="font-medium text-foreground">Draft</h5>
          <p className="mt-1 text-muted-foreground text-xs/relaxed">
            Changes save automatically while you are online. Create turns this
            Draft into one Work.
          </p>
          <p className="mt-1 text-muted-foreground text-xs">
            {projectNameById.get(targetProjectId) ?? targetProjectId}
          </p>
        </div>
        {activeDraftId && connection === "online" ? (
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
