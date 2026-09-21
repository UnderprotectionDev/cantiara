// biome-ignore-all lint/performance/noJsxPropsBind: Overview controls close over current module and source state.
import type { AccountPreferences } from "@cantiara/api/account-preferences";
import { DEFAULT_ACCOUNT_PREFERENCES } from "@cantiara/api/account-preferences";
import type {
  WorkspaceOverviewLayout,
  WorkspaceOverviewLiveBlock,
  WorkspaceOverviewLiveBlockSource,
  WorkspaceOverviewModel,
  WorkspaceOverviewModule,
  WorkspaceOverviewModuleId,
  WorkspaceOverviewPresentation,
  WorkspaceOverviewSourceRecord,
} from "@cantiara/api/workspace-overview";
import {
  moveWorkspaceOverviewModule,
  normalizeWorkspaceOverviewLayout,
  setWorkspaceOverviewModuleVisibility,
  WORKSPACE_OVERVIEW_CONFIGURATION_VERSION,
} from "@cantiara/api/workspace-overview";
import { Button, buttonVariants } from "@cantiara/ui/components/button";
import { cn } from "@cantiara/ui/lib/utils";
import { ChevronDown, ChevronUp, Eye, EyeOff, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";

import {
  formatAccountDate,
  formatAccountDateTime,
} from "@/features/account-preferences/lib/account-preferences-format";

const MAX_LIVE_BLOCKS = 4;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const moduleAccentClasses: Record<WorkspaceOverviewModuleId, string> = {
  "active-projects": "border-l-sky-500",
  "attention-required": "border-l-amber-500",
  "recent-work": "border-l-violet-500",
  upcoming: "border-l-emerald-500",
};

function sourceCountLabel(count: number) {
  return `${count} ${count === 1 ? "source record" : "source records"}`;
}

function formatSourceDate(value: string, preferences: AccountPreferences) {
  try {
    return DATE_ONLY_PATTERN.test(value)
      ? formatAccountDate(value, preferences)
      : formatAccountDateTime(value, preferences);
  } catch {
    return value;
  }
}

function sourceMeta(
  record: WorkspaceOverviewSourceRecord,
  formattingPreferences: AccountPreferences,
) {
  return [
    record.type,
    record.projectName,
    record.status,
    record.targetDate
      ? formatSourceDate(record.targetDate, formattingPreferences)
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function sourceRecordList(
  records: readonly WorkspaceOverviewSourceRecord[],
  emptyMessage = "No source records yet.",
  formattingPreferences: AccountPreferences = DEFAULT_ACCOUNT_PREFERENCES,
) {
  if (records.length === 0) {
    return (
      <p className="px-5 py-8 text-muted-foreground text-sm">{emptyMessage}</p>
    );
  }

  return (
    <ul className="divide-y divide-border/70">
      {records.map((record) => (
        <li className="flex gap-4 px-5 py-4" key={record.id}>
          <div className="min-w-0 flex-1">
            <a
              className="font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
              href={record.href}
            >
              {record.title}
            </a>
            <p className="mt-1 text-muted-foreground text-xs">
              {sourceMeta(record, formattingPreferences)}
            </p>
          </div>
          <a
            aria-label={`Open source record: ${record.title}`}
            className="shrink-0 self-start text-muted-foreground text-xs underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
            href={record.href}
          >
            Open source record
          </a>
        </li>
      ))}
    </ul>
  );
}

function OverviewModuleCard({
  formattingPreferences,
  module,
}: {
  formattingPreferences: AccountPreferences;
  module: WorkspaceOverviewModule;
}) {
  const countLabel = sourceCountLabel(module.records.length);

  return (
    <section
      aria-labelledby={`workspace-overview-module-${module.id}`}
      className={cn(
        "overflow-hidden rounded-lg border border-border/70 border-l-4 bg-card/55",
        moduleAccentClasses[module.id],
      )}
      data-workspace-overview-module={module.id}
    >
      <header className="flex items-start justify-between gap-4 px-5 py-5">
        <div className="min-w-0">
          <h3 id={`workspace-overview-module-${module.id}`}>
            <a
              className="font-semibold text-lg tracking-tight underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
              href={module.sourceHref}
            >
              {module.name}
            </a>
          </h3>
          <p className="mt-1 text-muted-foreground text-xs">
            Source-backed · {countLabel}
          </p>
        </div>
        <a
          aria-label={`Open source record: ${module.name} (${countLabel})`}
          className={buttonVariants({ size: "xs", variant: "outline" })}
          href={module.sourceHref}
        >
          {module.records.length}
        </a>
      </header>
      {sourceRecordList(
        module.records,
        module.id === "active-projects" ? "No Active Projects yet." : undefined,
        formattingPreferences,
      )}
    </section>
  );
}

function LayoutControls({
  layout,
  modules,
  onChange,
}: {
  layout: WorkspaceOverviewLayout;
  modules: readonly WorkspaceOverviewModule[];
  onChange: (layout: WorkspaceOverviewLayout) => void;
}) {
  const moduleById = new Map(modules.map((module) => [module.id, module]));

  return (
    <section
      aria-labelledby="workspace-overview-layout-heading"
      className="rounded-lg border border-border/70 bg-muted/20 px-4 py-4"
      data-workspace-overview-layout="true"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            className="font-medium text-sm"
            id="workspace-overview-layout-heading"
          >
            Arrange modules
          </h2>
          <p className="mt-1 text-muted-foreground text-xs/5">
            Presentation only. Hiding a module never removes its source records.
          </p>
        </div>
        <Eye
          aria-hidden="true"
          className="mt-0.5 size-4 text-muted-foreground"
        />
      </div>

      <ul className="mt-4 divide-y divide-border/70 border-border/70 border-y">
        {layout.order.map((moduleId, index) => {
          const module = moduleById.get(moduleId);
          if (!module) {
            return null;
          }
          const hidden = layout.hidden.includes(moduleId);

          return (
            <li
              className="flex flex-wrap items-center justify-between gap-3 py-2.5"
              data-workspace-overview-layout-item={module.id}
              key={module.id}
            >
              <span
                className={cn("text-sm", hidden && "text-muted-foreground")}
              >
                {module.name}
                {hidden ? " · hidden" : null}
              </span>
              <div className="flex flex-wrap gap-1">
                <Button
                  aria-label={`Move ${module.name} up`}
                  disabled={index === 0}
                  onClick={() =>
                    onChange(
                      moveWorkspaceOverviewModule(layout, moduleId, "up"),
                    )
                  }
                  size="icon-xs"
                  type="button"
                  variant="ghost"
                >
                  <ChevronUp aria-hidden="true" />
                </Button>
                <Button
                  aria-label={`Move ${module.name} down`}
                  disabled={index === layout.order.length - 1}
                  onClick={() =>
                    onChange(
                      moveWorkspaceOverviewModule(layout, moduleId, "down"),
                    )
                  }
                  size="icon-xs"
                  type="button"
                  variant="ghost"
                >
                  <ChevronDown aria-hidden="true" />
                </Button>
                <Button
                  aria-label={`${hidden ? "Show" : "Hide"} ${module.name}`}
                  onClick={() =>
                    onChange(
                      setWorkspaceOverviewModuleVisibility(
                        layout,
                        moduleId,
                        hidden,
                      ),
                    )
                  }
                  size="xs"
                  type="button"
                  variant="outline"
                >
                  {hidden ? (
                    <Eye aria-hidden="true" />
                  ) : (
                    <EyeOff aria-hidden="true" />
                  )}
                  {hidden ? "Show" : "Hide"}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function LiveBlockCard({
  block,
  onRemove,
}: {
  block: WorkspaceOverviewLiveBlock;
  onRemove: () => void;
}) {
  return (
    <article
      className="rounded-lg border border-border/70 bg-card/55 px-5 py-4"
      data-live-block-reference="true"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <a
            className="font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
            href={block.href}
          >
            {block.title}
          </a>
          <p className="mt-1 text-muted-foreground text-xs">{block.type}</p>
        </div>
        <Button
          aria-label={`Remove live block: ${block.title}`}
          onClick={onRemove}
          size="icon-xs"
          type="button"
          variant="ghost"
        >
          <X aria-hidden="true" />
        </Button>
      </div>
      <a
        aria-label={`Open source record: ${block.title}`}
        className="mt-3 inline-flex text-muted-foreground text-xs underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
        href={block.href}
      >
        Open source record
      </a>
    </article>
  );
}

function liveBlockSourceKey(source: WorkspaceOverviewLiveBlockSource) {
  return `${source.recordType}:${source.recordId}:${source.viewId ?? ""}`;
}

function LiveBlocks({
  model,
  onChange,
}: {
  model: WorkspaceOverviewModel;
  onChange: (sources: readonly WorkspaceOverviewLiveBlockSource[]) => void;
}) {
  const allBlocks = useMemo(() => {
    const blocks = new Map<string, WorkspaceOverviewLiveBlock>();
    for (const block of [...model.liveBlocks, ...model.availableLiveBlocks]) {
      blocks.set(liveBlockSourceKey(block.source), block);
    }
    return blocks;
  }, [model.availableLiveBlocks, model.liveBlocks]);
  const [selectedSources, setSelectedSources] = useState(() =>
    model.liveBlockSources.map((source) => ({ ...source })),
  );
  const [choice, setChoice] = useState("");
  const selectedBlocks = selectedSources
    .map((source) => allBlocks.get(liveBlockSourceKey(source)))
    .filter((block): block is WorkspaceOverviewLiveBlock => Boolean(block));
  const addableBlocks = model.availableLiveBlocks.filter(
    (block) =>
      !selectedSources.some(
        (source) =>
          liveBlockSourceKey(source) === liveBlockSourceKey(block.source),
      ),
  );

  function updateSelectedSources(
    nextSources: readonly WorkspaceOverviewLiveBlockSource[],
  ) {
    setSelectedSources(nextSources.map((source) => ({ ...source })));
    onChange(nextSources);
  }

  return (
    <section
      aria-labelledby="workspace-overview-live-blocks-heading"
      className="space-y-4 border-border/70 border-t pt-8"
      data-workspace-overview-live-blocks="true"
    >
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2
            className="font-semibold text-xl tracking-tight"
            id="workspace-overview-live-blocks-heading"
          >
            Live blocks
          </h2>
          <p className="mt-2 max-w-2xl text-muted-foreground text-sm/6">
            Pin an existing Document or named Smart Collection view as a
            reference. The source stays authoritative and changes appear here.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label
            className="grid gap-1 text-muted-foreground text-xs"
            htmlFor="workspace-overview-live-block-source"
          >
            Existing source
            <select
              aria-label="Live block source"
              className="h-8 min-w-52 rounded-md border border-border/80 bg-background px-2 text-foreground text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
              disabled={
                addableBlocks.length === 0 ||
                selectedSources.length >= MAX_LIVE_BLOCKS
              }
              id="workspace-overview-live-block-source"
              onChange={(event) => setChoice(event.target.value)}
              value={choice}
            >
              <option value="">
                {addableBlocks.length === 0
                  ? "No existing source records"
                  : "Choose a source"}
              </option>
              {addableBlocks.map((block) => (
                <option
                  key={liveBlockSourceKey(block.source)}
                  value={liveBlockSourceKey(block.source)}
                >
                  {block.title} · {block.type}
                </option>
              ))}
            </select>
          </label>
          <Button
            disabled={!choice || selectedSources.length >= MAX_LIVE_BLOCKS}
            onClick={() => {
              const block = allBlocks.get(choice);
              if (!block || selectedSources.length >= MAX_LIVE_BLOCKS) {
                return;
              }
              updateSelectedSources([...selectedSources, { ...block.source }]);
              setChoice("");
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            <Plus aria-hidden="true" />
            Add live block
          </Button>
        </div>
      </header>

      {selectedBlocks.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {selectedBlocks.map((block) => (
            <LiveBlockCard
              block={block}
              key={block.id}
              onRemove={() =>
                updateSelectedSources(
                  selectedSources.filter(
                    (source) =>
                      liveBlockSourceKey(source) !==
                      liveBlockSourceKey(block.source),
                  ),
                )
              }
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-border/80 border-dashed bg-muted/15 px-5 py-6 text-muted-foreground text-sm">
          No existing Documents or named Smart Collection views are available
          yet.
        </div>
      )}
    </section>
  );
}

function SelectedSourceSet({
  formattingPreferences,
  module,
}: {
  formattingPreferences: AccountPreferences;
  module: WorkspaceOverviewModule;
}) {
  return (
    <section
      aria-labelledby="workspace-overview-source-set-heading"
      className="overflow-hidden rounded-lg border border-border/70 bg-muted/15"
      data-workspace-overview-source-set={module.id}
    >
      <header className="border-border/70 border-b px-5 py-4">
        <h2
          className="font-medium text-sm"
          id="workspace-overview-source-set-heading"
        >
          {module.name} source set
        </h2>
        <p className="mt-1 text-muted-foreground text-xs">
          Exact source records · {sourceCountLabel(module.records.length)}
        </p>
      </header>
      {sourceRecordList(
        module.records,
        module.id === "active-projects" ? "No Active Projects yet." : undefined,
        formattingPreferences,
      )}
    </section>
  );
}

export interface WorkspaceOverviewViewProps {
  formattingPreferences?: AccountPreferences;
  model: WorkspaceOverviewModel;
  onPresentationChange?: (presentation: WorkspaceOverviewPresentation) => void;
  selectedModule?: WorkspaceOverviewModuleId;
}

export default function WorkspaceOverviewView({
  formattingPreferences = DEFAULT_ACCOUNT_PREFERENCES,
  model,
  onPresentationChange,
  selectedModule,
}: WorkspaceOverviewViewProps) {
  const [layout, setLayout] = useState<WorkspaceOverviewLayout>(() =>
    normalizeWorkspaceOverviewLayout(model.layout),
  );
  const [liveBlockSources, setLiveBlockSources] = useState(() =>
    model.liveBlockSources.map((source) => ({ ...source })),
  );
  const moduleById = new Map(
    model.modules.map((module) => [module.id, module]),
  );
  const selectedSourceModule = selectedModule
    ? moduleById.get(selectedModule)
    : undefined;
  const visibleModules = layout.order
    .filter((moduleId) => !layout.hidden.includes(moduleId))
    .map((moduleId) => moduleById.get(moduleId))
    .filter((module): module is WorkspaceOverviewModule => Boolean(module));

  function changeLayout(nextLayout: WorkspaceOverviewLayout) {
    setLayout(nextLayout);
    onPresentationChange?.({
      layout: nextLayout,
      liveBlockSources,
      version: WORKSPACE_OVERVIEW_CONFIGURATION_VERSION,
    });
  }

  function changeLiveBlockSources(
    nextSources: readonly WorkspaceOverviewLiveBlockSource[],
  ) {
    const normalizedSources = nextSources.map((source) => ({ ...source }));
    setLiveBlockSources(normalizedSources);
    onPresentationChange?.({
      layout,
      liveBlockSources: normalizedSources,
      version: WORKSPACE_OVERVIEW_CONFIGURATION_VERSION,
    });
  }

  return (
    <section
      aria-labelledby="workspace-overview-heading"
      className="space-y-8"
      data-workspace-overview="true"
      id="workspace-overview"
    >
      <header className="surface-header max-w-3xl">
        <p className="font-medium text-muted-foreground text-xs uppercase tracking-[0.18em]">
          Workspace horizon
        </p>
        <h2
          className="mt-2 text-balance font-semibold text-3xl tracking-tight sm:text-4xl"
          id="workspace-overview-heading"
        >
          Workspace overview
        </h2>
        <p className="mt-3 max-w-2xl text-pretty text-muted-foreground text-sm/6">
          A source-backed view of the Projects and Work that need your attention
          next. Every count stays connected to its source records.
        </p>
      </header>

      {selectedSourceModule ? (
        <SelectedSourceSet
          formattingPreferences={formattingPreferences}
          module={selectedSourceModule}
        />
      ) : null}

      {selectedSourceModule ? null : (
        <>
          <LayoutControls
            layout={layout}
            modules={model.modules}
            onChange={changeLayout}
          />

          {visibleModules.length > 0 ? (
            <div className="grid items-start gap-4 lg:grid-cols-2">
              {visibleModules.map((module) => (
                <OverviewModuleCard
                  formattingPreferences={formattingPreferences}
                  key={module.id}
                  module={module}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-border/80 border-dashed bg-muted/15 px-5 py-8 text-muted-foreground text-sm">
              All modules are hidden. Use Show to bring a source module back.
            </div>
          )}

          <LiveBlocks model={model} onChange={changeLiveBlockSources} />
        </>
      )}
    </section>
  );
}
