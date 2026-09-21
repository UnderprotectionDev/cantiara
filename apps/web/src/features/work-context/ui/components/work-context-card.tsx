import type { WorkStatusLabel } from "@cantiara/api/project-shell";
import {
  buildWorkContextModel,
  getPreparedWorkContextLayout,
  nextPreparedWorkContextSection,
  type PreparedWorkContextSection,
  sourcesForWorkContextSection,
  type WorkContextInitialField,
  type WorkContextSource,
} from "@cantiara/api/work-context";
import type { WorkProfile, WorkType } from "@cantiara/api/work-lifecycle";
import { Button } from "@cantiara/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { useLinkProps, useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";

import { getWorkStatusLabel } from "@/features/work-lifecycle/ui/forms/work-status-form";
import { orpc } from "@/utils/orpc";

const WORK_CONTEXT_SECTION_ID_PATTERN = /[^a-z0-9]+/gi;

interface WorkContextState {
  visibleSections: PreparedWorkContextSection[];
  workType: WorkType;
}

export default function WorkContextCard({
  work,
  workStatusLabels,
  projectWorks = [],
}: {
  projectWorks?: readonly WorkProfile[];
  work: WorkProfile;
  workStatusLabels: readonly WorkStatusLabel[];
}) {
  const relationsQuery = useQuery(
    orpc.relations.queryOptions({
      input: { recordId: work.id, recordType: "Work" },
    }),
  );
  const layout = getPreparedWorkContextLayout(work.type);
  const [contextState, setContextState] = useState<WorkContextState>({
    visibleSections: [],
    workType: work.type,
  });
  const visibleSections =
    contextState.workType === work.type ? contextState.visibleSections : [];
  const nextSection = nextPreparedWorkContextSection(
    work.type,
    visibleSections,
  );
  const contextModel = buildWorkContextModel({
    projectWorks,
    relations: relationsQuery.data ?? [],
    work,
  });

  function addContext() {
    if (!nextSection) {
      return;
    }
    setContextState({
      visibleSections: [...visibleSections, nextSection],
      workType: work.type,
    });
  }

  const initialFieldValues: Record<WorkContextInitialField, string> = {
    Planning: "Not set",
    Status: getWorkStatusLabel(work.status, workStatusLabels),
    Title: work.title,
    Type: work.type,
  };

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
        {nextSection ? (
          <div className="flex flex-col items-end gap-1">
            <Button
              aria-describedby={`work-context-next-${work.id}`}
              onClick={addContext}
              size="xs"
              type="button"
            >
              Add Context
            </Button>
            <span className="sr-only" id={`work-context-next-${work.id}`}>
              Opens {nextSection}.
            </span>
          </div>
        ) : null}
      </header>

      <WhyChain
        isError={relationsQuery.isError}
        isPending={relationsQuery.isPending}
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

      {visibleSections.map((section) => (
        <PreparedSection
          key={section}
          section={section}
          sources={sourcesForWorkContextSection(section, contextModel.sources)}
          work={work}
          workStatusLabels={workStatusLabels}
        />
      ))}
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
  section,
  sources,
  work,
  workStatusLabels,
}: {
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
      {sources.length > 0 ? (
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
      {!hasDescription && sources.length === 0 ? (
        <EmptyContextState work={work} />
      ) : null}
    </section>
  );
}

function EmptyContextState({ work }: { work: WorkProfile }) {
  const navigate = useNavigate();
  const handleLink = useCallback(() => {
    navigate({
      hash: `work-relations-${encodeURIComponent(work.id)}`,
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
  let sourceText: string;
  if (source.broken) {
    sourceText =
      source.key && source.title
        ? `${source.key} ${source.title} — ${source.broken.reason}`
        : `Broken — ${source.broken.reason}`;
  } else if (source.key && source.title) {
    sourceText = `${source.key} ${source.title}`;
  } else {
    sourceText = source.title ?? source.recordType;
  }
  const canOpenSourceRecord = Boolean(
    source.recordType === "Work" &&
      source.projectId &&
      (!source.broken || source.broken.canOpenSourceRecord),
  );

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-border/60 px-3 py-2 text-sm">
      <span className="text-muted-foreground">{source.label}</span>
      <span>{sourceText}</span>
      {source.status ? (
        <span className="text-muted-foreground">
          Status: {getWorkStatusLabel(source.status, workStatusLabels)}
        </span>
      ) : null}
      {canOpenSourceRecord && source.projectId ? (
        <OpenSourceRecordLink
          projectId={source.projectId}
          recordId={source.recordId}
        />
      ) : null}
    </div>
  );
}

function OpenSourceRecordLink({
  projectId,
  recordId,
}: {
  projectId: string;
  recordId: string;
}) {
  const linkProps = useLinkProps({
    activeOptions: { exact: true, includeHash: true },
    hash: `work-${recordId}`,
    params: { projectId },
    to: "/projects/$projectId",
  });

  return (
    <a {...linkProps} className="underline underline-offset-2">
      Open source record
    </a>
  );
}

function workContextSectionId(
  workId: string,
  section: PreparedWorkContextSection,
) {
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
