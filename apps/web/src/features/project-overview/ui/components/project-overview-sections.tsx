import type { AccountPreferences } from "@cantiara/api/account-preferences";
import type {
  ProjectOverviewModel,
  ProjectOverviewModule,
  ProjectOverviewModuleName,
  ProjectOverviewSourceRecord,
} from "@cantiara/api/project-overview";
import type { ProjectArea } from "@cantiara/api/project-shell";
import {
  VirtualList,
  type VirtualRowProps,
} from "@cantiara/ui/components/virtual-list";
import { virtualRowId } from "@cantiara/ui/lib/virtual-list-dom";
import { useLinkProps } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { AppLink } from "@/components/app-link";

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
      className="border-t border-border/70 py-4"
      data-overview-module={label}
    >
      <h3
        className="text-sm font-medium text-muted-foreground"
        id={`overview-summary-${slug(label)}-heading`}
      >
        {label}
      </h3>
      <p className="mt-1 text-base/relaxed font-medium text-pretty">
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
    <div className="border-y border-border/70 py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3
          className="text-base font-medium"
          id="overview-project-areas-heading"
        >
          Project areas
        </h3>
        <p className="text-xs text-muted-foreground">
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
        <p className="mt-4 text-sm text-muted-foreground">
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
        className="block rounded-md border border-border/80 bg-background/70 px-3 py-2 text-sm underline-offset-4 hover:border-foreground/30 hover:bg-muted hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
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
      className="flex min-h-0 flex-col border-t border-border/70 pt-4"
      data-overview-module={module.name}
      id={moduleId}
    >
      <header className="flex items-baseline justify-between gap-3 border-b pb-2">
        <h3 className="text-base font-medium" id={`${moduleId}-heading`}>
          {module.sourceHref ? (
            <AppLink
              aria-label={`${OPEN_SOURCE_RECORD_LABEL}: ${module.name}`}
              className="underline-offset-4 hover:underline focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
              href={module.sourceHref}
            >
              {module.name}
            </AppLink>
          ) : (
            module.name
          )}
        </h3>
        {records.length > 0 ? (
          <ModuleSourceCount module={module} recordCount={records.length} />
        ) : null}
      </header>

      {records.length > 0 ? (
        <VirtualList
          aria-label={`${module.name} source records`}
          className="mt-2 divide-y"
          estimateSize={40}
          gap={8}
          getKey={virtualRowId}
          rows={records}
        >
          {(record, rowProps) => (
            <SourceRecord
              formattingPreferences={formattingPreferences}
              moduleName={module.name}
              record={record}
              rowProps={rowProps}
            />
          )}
        </VirtualList>
      ) : (
        <p className="mt-3 pb-1 text-sm/relaxed text-muted-foreground">
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
      <AppLink
        aria-label={`${OPEN_SOURCE_RECORD_LABEL}: ${module.name} (${countLabel})`}
        className="text-xs text-muted-foreground underline-offset-4 hover:underline focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
        href={module.sourceHref}
      >
        {countLabel}
      </AppLink>
    );
  }

  return <span className="text-xs text-muted-foreground">{countLabel}</span>;
}

function SourceRecord({
  formattingPreferences,
  moduleName,
  record,
  rowProps,
}: {
  formattingPreferences: OverviewFormattingPreferences;
  moduleName: ProjectOverviewModuleName;
  record: ProjectOverviewSourceRecord;
  rowProps?: VirtualRowProps;
}) {
  const dateValue = record.targetDate ?? record.updatedAt;

  return (
    <li
      {...rowProps}
      className="py-3 first:pt-3 last:pb-1"
      data-overview-record={record.id}
      data-overview-stage={moduleName === "Stages" ? record.id : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {record.type ? (
            <p className="text-[0.68rem] tracking-[0.12em] text-muted-foreground uppercase">
              {record.type}
            </p>
          ) : null}
          <p className="mt-1 text-sm font-medium text-pretty">{record.title}</p>
          {record.description ? (
            <p className="mt-1 text-xs/relaxed text-muted-foreground">
              {record.description}
            </p>
          ) : null}
          {record.status ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {record.status}
            </p>
          ) : null}
          {dateValue ? (
            <time
              className="mt-2 block text-xs text-muted-foreground"
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
          <AppLink
            className="inline-flex shrink-0 items-center gap-1 text-xs text-primary underline-offset-4 hover:underline focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
            href={record.href}
          >
            {OPEN_SOURCE_RECORD_LABEL}
            <ArrowUpRight aria-hidden="true" className="size-3" />
            <span className="sr-only">{record.title}</span>
          </AppLink>
        ) : null}
      </div>
      <span className="sr-only">{moduleName}</span>
    </li>
  );
}
