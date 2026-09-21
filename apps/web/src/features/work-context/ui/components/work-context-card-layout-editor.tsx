// biome-ignore-all lint/performance/noJsxPropsBind: Layout controls close over their current section and draft state.
import type { ProjectShellConfiguration } from "@cantiara/api/project-shell";
import {
  cloneWorkContextLayout,
  getWorkContextLayout,
  type previewWorkContextLayout,
  WORK_CONTEXT_CUSTOM_RECORD_TYPE_OPTIONS,
  WORK_CONTEXT_CUSTOM_RELATION_OPTIONS,
  WORK_CONTEXT_EVIDENCE_ROLE_OPTIONS,
  WORK_CONTEXT_INITIAL_FIELDS,
  type WorkContextCustomSection,
  type WorkContextCustomSectionCondition,
  type WorkContextEvidenceRole,
  type WorkContextLayout,
} from "@cantiara/api/work-context";
import {
  WORK_STATUS_OPTIONS,
  WORK_TYPE_OPTIONS,
  type WorkType,
} from "@cantiara/api/work-lifecycle";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useEffect, useMemo, useState } from "react";

import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";

const EMPTY_STATUS = "";

export default function WorkContextCardLayoutEditor({
  baseRevision,
  configuration,
  disabled,
  error,
  projectId,
}: {
  baseRevision: number;
  configuration: ProjectShellConfiguration;
  disabled: boolean;
  error: string | null;
  projectId: string;
}) {
  const queryClient = useQueryClient();
  const [workType, setWorkType] = useState<WorkType>("Feature");
  const [draft, setDraft] = useState<WorkContextLayout>(() =>
    getWorkContextLayout("Feature", configuration.workContextLayouts),
  );
  const [currentRevision, setCurrentRevision] = useState(baseRevision);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [preview, setPreview] = useState<ReturnType<
    typeof previewWorkContextLayout
  > | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [customTitle, setCustomTitle] = useState("");
  const [conditionKind, setConditionKind] =
    useState<WorkContextCustomSectionCondition["kind"]>("record-type");
  const [recordType, setRecordType] =
    useState<(typeof WORK_CONTEXT_CUSTOM_RECORD_TYPE_OPTIONS)[number]>(
      "Decision",
    );
  const [relation, setRelation] =
    useState<(typeof WORK_CONTEXT_CUSTOM_RELATION_OPTIONS)[number]>("Related");
  const [evidenceRole, setEvidenceRole] =
    useState<WorkContextEvidenceRole>("Supports");
  const [status, setStatus] = useState<
    (typeof WORK_STATUS_OPTIONS)[number] | null
  >(null);

  const committedLayout = useMemo(
    () => getWorkContextLayout(workType, configuration.workContextLayouts),
    [configuration.workContextLayouts, workType],
  );
  const isDirty = JSON.stringify(draft) !== JSON.stringify(committedLayout);
  const projectQueryKey = orpc.project.queryOptions({
    input: { projectId },
  }).queryKey;

  useEffect(() => {
    setDraft(cloneWorkContextLayout(committedLayout));
    setCurrentRevision(baseRevision);
    setPreview(null);
  }, [baseRevision, committedLayout]);

  useEffect(() => {
    if (workType) {
      setReceiptId(null);
    }
  }, [workType]);

  const previewMutation = useMutation({
    mutationFn: async () =>
      runOnlineOnlyWrite(() =>
        client.previewWorkContextLayout({
          baseRevision: currentRevision,
          change: {
            kind: "set-work-context-layout",
            layout: draft,
            workType,
          },
          projectId,
        }),
      ),
    onError: (mutationError) => {
      setLocalError(
        errorMessage(mutationError, "Preview could not be loaded."),
      );
    },
    onSuccess: (nextPreview) => {
      setLocalError(null);
      setPreview(nextPreview.preview);
    },
  });

  const applyMutation = useMutation({
    mutationFn: async () =>
      runOnlineOnlyWrite(() =>
        client.updateProjectConfiguration({
          baseRevision: currentRevision,
          change: {
            kind: "set-work-context-layout",
            layout: draft,
            workType,
          },
          clientIdempotencyKey: crypto.randomUUID(),
          projectId,
        }),
      ),
    onError: (mutationError) => {
      setLocalError(
        errorMessage(
          mutationError,
          "Work Context Card layout could not be changed.",
        ),
      );
    },
    onSuccess: async (nextProject) => {
      setLocalError(null);
      setPreview(null);
      setReceiptId("receiptId" in nextProject ? nextProject.receiptId : null);
      setCurrentRevision(nextProject.revision);
      queryClient.setQueryData(projectQueryKey, nextProject);
      await queryClient.invalidateQueries({ queryKey: projectQueryKey });
    },
  });

  const undoMutation = useMutation({
    mutationFn: () => {
      if (!receiptId) {
        throw new Error(
          "This Work Context Card layout is no longer available for Undo.",
        );
      }
      return runOnlineOnlyWrite(() =>
        client.undoWorkContextLayout({
          baseRevision: currentRevision,
          clientIdempotencyKey: crypto.randomUUID(),
          projectId,
          receiptId,
        }),
      );
    },
    onError: (mutationError) => {
      setLocalError(
        errorMessage(
          mutationError,
          "Work Context Card layout could not be undone.",
        ),
      );
    },
    onSuccess: async (nextProject) => {
      setLocalError(null);
      setReceiptId(null);
      setCurrentRevision(nextProject.revision);
      queryClient.setQueryData(projectQueryKey, nextProject);
      await queryClient.invalidateQueries({ queryKey: projectQueryKey });
    },
  });

  const busy =
    disabled ||
    previewMutation.isPending ||
    applyMutation.isPending ||
    undoMutation.isPending;

  function updateDraft(
    updater: (current: WorkContextLayout) => WorkContextLayout,
  ) {
    setDraft((current) => updater(cloneWorkContextLayout(current)));
    setPreview(null);
    setReceiptId(null);
  }

  function toggleSection(sectionKey: string) {
    updateDraft((current) => ({
      ...current,
      hiddenSections: current.hiddenSections.includes(sectionKey)
        ? current.hiddenSections.filter((key) => key !== sectionKey)
        : [...current.hiddenSections, sectionKey],
    }));
  }

  function moveSection(sectionKey: string, direction: -1 | 1) {
    updateDraft((current) => {
      const index = current.sectionOrder.indexOf(sectionKey);
      const nextIndex = index + direction;
      if (
        index < 0 ||
        nextIndex < 0 ||
        nextIndex >= current.sectionOrder.length
      ) {
        return current;
      }
      const sectionOrder = [...current.sectionOrder];
      const [moved] = sectionOrder.splice(index, 1);
      if (!moved) {
        return current;
      }
      sectionOrder.splice(nextIndex, 0, moved);
      return { ...current, sectionOrder };
    });
  }

  function addCustomSection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = customTitle.trim();
    if (!title) {
      return;
    }
    const condition = conditionFromDraft({
      conditionKind,
      evidenceRole,
      recordType,
      relation,
      status,
    });
    updateDraft((current) => {
      const section: WorkContextCustomSection = {
        condition,
        id: `custom-${crypto.randomUUID()}`,
        title,
      };
      return {
        ...current,
        customSections: [...current.customSections, section],
        sectionOrder: [...current.sectionOrder, section.id],
      };
    });
    setCustomTitle("");
  }

  const customSections = new Map(
    draft.customSections.map((section) => [section.id, section]),
  );
  const sectionLabels = new Map(
    draft.sectionOrder.map((key) => [
      key,
      customSections.get(key)?.title ?? key,
    ]),
  );
  const statusLabel = status ?? "Any status";

  return (
    <div className="mt-3 space-y-5">
      <p className="text-muted-foreground text-xs/relaxed">
        Configure the same Work Context Card presentation for every Work of a
        selected type. Work fields, relations, status semantics, and evidence
        stay unchanged.
      </p>
      <label
        className="grid max-w-xs gap-1 text-xs"
        htmlFor="work-context-layout-type"
      >
        Work type
        <NativeSelect
          disabled={busy}
          id="work-context-layout-type"
          onChange={(event) => setWorkType(event.target.value as WorkType)}
          value={workType}
        >
          {WORK_TYPE_OPTIONS.map((option) => (
            <NativeSelectOption key={option} value={option}>
              {option}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </label>

      <section aria-labelledby="work-context-section-order-heading">
        <h5
          className="font-medium text-sm"
          id="work-context-section-order-heading"
        >
          Sections
        </h5>
        <ul aria-label="Work Context Card sections" className="mt-2 space-y-2">
          {draft.sectionOrder.map((sectionKey, index) => {
            const custom = customSections.get(sectionKey);
            const label = sectionLabels.get(sectionKey) ?? sectionKey;
            const hidden = draft.hiddenSections.includes(sectionKey);
            return (
              <li
                className="flex flex-wrap items-center gap-2 border bg-background p-3"
                key={sectionKey}
              >
                <div className="min-w-48 flex-1">
                  <p
                    className={
                      hidden
                        ? "text-muted-foreground text-sm line-through"
                        : "text-sm"
                    }
                  >
                    {label}
                  </p>
                  {custom ? (
                    <p className="mt-1 text-muted-foreground text-xs">
                      Custom · {conditionLabel(custom.condition)}
                    </p>
                  ) : (
                    <p className="mt-1 text-muted-foreground text-xs">
                      Prepared section
                    </p>
                  )}
                </div>
                <Button
                  aria-label={`${hidden ? "Show" : "Hide"} ${label}`}
                  disabled={busy}
                  onClick={() => toggleSection(sectionKey)}
                  size="xs"
                  type="button"
                  variant="outline"
                >
                  {hidden ? "Show" : "Hide"}
                </Button>
                <Button
                  aria-label={`Move up ${label}`}
                  disabled={busy || index === 0}
                  onClick={() => moveSection(sectionKey, -1)}
                  size="xs"
                  type="button"
                  variant="ghost"
                >
                  ↑
                </Button>
                <Button
                  aria-label={`Move down ${label}`}
                  disabled={busy || index === draft.sectionOrder.length - 1}
                  onClick={() => moveSection(sectionKey, 1)}
                  size="xs"
                  type="button"
                  variant="ghost"
                >
                  ↓
                </Button>
              </li>
            );
          })}
        </ul>
      </section>

      <form
        aria-label="Add custom section"
        className="space-y-3 border border-border/80 border-dashed p-3"
        onSubmit={addCustomSection}
      >
        <h5 className="font-medium text-sm">Add custom section</h5>
        <label
          className="grid gap-1 text-xs"
          htmlFor="work-context-custom-section-title"
        >
          Section name
          <Input
            disabled={busy}
            id="work-context-custom-section-title"
            onChange={(event) => setCustomTitle(event.target.value)}
            value={customTitle}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label
            className="grid gap-1 text-xs"
            htmlFor="work-context-condition-kind"
          >
            Condition
            <NativeSelect
              disabled={busy}
              id="work-context-condition-kind"
              onChange={(event) =>
                setConditionKind(
                  event.target
                    .value as WorkContextCustomSectionCondition["kind"],
                )
              }
              value={conditionKind}
            >
              <NativeSelectOption value="record-type">
                Record type
              </NativeSelectOption>
              <NativeSelectOption value="relation">Relation</NativeSelectOption>
              <NativeSelectOption value="evidence-role">
                Evidence Role
              </NativeSelectOption>
            </NativeSelect>
          </label>
          {conditionKind === "record-type" ? (
            <label
              className="grid gap-1 text-xs"
              htmlFor="work-context-record-type"
            >
              Record type
              <NativeSelect
                disabled={busy}
                id="work-context-record-type"
                onChange={(event) =>
                  setRecordType(
                    event.target
                      .value as (typeof WORK_CONTEXT_CUSTOM_RECORD_TYPE_OPTIONS)[number],
                  )
                }
                value={recordType}
              >
                {WORK_CONTEXT_CUSTOM_RECORD_TYPE_OPTIONS.map((option) => (
                  <NativeSelectOption key={option} value={option}>
                    {option}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </label>
          ) : null}
          {conditionKind === "relation" ? (
            <label
              className="grid gap-1 text-xs"
              htmlFor="work-context-relation"
            >
              Relation
              <NativeSelect
                disabled={busy}
                id="work-context-relation"
                onChange={(event) =>
                  setRelation(
                    event.target
                      .value as (typeof WORK_CONTEXT_CUSTOM_RELATION_OPTIONS)[number],
                  )
                }
                value={relation}
              >
                {WORK_CONTEXT_CUSTOM_RELATION_OPTIONS.map((option) => (
                  <NativeSelectOption key={option} value={option}>
                    {option}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </label>
          ) : null}
          {conditionKind === "evidence-role" ? (
            <label
              className="grid gap-1 text-xs"
              htmlFor="work-context-evidence-role"
            >
              Evidence Role
              <NativeSelect
                disabled={busy}
                id="work-context-evidence-role"
                onChange={(event) =>
                  setEvidenceRole(event.target.value as WorkContextEvidenceRole)
                }
                value={evidenceRole}
              >
                {WORK_CONTEXT_EVIDENCE_ROLE_OPTIONS.map((option) => (
                  <NativeSelectOption key={option} value={option}>
                    {option}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </label>
          ) : null}
        </div>
        <label
          className="grid max-w-xs gap-1 text-xs"
          htmlFor="work-context-status-condition"
        >
          Status condition
          <NativeSelect
            disabled={busy}
            id="work-context-status-condition"
            onChange={(event) =>
              setStatus(
                event.target.value === EMPTY_STATUS
                  ? null
                  : (event.target
                      .value as (typeof WORK_STATUS_OPTIONS)[number]),
              )
            }
            value={status ?? EMPTY_STATUS}
          >
            <NativeSelectOption value={EMPTY_STATUS}>
              Any status
            </NativeSelectOption>
            {WORK_STATUS_OPTIONS.map((option) => (
              <NativeSelectOption key={option} value={option}>
                {option}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
        <p className="text-muted-foreground text-xs">
          Only records reachable from the open Work through the selected catalog
          condition are shown.
        </p>
        <Button disabled={busy || !customTitle.trim()} size="xs" type="submit">
          Add custom section
        </Button>
        <p className="text-muted-foreground text-xs">
          Current status filter: {statusLabel}
        </p>
      </form>

      <div className="flex flex-wrap gap-2">
        <Button
          disabled={busy || !isDirty}
          onClick={() => previewMutation.mutate()}
          type="button"
          variant="outline"
        >
          Preview
        </Button>
        <Button
          disabled={busy || !isDirty || !preview}
          onClick={() => applyMutation.mutate()}
          type="button"
        >
          Confirm
        </Button>
        {receiptId ? (
          <Button
            disabled={busy}
            onClick={() => undoMutation.mutate()}
            type="button"
            variant="outline"
          >
            Undo
          </Button>
        ) : null}
      </div>

      {preview ? (
        <div
          aria-label="Layout preview"
          className="space-y-2 border border-primary/25 bg-primary/5 p-3 text-sm"
          role="status"
        >
          <p className="font-medium">Layout preview</p>
          <p className="text-muted-foreground">
            Affected Work type: {workType}
          </p>
          <p className="text-muted-foreground">
            Added: {preview.added.join(", ") || "None"}
          </p>
          <p className="text-muted-foreground">
            Hidden: {preview.hidden.join(", ") || "None"}
          </p>
          <p className="text-muted-foreground">
            Shown: {preview.shown.join(", ") || "None"}
          </p>
          <p className="text-muted-foreground">
            Moved: {preview.moved.join(", ") || "None"}
          </p>
        </div>
      ) : null}
      <p className="text-muted-foreground text-xs">
        Initial Work fields: {WORK_CONTEXT_INITIAL_FIELDS.join(", ")}
      </p>
      <ConfigurationMutationError error={error ?? localError} />
    </div>
  );
}

function conditionFromDraft({
  conditionKind,
  evidenceRole,
  recordType,
  relation,
  status,
}: {
  conditionKind: WorkContextCustomSectionCondition["kind"];
  evidenceRole: WorkContextEvidenceRole;
  recordType: (typeof WORK_CONTEXT_CUSTOM_RECORD_TYPE_OPTIONS)[number];
  relation: (typeof WORK_CONTEXT_CUSTOM_RELATION_OPTIONS)[number];
  status: (typeof WORK_STATUS_OPTIONS)[number] | null;
}): WorkContextCustomSectionCondition {
  switch (conditionKind) {
    case "record-type":
      return { kind: conditionKind, recordType, status };
    case "relation":
      return { kind: conditionKind, relation, status };
    case "evidence-role":
      return { evidenceRole, kind: conditionKind, status };
    default:
      throw new Error("Unsupported Work Context Card condition.");
  }
}

function conditionLabel(condition: WorkContextCustomSectionCondition) {
  switch (condition.kind) {
    case "record-type":
      return `${condition.recordType}${condition.status ? ` · ${condition.status}` : ""}`;
    case "relation":
      return `${condition.relation}${condition.status ? ` · ${condition.status}` : ""}`;
    case "evidence-role":
      return `${condition.evidenceRole}${condition.status ? ` · ${condition.status}` : ""}`;
    default:
      throw new Error("Unsupported Work Context Card condition.");
  }
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function ConfigurationMutationError({ error }: { error: string | null }) {
  return error ? (
    <p className="text-destructive text-sm" role="alert">
      {error}
    </p>
  ) : null;
}
