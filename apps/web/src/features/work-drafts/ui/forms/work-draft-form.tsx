// biome-ignore-all lint/performance/noJsxPropsBind: Draft fields close over the current form state and save seam.

import {
  type AccountPreferences,
  DEFAULT_ACCOUNT_PREFERENCES,
} from "@cantiara/api/account-preferences";
import type {
  CustomFieldDefinition,
  ParsedCustomFieldValuePayload,
} from "@cantiara/api/custom-fields";
import {
  type DeleteWorkDraftInput,
  type FinalizeWorkDraftInput,
  type SaveWorkDraftInput,
  type WorkDraft,
  type WorkDraftCustomFieldValue,
  workDraftFormSchema,
} from "@cantiara/api/work-drafts";
import {
  createWorkInputSchema,
  WORK_TYPE_OPTIONS,
  type WorkType,
} from "@cantiara/api/work-lifecycle";
import { Button } from "@cantiara/ui/components/button";
import { Calendar } from "@cantiara/ui/components/calendar";
import { Checkbox } from "@cantiara/ui/components/checkbox";
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
import {
  createPopoverHandle,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@cantiara/ui/components/popover";
import { Textarea } from "@cantiara/ui/components/textarea";
import { LiteDebouncer } from "@tanstack/pacer-lite";
import { useForm, useSelector } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { CalendarDays } from "lucide-react";
import {
  type ChangeEvent,
  type ReactNode,
  type SubmitEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  useClientShell,
  useClientShellConnection,
} from "@/features/web-macos-client/hooks/use-client-shell";
import { buildSupportReferenceFailure } from "@/features/web-macos-client/lib/support-reference";
import { ClientShellStatus } from "@/features/web-macos-client/ui/components/client-shell";
import { commandVariables } from "@/lib/command-variables";
import { submitForm } from "@/lib/submit-form";
import { usePreparedMutation } from "@/lib/use-prepared-mutation";
import {
  client,
  invalidateSmartCollectionMembership,
  orpc,
} from "@/utils/orpc";
import {
  activeDraftCustomFieldValues,
  formatDraftCustomFieldDate,
  parseDraftNumberText,
} from "../../lib/draft-custom-fields";

interface WorkDraftFormValues {
  customFieldValues: WorkDraftCustomFieldValue[];
  description: string;
  title: string;
  type: WorkType;
}

const EMPTY_VALUES: WorkDraftFormValues = {
  customFieldValues: [],
  description: "",
  title: "",
  type: "Task",
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

type DraftSaveMode = "autosave" | "manual" | "create";

interface DraftSaveAttempt {
  command: SaveWorkDraftInput;
  editVersion: number;
  mode: DraftSaveMode;
}

interface DraftFinalization {
  command: FinalizeWorkDraftInput;
  editVersion: number;
  replaceOnEdit?: boolean;
}

interface DraftWriteFailure {
  error: unknown;
  isError: boolean;
}

function draftFormError(
  validationError: string | undefined,
  save: DraftWriteFailure & { variables?: DraftSaveAttempt },
  finalize: DraftWriteFailure,
  remove: DraftWriteFailure,
) {
  if (finalize.isError || (save.isError && save.variables?.mode === "create")) {
    return errorMessage(
      finalize.isError ? finalize.error : save.error,
      "Work could not be created. Try again.",
    );
  }
  if (save.isError) {
    return errorMessage(save.error, "Draft could not be saved. Try again.");
  }
  return remove.isError
    ? errorMessage(remove.error, "Draft could not be deleted. Try again.")
    : validationError;
}

export function workDraftInitialValues(
  initialType?: WorkType,
): WorkDraftFormValues {
  return { ...EMPTY_VALUES, type: initialType ?? EMPTY_VALUES.type };
}

export function draftValues(draft: WorkDraft): WorkDraftFormValues {
  return {
    customFieldValues: draft.customFieldValues,
    description: draft.description ?? "",
    title: draft.title,
    type: draft.type,
  };
}

function customFieldValueFor(
  values: WorkDraftCustomFieldValue[],
  definitionId: string,
) {
  return values.find((value) => value.definitionId === definitionId)?.payload;
}

function customFieldControlId(definitionId: string) {
  return `work-draft-custom-field-${definitionId}`;
}

function CustomFieldClearButton({
  disabled,
  onClear,
}: {
  disabled: boolean;
  onClear: () => void;
}) {
  return (
    <Button
      disabled={disabled}
      onClick={onClear}
      size="xs"
      type="button"
      variant="ghost"
    >
      Not evaluated
    </Button>
  );
}

function CustomFieldUnsetStatus() {
  return <span className="text-sm text-muted-foreground">Not evaluated</span>;
}

function CustomFieldDateInput({
  definition,
  disabled,
  formattingPreferences,
  onChange,
  value,
}: {
  definition: CustomFieldDefinition;
  disabled: boolean;
  formattingPreferences: AccountPreferences;
  onChange: (value: string | null) => void;
  value: string | null;
}) {
  const [popoverHandle] = useState(createPopoverHandle);
  const selectedDate = value ? parseISO(value) : undefined;
  const validSelectedDate =
    selectedDate && !Number.isNaN(selectedDate.getTime())
      ? selectedDate
      : undefined;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Popover handle={popoverHandle}>
        <PopoverTrigger
          disabled={disabled}
          render={
            <Button
              aria-label={definition.name}
              className="justify-between font-normal"
              disabled={disabled}
              id={customFieldControlId(definition.id)}
              type="button"
              variant="outline"
            />
          }
        >
          {value
            ? formatDraftCustomFieldDate(value, formattingPreferences)
            : "Not evaluated"}
          <CalendarDays aria-hidden="true" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto min-w-72">
          <Calendar
            defaultMonth={validSelectedDate}
            mode="single"
            onSelect={(date) => {
              onChange(date ? format(date, "yyyy-MM-dd") : null);
              popoverHandle.close();
            }}
            selected={validSelectedDate}
          />
        </PopoverContent>
      </Popover>
      {value ? (
        <CustomFieldClearButton
          disabled={disabled}
          onClear={() => onChange(null)}
        />
      ) : null}
    </div>
  );
}

function CustomFieldNumberInput({
  definition,
  disabled,
  onChange,
  onTextChange,
  text,
  value,
}: {
  definition: CustomFieldDefinition;
  disabled: boolean;
  onChange: (value: ParsedCustomFieldValuePayload | null) => void;
  onTextChange: (text: string) => void;
  text?: string;
  value: ParsedCustomFieldValuePayload | undefined;
}) {
  const id = customFieldControlId(definition.id);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        aria-label={definition.name}
        disabled={disabled}
        id={id}
        inputMode="decimal"
        onChange={(event) => {
          const next = event.target.value;
          onTextChange(next);
          const parsed = parseDraftNumberText(next);
          if (parsed === "empty") {
            onChange(null);
            return;
          }
          if (parsed !== "invalid") {
            onChange({ kind: "number", number: parsed });
          }
        }}
        type="number"
        value={text ?? (value?.kind === "number" ? String(value.number) : "")}
      />
      {value ? (
        <CustomFieldClearButton
          disabled={disabled}
          onClear={() => {
            onTextChange("");
            onChange(null);
          }}
        />
      ) : (
        <CustomFieldUnsetStatus />
      )}
    </div>
  );
}

function CustomFieldInput({
  definition,
  disabled,
  formattingPreferences,
  onChange,
  onNumberTextChange,
  numberText,
  value,
}: {
  definition: CustomFieldDefinition;
  disabled: boolean;
  formattingPreferences: AccountPreferences;
  onChange: (value: ParsedCustomFieldValuePayload | null) => void;
  onNumberTextChange: (text: string) => void;
  numberText?: string;
  value: ParsedCustomFieldValuePayload | undefined;
}) {
  const id = customFieldControlId(definition.id);

  switch (definition.type) {
    case "Text": {
      const text = value?.kind === "text" ? value.text : "";
      return (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            aria-label={definition.name}
            disabled={disabled}
            id={id}
            onChange={(event) =>
              onChange(
                event.target.value
                  ? { kind: "text", text: event.target.value }
                  : null,
              )
            }
            value={text}
          />
          {value ? (
            <CustomFieldClearButton
              disabled={disabled}
              onClear={() => onChange(null)}
            />
          ) : (
            <CustomFieldUnsetStatus />
          )}
        </div>
      );
    }
    case "Number":
      return (
        <CustomFieldNumberInput
          definition={definition}
          disabled={disabled}
          onChange={onChange}
          onTextChange={onNumberTextChange}
          text={numberText}
          value={value}
        />
      );
    case "Boolean": {
      const checked = value?.kind === "boolean" && value.boolean;
      return (
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm" htmlFor={id}>
            <Checkbox
              checked={checked}
              disabled={disabled}
              id={id}
              onCheckedChange={(next) =>
                onChange({ kind: "boolean", boolean: next === true })
              }
            />
            <span>{definition.name}</span>
          </label>
          {value ? (
            <CustomFieldClearButton
              disabled={disabled}
              onClear={() => onChange(null)}
            />
          ) : (
            <CustomFieldUnsetStatus />
          )}
        </div>
      );
    }
    case "Date":
      return (
        <CustomFieldDateInput
          definition={definition}
          disabled={disabled}
          formattingPreferences={formattingPreferences}
          onChange={(date) => onChange(date ? { date, kind: "date" } : null)}
          value={value?.kind === "date" ? value.date : null}
        />
      );
    case "Single select": {
      const selected = value?.kind === "option" ? value.option : "";
      return (
        <div className="flex flex-wrap items-center gap-2">
          <NativeSelect
            aria-label={definition.name}
            disabled={disabled}
            id={id}
            onChange={(event) =>
              onChange(
                event.target.value
                  ? { kind: "option", option: event.target.value }
                  : null,
              )
            }
            value={selected}
          >
            <NativeSelectOption value="">Not evaluated</NativeSelectOption>
            {definition.options.map((option) => (
              <NativeSelectOption key={option} value={option}>
                {option}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      );
    }
    case "Multi select": {
      const selected = value?.kind === "options" ? value.options : [];
      return (
        <DraftMultiSelectField
          definition={definition}
          disabled={disabled}
          id={id}
          onChange={onChange}
          selected={selected}
          value={value}
        />
      );
    }
    default:
      return null;
  }
}

function WorkCustomFields({
  definitions,
  disabled,
  error,
  formattingPreferences,
  isPending,
  onChange,
  onNumberTextChange,
  numberText,
  values,
}: {
  definitions: CustomFieldDefinition[];
  disabled: boolean;
  error: boolean;
  formattingPreferences: AccountPreferences;
  isPending: boolean;
  onChange: (
    definitionId: string,
    value: ParsedCustomFieldValuePayload | null,
  ) => void;
  onNumberTextChange: (definitionId: string, text: string) => void;
  numberText: Record<string, string>;
  values: WorkDraftCustomFieldValue[];
}) {
  if (isPending) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        Loading Custom fields…
      </p>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-destructive" role="alert">
        Custom fields could not be loaded. Try loading this page again.
      </p>
    );
  }

  if (definitions.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="work-draft-custom-fields-heading"
      className="space-y-4 border-t border-border/70 pt-5"
    >
      <div>
        <h4
          className="font-medium text-foreground"
          id="work-draft-custom-fields-heading"
        >
          Custom fields
        </h4>
        <p className="mt-1 text-xs/relaxed text-muted-foreground">
          These fields come from this Project’s Work definitions.
        </p>
      </div>
      <FieldGroup>
        {definitions.map((definition) => (
          <Field key={definition.id}>
            {definition.type === "Boolean" ||
            definition.type === "Multi select" ? null : (
              <FieldLabel htmlFor={customFieldControlId(definition.id)}>
                {definition.name}
              </FieldLabel>
            )}
            <CustomFieldInput
              definition={definition}
              disabled={disabled}
              formattingPreferences={formattingPreferences}
              numberText={numberText[definition.id]}
              onChange={(value) => onChange(definition.id, value)}
              onNumberTextChange={(text) =>
                onNumberTextChange(definition.id, text)
              }
              value={customFieldValueFor(values, definition.id)}
            />
          </Field>
        ))}
      </FieldGroup>
    </section>
  );
}

export function WorkTypeField({
  disabled,
  onChange,
  value,
  warning,
}: {
  disabled: boolean;
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  value: WorkType;
  warning: string | null;
}) {
  return (
    <Field>
      <FieldLabel htmlFor="work-draft-type">Type</FieldLabel>
      <NativeSelect
        aria-describedby={warning ? "work-draft-type-warning" : undefined}
        disabled={disabled}
        id="work-draft-type"
        name="type"
        onChange={onChange}
        value={value}
      >
        {WORK_TYPE_OPTIONS.map((type) => (
          <NativeSelectOption key={type} value={type}>
            {type}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {warning ? (
        <FieldDescription
          className="text-amber-800 dark:text-amber-300"
          id="work-draft-type-warning"
          role="status"
        >
          {warning}
        </FieldDescription>
      ) : null}
    </Field>
  );
}

export default function WorkDraftForm({
  accountFormattingPreferences = DEFAULT_ACCOUNT_PREFERENCES,
  initialType,
  projectId,
  typeWarning,
}: {
  accountFormattingPreferences?: AccountPreferences;
  initialType?: WorkType;
  projectId: string;
  typeWarning?: (type: WorkType) => string | null;
}) {
  const shell = useClientShell();
  const connection = useClientShellConnection();
  const queryClient = useQueryClient();
  const [resumed, setResumed] = useState(false);
  // The Draft editor's target Project follows the resumed Draft; new Drafts
  // target the Project whose surface opened the form.
  const initialValues = useMemo(
    () => workDraftInitialValues(initialType),
    [initialType],
  );
  const [initialDraftId] = useState(() => crypto.randomUUID());
  const revisionRef = useRef(0);
  const editVersionRef = useRef(0);
  const autosaveEpochRef = useRef(0);
  const saveSequenceRef = useRef(Promise.resolve());
  const pendingSaveRef = useRef<SaveWorkDraftInput | undefined>(undefined);
  const pendingFinalizationRef = useRef<DraftFinalization | undefined>(
    undefined,
  );
  const saveDraftRef = useRef<
    (
      values: WorkDraftFormValues,
      mode: DraftSaveMode,
    ) => Promise<WorkDraft | undefined>
  >(() => Promise.reject(new Error("Draft save is not ready.")));

  // Drafts are personal to the account: the Drafts surface lists every Draft
  // regardless of Project, so it can resume or delete across Projects.
  const draftsQueryOptions = orpc.workDrafts.queryOptions({ input: {} });
  const draftsQuery = useQuery(draftsQueryOptions);
  const draftsQueryKey = draftsQueryOptions.queryKey;
  const form = useForm({
    defaultValues: {
      ...initialValues,
      draftId: initialDraftId as string,
      targetProjectId: projectId,
      numberText: {} as Record<string, string>,
    },
    validators: {
      onSubmit: ({ value }) => {
        if (pendingFinalizationRef.current?.command.draftId === value.draftId) {
          return;
        }
        const parsed = createWorkInputSchema.safeParse({
          description: value.description.trim() ? value.description : null,
          projectId: value.targetProjectId,
          title: value.title,
          type: value.type,
        });
        return parsed.success
          ? undefined
          : (parsed.error.issues[0]?.message ?? "Check the form.");
      },
    },
    onSubmit: ({ value }) => createWork(value),
  });
  const targetProjectId = useSelector(
    form.store,
    (state) => state.values.targetProjectId,
  );
  useEffect(() => {
    form.setFieldValue("targetProjectId", projectId, { dontUpdateMeta: true });
  }, [form, projectId]);
  const customFieldsQuery = useQuery(
    orpc.customFields.queryOptions({ input: { projectId: targetProjectId } }),
  );
  const workCustomFieldDefinitions = useMemo(
    () =>
      (customFieldsQuery.data ?? []).filter(
        (definition) =>
          definition.trashedAt === null &&
          definition.recordTypes.includes("Work"),
      ),
    [customFieldsQuery.data],
  );
  const projectsQuery = useQuery(orpc.projects.queryOptions());
  const projectNameById = new Map(
    (projectsQuery.data ?? []).map((project) => [project.id, project.name]),
  );
  const validationError = useSelector(
    form.store,
    (state) => state.errorMap.onSubmit,
  );
  const isCreating = useSelector(form.store, (state) => state.isSubmitting);

  function setNewDraft(values?: WorkDraftFormValues) {
    revisionRef.current = 0;
    editVersionRef.current += 1;
    pendingSaveRef.current = undefined;
    pendingFinalizationRef.current = undefined;
    form.reset(
      {
        ...(values ?? initialValues),
        draftId: crypto.randomUUID(),
        targetProjectId: values ? targetProjectId : projectId,
        numberText: {},
      },
      { keepDefaultValues: true },
    );
    shell.markUnsavedChanges(Boolean(values));
  }

  function removeDraftFromCache(draftId: string) {
    queryClient.setQueryData<WorkDraft[]>(draftsQueryKey, (drafts = []) =>
      drafts.filter((draft) => draft.id !== draftId),
    );
  }

  const saveMutation = useMutation({
    mutationKey: orpc.saveWorkDraft.mutationKey(),
    meta: { onlineWrite: true, retryInSurface: true },
    mutationFn: ({ command }: DraftSaveAttempt) =>
      client.saveWorkDraft(command),
    onSuccess: async (saved, { command, editVersion }) => {
      if (
        pendingSaveRef.current?.clientIdempotencyKey ===
        command.clientIdempotencyKey
      ) {
        pendingSaveRef.current = undefined;
      }
      await queryClient.cancelQueries({ queryKey: draftsQueryKey });
      queryClient.setQueryData<WorkDraft[]>(draftsQueryKey, (drafts = []) => [
        saved,
        ...drafts.filter((draft) => draft.id !== saved.id),
      ]);
      if (form.getFieldValue("draftId") === saved.id) {
        revisionRef.current = saved.revision;
        shell.recordSuccessfulSave(new Date(saved.updatedAt));
        if (editVersionRef.current !== editVersion) {
          shell.markUnsavedChanges();
        }
      }
    },
  });
  const finalizeMutation = useMutation({
    mutationKey: orpc.finalizeWorkDraft.mutationKey(),
    meta: { onlineWrite: true, retryInSurface: true },
    mutationFn: ({ command }: DraftFinalization) =>
      client.finalizeWorkDraft(command),
    onError: (error, attempt) => {
      if (
        pendingFinalizationRef.current === attempt &&
        buildSupportReferenceFailure(error, { kind: "mutation" })
          .writeOutcome === "not-written"
      ) {
        pendingFinalizationRef.current = { ...attempt, replaceOnEdit: true };
      }
    },
    onSuccess: (work, { command, editVersion }) => {
      removeDraftFromCache(command.draftId);
      if (form.getFieldValue("draftId") === command.draftId) {
        shell.recordSuccessfulSave();
        setNewDraft(
          editVersionRef.current === editVersion
            ? undefined
            : form.state.values,
        );
      }
      // A committed Create is complete even while dependent views refetch.
      Promise.all([
        queryClient.invalidateQueries({ queryKey: draftsQueryKey }),
        queryClient.invalidateQueries({
          queryKey: orpc.projectWorks.key({
            input: { projectId: work.projectId },
          }),
        }),
        queryClient.invalidateQueries({
          queryKey: orpc.project.queryKey({
            input: { projectId: work.projectId },
          }),
        }),
        queryClient.invalidateQueries({
          queryKey: orpc.scopeTree.queryKey({
            input: { projectId: work.projectId },
          }),
        }),
        queryClient.invalidateQueries({
          queryKey: orpc.customFieldProjectValues.queryKey({
            input: { projectId: work.projectId, recordType: "Work" },
          }),
        }),
        ...invalidateSmartCollectionMembership(queryClient),
      ]).catch(() => undefined);
    },
  });
  const deleteMutation = usePreparedMutation(
    orpc.deleteWorkDraft.mutationOptions({
      meta: { retryInSurface: true },
      mutationFn: (input) => client.deleteWorkDraft(input),
      onSuccess: (_, { draftId }) => {
        removeDraftFromCache(draftId);
        if (draftId === form.getFieldValue("draftId")) {
          shell.recordSuccessfulSave();
          setNewDraft();
        }
      },
    }),
    (input: Omit<DeleteWorkDraftInput, "clientIdempotencyKey">) => input,
  );

  function resumeDraft(draft: WorkDraft) {
    debouncer.cancel();
    if (
      form.getFieldValue("draftId") !== draft.id ||
      revisionRef.current !== draft.revision
    ) {
      pendingSaveRef.current = undefined;
      pendingFinalizationRef.current = undefined;
    }
    revisionRef.current = draft.revision;
    editVersionRef.current += 1;
    form.reset(
      {
        ...draftValues(draft),
        draftId: draft.id,
        targetProjectId: draft.projectId,
        numberText: {},
      },
      { keepDefaultValues: true },
    );
    saveMutation.reset();
    finalizeMutation.reset();
    deleteMutation.reset();
    setResumed(true);
    shell.recordSuccessfulSave(new Date(draft.updatedAt));
  }

  const saveDraftNow = (values: WorkDraftFormValues, mode: DraftSaveMode) => {
    const draftId = form.getFieldValue("draftId");
    const editVersion = editVersionRef.current;
    const autosaveEpoch = autosaveEpochRef.current;
    const operation = async () => {
      if (
        draftId !== form.getFieldValue("draftId") ||
        (mode === "autosave" && autosaveEpoch !== autosaveEpochRef.current)
      ) {
        return;
      }
      const parsed = workDraftFormSchema.safeParse({
        checklist: [],
        // Drop values whose field is no longer available in this Project.
        customFieldValues: customFieldsQuery.data
          ? activeDraftCustomFieldValues(
              values.customFieldValues,
              workCustomFieldDefinitions,
            )
          : values.customFieldValues,
        description: values.description.trim() ? values.description : null,
        projectId: targetProjectId,
        title: values.title,
        type: values.type,
      });
      if (!parsed.success) {
        form.setErrorMap({
          onSubmit:
            parsed.error.issues[0]?.message ??
            "Draft could not be saved. Check the form.",
        });
        return;
      }
      const command = commandVariables<
        Omit<SaveWorkDraftInput, "clientIdempotencyKey">
      >(
        { ...parsed.data, baseRevision: revisionRef.current, draftId },
        pendingSaveRef.current,
      );
      pendingSaveRef.current = command;
      return await saveMutation.mutateAsync({ command, editVersion, mode });
    };

    const sequenced = saveSequenceRef.current.then(operation);
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
          saveDraftRef.current(values, "autosave").catch(() => undefined);
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
        autosaveEpochRef.current += 1;
        debouncer.cancel();
      }
    });
    return subscription.unsubscribe;
  }, [debouncer, shell]);

  useEffect(() => () => debouncer.cancel(), [debouncer]);

  function queueAutosave(values: WorkDraftFormValues) {
    editVersionRef.current += 1;
    setResumed(false);
    finalizeMutation.reset();
    deleteMutation.reset();
    saveMutation.reset();
    form.setErrorMap({ onSubmit: undefined });
    shell.markUnsavedChanges();
    if (pendingFinalizationRef.current?.replaceOnEdit) {
      pendingFinalizationRef.current = undefined;
    }
    if (connection === "online" && !pendingFinalizationRef.current) {
      debouncer.maybeExecute(values);
    }
  }

  function updateCustomFieldValue(
    definitionId: string,
    value: ParsedCustomFieldValuePayload | null,
  ) {
    const customFieldValues = form.state.values.customFieldValues.filter(
      (candidate) => candidate.definitionId !== definitionId,
    );
    if (value) {
      customFieldValues.push({ definitionId, payload: value });
    }
    form.setFieldValue("customFieldValues", customFieldValues);
    queueAutosave({ ...form.state.values, customFieldValues });
  }

  async function saveCurrentDraft() {
    debouncer.cancel();
    setResumed(false);
    form.setErrorMap({ onSubmit: undefined });
    finalizeMutation.reset();
    deleteMutation.reset();
    await saveDraftNow(form.state.values, "manual");
  }

  async function createWork(values: WorkDraftFormValues) {
    debouncer.cancel();
    setResumed(false);
    saveMutation.reset();
    deleteMutation.reset();
    // The previous request may have consumed the Draft. Replay that exact
    // finalization before issuing any new save against the same Draft.
    const previous = pendingFinalizationRef.current;
    if (previous?.command.draftId === form.getFieldValue("draftId")) {
      await finalizeMutation.mutateAsync(previous).catch(() => undefined);
      return;
    }

    const editVersion = editVersionRef.current;
    const saved = await saveDraftNow(values, "create").catch(() => undefined);
    if (saved) {
      const attempt = {
        command: commandVariables({
          baseRevision: saved.revision,
          draftId: saved.id,
        }),
        editVersion,
      };
      pendingFinalizationRef.current = attempt;
      await finalizeMutation.mutateAsync(attempt).catch(() => undefined);
    }
  }

  async function deleteDraft(draft: WorkDraft) {
    debouncer.cancel();
    setResumed(false);
    form.setErrorMap({ onSubmit: undefined });
    saveMutation.reset();
    finalizeMutation.reset();
    await saveSequenceRef.current;
    const baseRevision =
      draft.id === form.getFieldValue("draftId")
        ? revisionRef.current
        : draft.revision;
    await deleteMutation.mutateAsync({ baseRevision, draftId: draft.id });
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    submitForm(form).catch(() => undefined);
  }

  const formError = draftFormError(
    validationError,
    saveMutation,
    finalizeMutation,
    deleteMutation,
  );
  let actionMessage = resumed ? "Draft resumed." : undefined;
  if (saveMutation.isSuccess && saveMutation.variables?.mode === "manual") {
    actionMessage = "Draft saved.";
  } else if (deleteMutation.isSuccess) {
    actionMessage = "Draft deleted.";
  }
  const createdWorkKey = finalizeMutation.data?.key;
  const isSaving = saveMutation.isPending;
  const isBusy = isCreating || isSaving || deleteMutation.isPending;

  function draftsContent(): ReactNode {
    if (draftsQuery.status === "pending") {
      return (
        <p className="mt-2 text-sm text-muted-foreground">Loading Drafts…</p>
      );
    }
    if (draftsQuery.isError) {
      return (
        <p className="mt-2 text-sm text-destructive" role="alert">
          Drafts are unavailable. Try loading this page again.
        </p>
      );
    }
    const drafts = draftsQuery.data ?? [];
    if (drafts.length === 0) {
      return (
        <p className="mt-2 text-sm text-muted-foreground">No Drafts yet.</p>
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
                <p className="truncate text-sm font-medium">
                  {draft.title || "Untitled Draft"}
                </p>
                <p className="text-xs text-muted-foreground">
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
    <section
      aria-labelledby="work-draft-heading"
      className="mt-4 space-y-6 border-t pt-4"
    >
      <ClientShellStatus
        accountFormattingPreferences={accountFormattingPreferences}
        presentation="inline"
      />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="font-medium text-foreground" id="work-draft-heading">
            Draft
          </h3>
          <p className="mt-1 text-xs/relaxed text-muted-foreground">
            Changes save automatically while you are online. Create turns this
            Draft into one Work.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {projectNameById.get(targetProjectId) ?? targetProjectId}
          </p>
        </div>
        {connection === "online" ? (
          <span className="rounded-full border border-border/70 px-2 py-1 text-xs text-muted-foreground">
            {isSaving ? "Saving…" : "Ready"}
          </span>
        ) : null}
      </div>

      {formError ? (
        <div
          className="rounded-md border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive"
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
                  disabled={isBusy}
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
              <WorkTypeField
                disabled={isBusy}
                onChange={(event) => {
                  const type = event.target.value as WorkType;
                  field.handleChange(type);
                  queueAutosave({ ...form.state.values, type });
                }}
                value={field.state.value}
                warning={typeWarning?.(field.state.value) ?? null}
              />
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
                disabled={isBusy}
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

        <form.Subscribe selector={(state) => state.values}>
          {({ customFieldValues, numberText }) => (
            <WorkCustomFields
              definitions={workCustomFieldDefinitions}
              disabled={isBusy}
              error={customFieldsQuery.isError}
              formattingPreferences={accountFormattingPreferences}
              isPending={customFieldsQuery.isPending}
              numberText={numberText}
              onChange={updateCustomFieldValue}
              onNumberTextChange={(definitionId, text) => {
                form.setFieldValue("numberText", (values) => ({
                  ...values,
                  [definitionId]: text,
                }));
              }}
              values={customFieldValues}
            />
          )}
        </form.Subscribe>

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
        className="border-t border-border/70 pt-5"
      >
        <h3 className="font-medium text-foreground" id="work-drafts-heading">
          Drafts
        </h3>
        {draftsContent()}
      </section>
    </section>
  );
}

function DraftMultiSelectField({
  definition,
  id,
  selected,
  disabled,
  onChange,
  value,
}: {
  definition: CustomFieldDefinition;
  id: string;
  selected: string[];
  disabled: boolean;
  onChange: (value: ParsedCustomFieldValuePayload | null) => void;
  value:
    | { kind: "boolean"; boolean: boolean }
    | { kind: "date"; date: string }
    | { kind: "number"; number: number }
    | { kind: "option"; option: string }
    | { kind: "options"; options: string[] }
    | { kind: "text"; text: string }
    | undefined;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{definition.name}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {definition.options.map((option) => {
          const optionId = `${id}-${option}`;
          return (
            <label
              className="flex items-center gap-2 text-sm"
              htmlFor={optionId}
              key={option}
            >
              <Checkbox
                checked={selected.includes(option)}
                disabled={disabled}
                id={optionId}
                onCheckedChange={(checked) => {
                  const next = checked
                    ? [...selected, option]
                    : selected.filter((candidate) => candidate !== option);
                  onChange(
                    next.length > 0 ? { kind: "options", options: next } : null,
                  );
                }}
              />
              <span>{option}</span>
            </label>
          );
        })}
      </div>
      {value ? (
        <CustomFieldClearButton
          disabled={disabled}
          onClear={() => onChange(null)}
        />
      ) : (
        <p className="text-xs text-muted-foreground">Not evaluated</p>
      )}
    </fieldset>
  );
}
