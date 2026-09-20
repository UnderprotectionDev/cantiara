import {
  getPreparedWorkContextLayout,
  nextPreparedWorkContextSection,
  type PreparedWorkContextSection,
  type WorkContextInitialField,
} from "@cantiara/api/work-context";
import type { WorkProfile, WorkType } from "@cantiara/api/work-lifecycle";
import { Button } from "@cantiara/ui/components/button";
import { useState } from "react";

const WORK_CONTEXT_SECTION_ID_PATTERN = /[^a-z0-9]+/gi;

interface WorkContextState {
  visibleSections: PreparedWorkContextSection[];
  workType: WorkType;
}

export default function WorkContextCard({ work }: { work: WorkProfile }) {
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
    Status: work.status,
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
        <section
          aria-labelledby={workContextSectionId(work.id, section)}
          className="space-y-2 border-border/70 border-t pt-3"
          key={section}
        >
          <h5
            className="font-medium text-sm"
            id={workContextSectionId(work.id, section)}
          >
            {section}
          </h5>
          <p className="text-muted-foreground text-sm">Nothing here yet.</p>
        </section>
      ))}
    </section>
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
