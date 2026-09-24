import type { AccountPreferences } from "@cantiara/api/account-preferences";
import type {
  ProjectOverviewModel,
  ProjectOverviewModule,
  ProjectOverviewModuleName,
  ProjectOverviewSourceRecord,
} from "@cantiara/api/project-overview";
import type { ProjectArea } from "@cantiara/api/project-shell";
import { useLinkProps } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";

import {
  formatAccountDate,
  formatAccountDateTime,
} from "@/features/account-preferences/lib/account-preferences-format";
import { projectAreaNavigationHash } from "@/features/project-shell/lib/project-area-navigation";

import {
  EMPTY_SOURCE_MESSAGE,
  emptyModuleMessage,
  formatOverviewDate,
  moduleAnchor,
  moduleRecords,
  OPEN_SOURCE_RECORD_LABEL,
  slug,
} from "../../lib/project-overview";

type OverviewFormattingPreferences = AccountPreferences;

export function OverviewSummary({
  emptyMessage,
  label,
  value,
}: {
  emptyMessage?: string;
  label: string;
  value: string | null;
}) {
  return (
    <div
      className="border-border/70 border-t py-4"
      data-overview-module={label}
    >
      <h3
        className="font-medium text-muted-foreground text-sm"
        id={`overview-summary-${slug(label)}-heading`}
      >
        {label}
      </h3>
      <p className="mt-1 text-pretty font-medium text-base/relaxed">
        {value ?? emptyMessage ?? EMPTY_SOURCE_MESSAGE}
      </p>
    </div>
  );
}

export function EnabledProjectAreas({
  areas,
}: {
  areas: readonly ProjectArea[];
}) {
  return (
    <div className="border-border/70 border-y py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3
          className="font-medium text-base"
          id="overview-project-areas-heading"
        >
          Project areas
        </h3>
        <p className="text-muted-foreground text-xs">
          Visible entries from Project Shell
        </p>
      </div>
      {areas.length > 0 ? (
        <ul
          aria-label="Visible Project areas"
          className="mt-4 flex flex-wrap gap-2"
        >
          {areas.map((area) => (
            <ProjectAreaEntry area={area} key={area} />
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-muted-foreground text-sm">
          No Project areas are visible yet.
        </p>
      )}
    </div>
  );
}

function ProjectAreaEntry({ area }: { area: ProjectArea }) {
  const linkProps = useLinkProps({
    activeOptions: { exact: true, includeHash: true },
    hash: projectAreaNavigationHash(area),
    to: ".",
  });

  return (
    <li data-overview-area={area}>
      <a
        {...linkProps}
        className="block rounded-md border border-border/80 bg-background/70 px-3 py-2 text-sm underline-offset-4 hover:border-foreground/30 hover:bg-muted hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        data-overview-area-entry={area}
      >
        {area}
      </a>
    </li>
  );
}

export function OverviewModule({
  formattingPreferences,
  module,
  overview,
}: {
  formattingPreferences: OverviewFormattingPreferences;
  module: ProjectOverviewModule;
  overview: ProjectOverviewModel;
}) {
  const records = moduleRecords(module, overview);
  const moduleId = moduleAnchor(module.name);
  const emptyMessage = emptyModuleMessage(module.name);

  return (
    <div
      className="flex min-h-0 flex-col border-border/70 border-t pt-4"
      data-overview-module={module.name}
      id={moduleId}
    >
      <header className="flex items-baseline justify-between gap-3 border-b pb-2">
        <h3 className="font-medium text-base" id={`${moduleId}-heading`}>
          {module.sourceHref ? (
            <a
              aria-label={`${OPEN_SOURCE_RECORD_LABEL}: ${module.name}`}
              className="underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              href={module.sourceHref}
            >
              {module.name}
            </a>
          ) : (
            module.name
          )}
        </h3>
        {records.length > 0 ? (
          <ModuleSourceCount module={module} recordCount={records.length} />
        ) : null}
      </header>

      {records.length > 0 ? (
        <ul
          aria-label={`${module.name} source records`}
          className="mt-2 divide-y"
        >
          {records.map((record) => (
            <SourceRecord
              formattingPreferences={formattingPreferences}
              key={record.id}
              moduleName={module.name}
              record={record}
            />
          ))}
        </ul>
      ) : (
        <p className="mt-3 pb-1 text-muted-foreground text-sm/relaxed">
          {emptyMessage}
        </p>
      )}
    </div>
  );
}

function ModuleSourceCount({
  module,
  recordCount,
}: {
  module: ProjectOverviewModule;
  recordCount: number;
}) {
  const countLabel = `${recordCount} source ${
    recordCount === 1 ? "record" : "records"
  }`;

  if (module.sourceHref) {
    return (
      <a
        aria-label={`${OPEN_SOURCE_RECORD_LABEL}: ${module.name} (${countLabel})`}
        className="text-muted-foreground text-xs underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        href={module.sourceHref}
      >
        {countLabel}
      </a>
    );
  }

  return <span className="text-muted-foreground text-xs">{countLabel}</span>;
}

function SourceRecord({
  formattingPreferences,
  moduleName,
  record,
}: {
  formattingPreferences: OverviewFormattingPreferences;
  moduleName: ProjectOverviewModuleName;
  record: ProjectOverviewSourceRecord;
}) {
  const dateValue = record.targetDate ?? record.updatedAt;

  return (
    <li
      className="py-3 first:pt-3 last:pb-1"
      data-overview-record={record.id}
      data-overview-stage={moduleName === "Stages" ? record.id : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {record.type ? (
            <p className="text-[0.68rem] text-muted-foreground uppercase tracking-[0.12em]">
              {record.type}
            </p>
          ) : null}
          <p className="mt-1 text-pretty font-medium text-sm">{record.title}</p>
          {record.description ? (
            <p className="mt-1 text-muted-foreground text-xs/relaxed">
              {record.description}
            </p>
          ) : null}
          {record.status ? (
            <p className="mt-2 text-muted-foreground text-xs">
              {record.status}
            </p>
          ) : null}
          {dateValue ? (
            <time
              className="mt-2 block text-muted-foreground text-xs"
              dateTime={dateValue}
            >
              {formatOverviewDate(
                dateValue,
                formattingPreferences,
                formatAccountDate,
                formatAccountDateTime,
              )}
            </time>
          ) : null}
        </div>
        {record.href ? (
          <a
            className="inline-flex shrink-0 items-center gap-1 text-primary text-xs underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            href={record.href}
          >
            {OPEN_SOURCE_RECORD_LABEL}
            <ArrowUpRight aria-hidden="true" className="size-3" />
            <span className="sr-only">{record.title}</span>
          </a>
        ) : null}
      </div>
      <span className="sr-only">{moduleName}</span>
    </li>
  );
}
