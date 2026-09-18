import {
  type AccountPreferences,
  DEFAULT_ACCOUNT_PREFERENCES,
} from "@cantiara/api/account-preferences";
import {
  buildProjectOverview,
  type ProjectOverviewModel,
  type ProjectOverviewModule,
  type ProjectOverviewSourceRecord,
  type ProjectOverviewSources,
} from "@cantiara/api/project-overview";
import type { ProjectProfile } from "@cantiara/api/project-shell";
import { ArrowUpRight } from "lucide-react";

type OverviewFormattingPreferences = Pick<
  AccountPreferences,
  "locale" | "timeZone"
>;

const DEFAULT_OVERVIEW_FORMATTING_PREFERENCES = {
  locale: DEFAULT_ACCOUNT_PREFERENCES.locale,
  timeZone: DEFAULT_ACCOUNT_PREFERENCES.timeZone,
} satisfies OverviewFormattingPreferences;

const EMPTY_SOURCE_MESSAGE = "No source records yet.";
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface ProjectOverviewViewProps {
  accountFormattingPreferences?: OverviewFormattingPreferences;
  project: ProjectProfile;
  sources?: ProjectOverviewSources;
}

export default function ProjectOverviewView({
  accountFormattingPreferences = DEFAULT_OVERVIEW_FORMATTING_PREFERENCES,
  project,
  sources = {},
}: ProjectOverviewViewProps) {
  const overview = buildProjectOverview(project, sources);
  const formattingPreferences = normalizeFormattingPreferences(
    accountFormattingPreferences,
  );

  return (
    <section
      aria-labelledby="project-overview-heading"
      className="mt-10 space-y-8"
      data-project-overview="true"
      id="overview"
    >
      <header className="max-w-3xl border-b pb-6">
        <p className="font-medium text-muted-foreground text-xs uppercase tracking-[0.18em]">
          Project Overview
        </p>
        <h2
          className="mt-3 text-balance font-semibold text-2xl tracking-tight sm:text-3xl"
          id="project-overview-heading"
        >
          Overview
        </h2>
        <p className="mt-3 max-w-2xl text-muted-foreground text-sm/relaxed">
          A neutral view of this Project’s source records. Empty sections stay
          empty until a source record exists.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <OverviewSummary
          emptyMessage="No Purpose recorded yet."
          label="Purpose"
          value={overview.purpose}
        />
        <OverviewSummary label="Lifecycle" value={overview.lifecycle} />
      </div>

      <EnabledProjectAreas areas={overview.enabledAreas} />

      <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
        {overview.modules.map((module) => (
          <OverviewModule
            formattingPreferences={formattingPreferences}
            key={module.name}
            module={module}
            overview={overview}
          />
        ))}
      </div>
    </section>
  );
}

function normalizeFormattingPreferences(
  preferences: OverviewFormattingPreferences,
): OverviewFormattingPreferences {
  return {
    locale:
      preferences.locale || DEFAULT_OVERVIEW_FORMATTING_PREFERENCES.locale,
    timeZone:
      preferences.timeZone || DEFAULT_OVERVIEW_FORMATTING_PREFERENCES.timeZone,
  };
}

function OverviewSummary({
  emptyMessage,
  label,
  value,
}: {
  emptyMessage?: string;
  label: string;
  value: string | null;
}) {
  return (
    <section
      aria-labelledby={`overview-summary-${slug(label)}-heading`}
      className="border-primary/60 border-l-2 bg-muted/20 px-5 py-5"
      data-overview-module={label}
    >
      <h3
        className="font-medium text-muted-foreground text-xs uppercase tracking-[0.16em]"
        id={`overview-summary-${slug(label)}-heading`}
      >
        {label}
      </h3>
      <p className="mt-3 text-pretty font-medium text-base/relaxed">
        {value ?? emptyMessage ?? EMPTY_SOURCE_MESSAGE}
      </p>
    </section>
  );
}

function EnabledProjectAreas({ areas }: { areas: readonly string[] }) {
  return (
    <section
      aria-labelledby="overview-project-areas-heading"
      className="border-y py-5"
    >
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
            <li
              className="border bg-background px-3 py-1.5 text-sm"
              data-overview-area={area}
              key={area}
            >
              {area}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-muted-foreground text-sm">
          No Project areas are visible yet.
        </p>
      )}
    </section>
  );
}

function OverviewModule({
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
    <section
      aria-labelledby={`${moduleId}-heading`}
      className="flex min-h-44 flex-col border bg-card/40 p-5"
      data-overview-module={module.name}
      id={moduleId}
    >
      <header className="flex items-baseline justify-between gap-3 border-b pb-3">
        <h3 className="font-medium text-base" id={`${moduleId}-heading`}>
          {module.name}
        </h3>
        {records.length > 0 ? (
          <span className="text-muted-foreground text-xs">
            {records.length} source{" "}
            {records.length === 1 ? "record" : "records"}
          </span>
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
        <p className="mt-5 text-muted-foreground text-sm/relaxed">
          {emptyMessage}
        </p>
      )}
    </section>
  );
}

function moduleRecords(
  module: ProjectOverviewModule,
  overview: ProjectOverviewModel,
): readonly ProjectOverviewSourceRecord[] {
  if (module.name !== "Dates" || !overview.targetDate) {
    return module.records;
  }

  return [
    {
      id: "project-target-date",
      targetDate: overview.targetDate,
      title: "Project target date",
      type: "Target date",
    },
    ...module.records,
  ];
}

function SourceRecord({
  formattingPreferences,
  moduleName,
  record,
}: {
  formattingPreferences: OverviewFormattingPreferences;
  moduleName: string;
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
              {formatOverviewDate(dateValue, formattingPreferences)}
            </time>
          ) : null}
        </div>
        {record.href ? (
          <a
            className="inline-flex shrink-0 items-center gap-1 text-primary text-xs underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            href={record.href}
          >
            Open source record
            <ArrowUpRight aria-hidden="true" className="size-3" />
            <span className="sr-only">{record.title}</span>
          </a>
        ) : null}
      </div>
      <span className="sr-only">{moduleName}</span>
    </li>
  );
}

function emptyModuleMessage(moduleName: ProjectOverviewModule["name"]) {
  if (moduleName === "Work" || moduleName === "Documents") {
    return "No sample content was created.";
  }
  if (moduleName === "Goals") {
    return "No Project Goals recorded yet.";
  }
  if (moduleName === "Stages") {
    return "No active stages recorded yet.";
  }
  return EMPTY_SOURCE_MESSAGE;
}

function formatOverviewDate(
  value: string,
  preferences: OverviewFormattingPreferences,
) {
  const isDateOnly = DATE_ONLY_PATTERN.test(value);
  const date = new Date(isDateOnly ? `${value}T12:00:00.000Z` : value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  try {
    return new Intl.DateTimeFormat(
      preferences.locale,
      isDateOnly
        ? { dateStyle: "medium", timeZone: preferences.timeZone }
        : {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: preferences.timeZone,
          },
    ).format(date);
  } catch {
    return new Intl.DateTimeFormat(
      DEFAULT_OVERVIEW_FORMATTING_PREFERENCES.locale,
      isDateOnly
        ? {
            dateStyle: "medium",
            timeZone: DEFAULT_OVERVIEW_FORMATTING_PREFERENCES.timeZone,
          }
        : {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: DEFAULT_OVERVIEW_FORMATTING_PREFERENCES.timeZone,
          },
    ).format(date);
  }
}

function moduleAnchor(moduleName: string) {
  if (moduleName === "Work" || moduleName === "Documents") {
    return moduleName.toLowerCase();
  }
  return `project-overview-${slug(moduleName)}`;
}

function slug(value: string) {
  return value.toLowerCase().replaceAll(" ", "-");
}
