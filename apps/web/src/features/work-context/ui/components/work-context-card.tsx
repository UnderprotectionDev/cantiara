import type { WorkStatusLabel } from "@cantiara/api/project-shell";
import {
  buildWorkContextModel,
  getPreparedWorkContextLayout,
  getWorkContextLayout,
  nextWorkContextSection,
  type PreparedWorkContextSection,
  sourcesForWorkContextCustomSection,
  sourcesForWorkContextSection,
  type WorkContextCustomSection,
  type WorkContextInitialField,
  type WorkContextLayouts,
  type WorkContextPriorityFoundations,
  type WorkContextPriorityValue,
  type WorkContextPriorityValues,
  type WorkContextSource,
  workContextLayoutSections,
  workContextSourceText,
} from "@cantiara/api/work-context";
import type { WorkProfile, WorkType } from "@cantiara/api/work-lifecycle";
import { Button } from "@cantiara/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { useLinkProps, useNavigate } from "@tanstack/react-router";
import {
  type MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useCommandPalette } from "@/features/command-palette/ui/components/command-palette";
import {
  workRecordHash,
  workRecordHref,
  workRelationsHash,
} from "@/features/project-shell/lib/project-shell-navigation";
import { getWorkStatusLabel } from "@/features/work-lifecycle/ui/forms/work-status-form";
import { orpc } from "@/utils/orpc";
import {
  COPY_CONTEXT_AS_MARKDOWN_LABEL,
  createCopyContextAsMarkdownCommand,
} from "./work-context-markdown";

const WORK_CONTEXT_SECTION_ID_PATTERN = /[^a-z0-9]+/gi;

interface WorkContextState {
  visibleSections: string[];
  workType: WorkType;
}

export default function WorkContextCard({
  work,
  workStatusLabels,
  priorityValues,
  projectWorks = [],
  workContextLayouts,
}: {
  priorityValues?: WorkContextPriorityValues;
  projectWorks?: readonly WorkProfile[];
  work: WorkProfile;
  workContextLayouts?: Partial<WorkContextLayouts>;
  workStatusLabels: readonly WorkStatusLabel[];
}) {
  const relationsQuery = useQuery(
    orpc.relations.queryOptions({
      input: { recordId: work.id, recordType: "Work" },
    }),
  );
  const workContextQuery = useQuery(
    orpc.workContext.queryOptions({ input: { workId: work.id } }),
  );
  const commandPalette = useCommandPalette();
  const registerCommand = commandPalette?.registerCommand;
  const layout = getPreparedWorkContextLayout(work.type);
  const configuredLayout = getWorkContextLayout(work.type, workContextLayouts);
  const configuredSections = workContextLayoutSections(
    work.type,
    configuredLayout,
  );
  const [contextState, setContextState] = useState<WorkContextState>({
    visibleSections: [],
    workType: work.type,
  });
  const visibleSections =
    contextState.workType === work.type ? contextState.visibleSections : [];
  const nextSection = nextWorkContextSection(
    work.type,
    visibleSections,
    configuredLayout,
  );
  const displayedSections = configuredSections.filter((section) =>
    visibleSections.includes(section.key),
  );
  const contextModel = useMemo(
    () =>
      buildWorkContextModel({
        projectWorks,
        priorityValues: priorityValues ?? workContextQuery.data?.priorityValues,
        relations: relationsQuery.data ?? [],
        work,
      }),
    [
      priorityValues,
      projectWorks,
      relationsQuery.data,
      work,
      workContextQuery.data?.priorityValues,
    ],
  );
  const statusLabel = getWorkStatusLabel(work.status, workStatusLabels);
  const sourceLink = useCallback((source: WorkContextSource) => {
    if (
      source.recordType !== "Work" ||
      !source.projectId ||
      (source.broken && !source.broken.canOpenSourceRecord)
    ) {
      return null;
    }
    return workRecordHref(source.projectId, source.recordId);
  }, []);
  const copyCommand = useMemo(
    () =>
      createCopyContextAsMarkdownCommand({
        model: contextModel,
        statusLabel,
        work,
        sourceLink,
      }),
    [contextModel, sourceLink, statusLabel, work],
  );
  const copyCommandRef = useRef(copyCommand);
  copyCommandRef.current = copyCommand;
  const copyCommandRegistrationKey = JSON.stringify([
    copyCommand.id,
    copyCommand.scope,
    copyCommand.target,
  ]);
  useEffect(() => {
    if (
      !registerCommand ||
      relationsQuery.isPending ||
      relationsQuery.isError
    ) {
      return;
    }
    const registeredCommand = copyCommandRef.current;
    const registeredCommandKey = JSON.stringify([
      registeredCommand.id,
      registeredCommand.scope,
      registeredCommand.target,
    ]);
    if (registeredCommandKey !== copyCommandRegistrationKey) {
      return;
    }
    return registerCommand({
      ...registeredCommand,
      run: () => copyCommandRef.current.run(),
    });
  }, [
    copyCommandRegistrationKey,
    registerCommand,
    relationsQuery.isError,
    relationsQuery.isPending,
  ]);
  const [copyState, setCopyState] = useState<"idle" | "copying" | "copied">(
    "idle",
  );
  const [copyError, setCopyError] = useState<string | null>(null);

  function addContext() {
    if (!nextSection) {
      return;
    }
    setContextState({
      visibleSections: [...visibleSections, nextSection.key],
      workType: work.type,
    });
  }

  const initialFieldValues: Record<WorkContextInitialField, string> = {
    Planning: "Not set",
    Status: statusLabel,
    Title: work.title,
    Type: work.type,
  };

  const handleCopy = useCallback(async () => {
    setCopyError(null);
    setCopyState("copying");
    try {
      await copyCommand.run();
      setCopyState("copied");
    } catch (error) {
      setCopyState("idle");
      setCopyError(copyErrorMessage(error));
    }
  }, [copyCommand]);

  return (
    <section
      aria-labelledby={`work-context-card-${work.id}-heading`}
      className="space-y-4 rounded-md border border-border/70 bg-background/60 p-4"
      data-work-context-card="true"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-muted-foreground text-xs">Work Context Card</p>
          <h4
            className="mt-1 font-medium text-sm"
            id={`work-context-card-${work.id}-heading`}
          >
            {work.title}
          </h4>
        </div>
        <div className="flex flex-wrap items-end justify-end gap-2">
          <Button
            data-command-id={copyCommand.id}
            disabled={
              relationsQuery.isPending ||
              relationsQuery.isError ||
              copyState === "copying"
            }
            onClick={handleCopy}
            size="xs"
            type="button"
            variant="outline"
          >
            {COPY_CONTEXT_AS_MARKDOWN_LABEL}
          </Button>
          {nextSection ? (
            <Button
              aria-describedby={`work-context-next-${work.id}`}
              onClick={addContext}
              size="xs"
              type="button"
            >
              Add Context
            </Button>
          ) : null}
          {nextSection ? (
            <span className="sr-only" id={`work-context-next-${work.id}`}>
              Opens {nextSection.label}.
            </span>
          ) : null}
        </div>
      </header>

      {copyState === "copied" ? (
        <p aria-live="polite" className="text-muted-foreground text-sm">
          Context copied.
        </p>
      ) : null}
      {copyError ? (
        <p
          aria-live="assertive"
          className="text-destructive text-sm"
          role="alert"
        >
          {copyError}
        </p>
      ) : null}

      <WhyChain
        isError={workContextQuery.isError}
        isPending={workContextQuery.isPending}
        sources={contextModel.whyChain}
        work={work}
        workStatusLabels={workStatusLabels}
      />

      <dl
        aria-label={`${work.key} initial Work fields`}
        className="grid gap-3 text-sm sm:grid-cols-4"
      >
        {layout.initialFields.map((field) => (
          <InitialField
            key={field}
            label={field}
            value={initialFieldValues[field]}
          />
        ))}
      </dl>

      <PriorityFoundations
        foundations={contextModel.priorityFoundations}
        isError={workContextQuery.isError}
        isPending={workContextQuery.isPending}
        work={work}
        workStatusLabels={workStatusLabels}
      />

      {displayedSections.map((section) => {
        if (section.prepared) {
          return (
            <PreparedSection
              isError={relationsQuery.isError}
              isPending={relationsQuery.isPending}
              key={section.key}
              section={section.prepared}
              sources={sourcesForWorkContextSection(
                section.prepared,
                contextModel.sources,
              )}
              work={work}
              workStatusLabels={workStatusLabels}
            />
          );
        }
        if (section.custom) {
          return (
            <CustomSection
              isError={relationsQuery.isError}
              isPending={relationsQuery.isPending}
              key={section.key}
              section={section.custom}
              sources={sourcesForWorkContextCustomSection(
                section.custom,
                contextModel.customSources,
              )}
              work={work}
              workStatusLabels={workStatusLabels}
            />
          );
        }
        return null;
      })}
    </section>
  );
}

function WhyChain({
  isError,
  isPending,
  sources,
  work,
  workStatusLabels,
}: {
  isError: boolean;
  isPending: boolean;
  sources: readonly WorkContextSource[];
  work: WorkProfile;
  workStatusLabels: readonly WorkStatusLabel[];
}) {
  const headingId = `work-context-why-${work.id}`;
  return (
    <section
      aria-labelledby={headingId}
      className="space-y-2 border-border/70 border-t pt-3"
    >
      <h5 className="font-medium text-sm" id={headingId}>
        Why am I doing this work?
      </h5>
      {isPending ? (
        <p className="text-muted-foreground text-sm">Loading relations…</p>
      ) : null}
      {isError ? (
        <p className="text-destructive text-sm" role="alert">
          Relations could not be loaded. Try loading this page again.
        </p>
      ) : null}
      {!(isPending || isError) && sources.length > 0 ? (
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm">
          {sources.map((source, index) => (
            <li className="flex items-center gap-2" key={source.id}>
              {index > 0 ? (
                <span aria-hidden="true" className="text-muted-foreground">
                  →
                </span>
              ) : null}
              <WorkContextSourceItem
                source={source}
                workStatusLabels={workStatusLabels}
              />
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}

function PreparedSection({
  isError,
  isPending,
  section,
  sources,
  work,
  workStatusLabels,
}: {
  isError: boolean;
  isPending: boolean;
  section: PreparedWorkContextSection;
  sources: readonly WorkContextSource[];
  work: WorkProfile;
  workStatusLabels: readonly WorkStatusLabel[];
}) {
  const headingId = workContextSectionId(work.id, section);
  const hasDescription = Boolean(section === "Description" && work.description);
  return (
    <section
      aria-labelledby={headingId}
      className="space-y-2 border-border/70 border-t pt-3"
    >
      <h5 className="font-medium text-sm" id={headingId}>
        {section}
      </h5>
      {hasDescription ? (
        <p className="whitespace-pre-wrap text-sm">{work.description}</p>
      ) : null}
      {isPending ? (
        <p className="text-muted-foreground text-sm">Loading relations…</p>
      ) : null}
      {isError ? (
        <p className="text-destructive text-sm" role="alert">
          Relations could not be loaded. Try loading this page again.
        </p>
      ) : null}
      {!(isPending || isError) && sources.length > 0 ? (
        <ul className="space-y-2">
          {sources.map((source) => (
            <li key={source.id}>
              <WorkContextSourceItem
                source={source}
                workStatusLabels={workStatusLabels}
              />
            </li>
          ))}
        </ul>
      ) : null}
      {!(hasDescription || isPending || isError) && sources.length === 0 ? (
        <EmptyContextState work={work} />
      ) : null}
    </section>
  );
}

function CustomSection({
  isError,
  isPending,
  section,
  sources,
  work,
  workStatusLabels,
}: {
  isError: boolean;
  isPending: boolean;
  section: WorkContextCustomSection;
  sources: readonly WorkContextSource[];
  work: WorkProfile;
  workStatusLabels: readonly WorkStatusLabel[];
}) {
  const headingId = workContextSectionId(work.id, section.id);
  return (
    <section
      aria-labelledby={headingId}
      className="space-y-2 border-border/70 border-t pt-3"
    >
      <h5 className="font-medium text-sm" id={headingId}>
        {section.title}
      </h5>
      {isPending ? (
        <p className="text-muted-foreground text-sm">Loading relations…</p>
      ) : null}
      {isError ? (
        <p className="text-destructive text-sm" role="alert">
          Relations could not be loaded. Try loading this page again.
        </p>
      ) : null}
      {!(isPending || isError) && sources.length > 0 ? (
        <ul className="space-y-2">
          {sources.map((source) => (
            <li key={source.id}>
              <WorkContextSourceItem
                source={source}
                workStatusLabels={workStatusLabels}
              />
            </li>
          ))}
        </ul>
      ) : null}
      {!(isPending || isError) && sources.length === 0 ? (
        <EmptyContextState work={work} />
      ) : null}
    </section>
  );
}

function EmptyContextState({ work }: { work: WorkProfile }) {
  const navigate = useNavigate();
  const handleLink = useCallback(() => {
    navigate({
      hash: workRelationsHash(work.id),
      to: ".",
    }).catch(() => undefined);
  }, [navigate, work.id]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="text-muted-foreground text-sm">Nothing here yet.</p>
      <Button
        className="px-0"
        onClick={handleLink}
        size="xs"
        type="button"
        variant="link"
      >
        Link
      </Button>
    </div>
  );
}

function WorkContextSourceItem({
  source,
  workStatusLabels,
}: {
  source: WorkContextSource;
  workStatusLabels: readonly WorkStatusLabel[];
}) {
  const sourceText = workContextSourceText(source);
  const canOpenSourceRecord = canOpenWorkContextSource(source);

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-border/60 px-3 py-2 text-sm">
      <span className="text-muted-foreground">{source.label}</span>
      <span>{sourceText}</span>
      {source.status ? (
        <span className="text-muted-foreground">
          Status: {getWorkStatusLabel(source.status, workStatusLabels)}
        </span>
      ) : null}
      {canOpenSourceRecord &&
      (source.recordType === "Work" ? source.projectId : source.openPath) ? (
        <OpenSourceRecordLink
          href={source.openPath ?? null}
          projectId={source.projectId}
          recordId={source.recordId}
          useRouterLink={source.recordType === "Work"}
        />
      ) : null}
    </div>
  );
}

function OpenSourceRecordLink({
  href,
  projectId,
  recordId,
  useRouterLink,
}: {
  href: string | null;
  projectId: string | null;
  recordId: string;
  useRouterLink: boolean;
}) {
  const linkProps = useLinkProps({
    activeOptions: { exact: true, includeHash: true },
    hash: workRecordHash(recordId),
    params: { projectId: projectId ?? "" },
    to: "/projects/$projectId",
  });

  return (
    <a
      {...(useRouterLink ? linkProps : { href: href ?? undefined })}
      className="underline underline-offset-2"
    >
      Open source record
    </a>
  );
}

function workContextSectionId(workId: string, section: string) {
  const sectionSlug = section
    .toLowerCase()
    .replaceAll(WORK_CONTEXT_SECTION_ID_PATTERN, "-");
  return `work-context-section-${workId}-${sectionSlug}`;
}

function InitialField({
  label,
  value,
}: {
  label: WorkContextInitialField;
  value: string;
}) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}

function PriorityFoundations({
  foundations,
  isError,
  isPending,
  work,
  workStatusLabels,
}: {
  foundations: WorkContextPriorityFoundations;
  isError: boolean;
  isPending: boolean;
  work: WorkProfile;
  workStatusLabels: readonly WorkStatusLabel[];
}) {
  const [openCountId, setOpenCountId] = useState<string | null>(null);
  const headingId = `work-context-priority-foundations-${work.id}`;
  const toggleCount = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    const { currentTarget } = event;
    const { countId } = currentTarget.dataset;
    if (!countId) {
      return;
    }
    setOpenCountId((current) => (current === countId ? null : countId));
  }, []);

  return (
    <section
      aria-labelledby={headingId}
      className="space-y-3 border-border/70 border-t pt-3"
      data-work-context-priority-foundations="true"
    >
      <h5 className="font-medium text-sm" id={headingId}>
        Priority Foundations
      </h5>
      {isPending ? (
        <p className="text-muted-foreground text-sm">Loading relations…</p>
      ) : null}
      {isError ? (
        <p className="text-destructive text-sm" role="alert">
          Priority Foundations could not be loaded. Try loading this page again.
        </p>
      ) : null}
      {!(isPending || isError) &&
      foundations.values.length === 0 &&
      foundations.counts.length === 0 ? (
        <EmptyContextState work={work} />
      ) : null}
      {!(isPending || isError) && foundations.values.length > 0 ? (
        <ul className="space-y-2">
          {foundations.values.map((value) => (
            <PriorityFoundationValue
              key={value.id}
              value={value}
              workStatusLabels={workStatusLabels}
            />
          ))}
        </ul>
      ) : null}
      {!(isPending || isError) && foundations.counts.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {foundations.counts.map((count) => {
            const isOpen = openCountId === count.id;
            const listId = `${count.id}-${work.id}`;
            return (
              <li key={count.id}>
                <Button
                  aria-controls={isOpen ? listId : undefined}
                  aria-expanded={isOpen}
                  aria-label={`Show ${count.label} source records (${count.count})`}
                  className="px-2 text-sm underline-offset-2 hover:underline"
                  data-count-id={count.id}
                  onClick={toggleCount}
                  size="xs"
                  type="button"
                  variant="outline"
                >
                  {count.label}: {count.count}
                </Button>
                {isOpen ? (
                  <ul
                    aria-label={`${count.label} source records`}
                    className="mt-2 space-y-2"
                    id={listId}
                  >
                    {count.sources.map((source) => (
                      <li key={source.id}>
                        <WorkContextSourceItem
                          source={source}
                          workStatusLabels={workStatusLabels}
                        />
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}

function PriorityFoundationValue({
  value,
  workStatusLabels,
}: {
  value: WorkContextPriorityValue;
  workStatusLabels: readonly WorkStatusLabel[];
}) {
  const { source } = value;
  const workSource = isWorkContextSource(source) ? source : null;
  const sourceLink =
    workSource &&
    canOpenWorkContextSource(workSource) &&
    (workSource.recordType === "Work"
      ? workSource.projectId
      : workSource.openPath)
      ? {
          href: workSource.openPath ?? null,
          projectId: workSource.projectId,
          recordId: workSource.recordId,
          useRouterLink: workSource.recordType === "Work",
        }
      : null;

  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-border/60 px-3 py-2 text-sm">
      <span className="text-muted-foreground">{value.label}</span>
      <span>{value.value}</span>
      {workSource?.status ? (
        <span className="text-muted-foreground">
          Status: {getWorkStatusLabel(workSource.status, workStatusLabels)}
        </span>
      ) : null}
      {sourceLink ? <OpenSourceRecordLink {...sourceLink} /> : null}
    </li>
  );
}

function canOpenWorkContextSource(source: WorkContextSource) {
  return Boolean(
    (!source.broken || source.broken.canOpenSourceRecord) &&
      (source.openPath || (source.recordType === "Work" && source.projectId)),
  );
}

function isWorkContextSource(
  source: WorkContextPriorityValue["source"],
): source is WorkContextSource {
  return "recordType" in source;
}

function copyErrorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : "Context could not be copied.";
}
