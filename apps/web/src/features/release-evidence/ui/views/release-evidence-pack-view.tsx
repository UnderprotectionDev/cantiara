// biome-ignore-all lint/performance/noJsxPropsBind: Handlers bind to one checklist item.
import {
  RELEASE_EVIDENCE_NOTE,
  RELEASE_EVIDENCE_OPEN_SOURCE_LABEL,
  RELEASE_EVIDENCE_PACK_LABEL,
  type ReleaseEvidencePack,
  type ReleaseEvidenceRow,
  type ReleaseEvidenceSourceRef,
  type ReleaseOpenScopeSignal,
} from "@cantiara/api/release-evidence";
import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import { AppLink } from "@/components/app-link";
import { releaseEvidenceSourceHref } from "../../lib/release-evidence-links";
import { AddChecklistItemForm } from "../forms/add-checklist-item-form";

export interface ReleaseEvidencePackActions {
  onAddItem: (text: string) => Promise<unknown>;
  onCloseSignal: () => Promise<unknown>;
  onRemoveItem: (itemId: string) => Promise<unknown>;
  onSetItem: (itemId: string, checked: boolean) => Promise<unknown>;
}

function OpenSource({
  projectId,
  source,
}: {
  projectId: string;
  source: ReleaseEvidenceSourceRef;
}) {
  return (
    <AppLink
      aria-label={`${RELEASE_EVIDENCE_OPEN_SOURCE_LABEL}: ${source.label}`}
      className="underline underline-offset-2"
      href={releaseEvidenceSourceHref(projectId, source)}
    >
      {RELEASE_EVIDENCE_OPEN_SOURCE_LABEL}
    </AppLink>
  );
}

function EvidenceRow({
  projectId,
  row,
}: {
  projectId: string;
  row: ReleaseEvidenceRow;
}) {
  return (
    <li className="space-y-1 rounded-md border border-border/60 p-3">
      <p className="font-medium">
        {row.title}
        {row.state ? (
          <span className="text-muted-foreground">{` · ${row.state}`}</span>
        ) : null}
      </p>
      <p className="text-muted-foreground text-sm">{row.why}</p>
      {row.details.length > 0 ? (
        <dl className="grid gap-x-3 text-sm sm:grid-cols-[max-content_1fr]">
          {row.details.map((detail) => (
            <div className="contents" key={detail.label}>
              <dt className="font-medium">{detail.label}</dt>
              <dd className="text-muted-foreground">{detail.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <OpenSource projectId={projectId} source={row.source} />
    </li>
  );
}

function ChecklistRows({
  actions,
  pack,
  readOnly,
}: {
  actions: ReleaseEvidencePackActions;
  pack: ReleaseEvidencePack;
  readOnly: boolean;
}) {
  return (
    <div className="space-y-3">
      {pack.checklist.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No checklist items. The checklist is optional and never gates publish.
        </p>
      ) : (
        <ul className="space-y-1">
          {pack.checklist.map((item) => (
            <li className="flex items-center gap-2" key={item.id}>
              <Checkbox
                checked={item.checked}
                disabled={readOnly}
                id={`release-checklist-${item.id}`}
                onCheckedChange={(checked) => {
                  actions.onSetItem(item.id, checked).catch(() => undefined);
                }}
              />
              <label htmlFor={`release-checklist-${item.id}`}>
                {item.text}
              </label>
              <Button
                aria-label={`Remove checklist item: ${item.text}`}
                disabled={readOnly}
                onClick={() => {
                  actions.onRemoveItem(item.id).catch(() => undefined);
                }}
                type="button"
                variant="ghost"
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
      <AddChecklistItemForm disabled={readOnly} onAdd={actions.onAddItem} />
    </div>
  );
}

/**
 * The `Release Evidence Pack`: a read-only evaluation view. Every row shows why
 * it is there and opens its source with `Open source record`; nothing on the
 * pack edits a source field, shows a score or verdict, or publishes. Only the
 * founder's optional checklist and the signal close are written here.
 */
export function ReleaseEvidencePackView({
  actions,
  pack,
  projectId,
  signal,
}: {
  actions: ReleaseEvidencePackActions;
  pack: ReleaseEvidencePack;
  projectId: string;
  signal: ReleaseOpenScopeSignal | null;
}) {
  const headingId = `release-evidence-${pack.release.id}`;
  return (
    <section aria-labelledby={headingId} className="space-y-5">
      <header className="space-y-1">
        <h3 className="font-semibold text-xl" id={headingId}>
          {RELEASE_EVIDENCE_PACK_LABEL}
        </h3>
        <p className="text-muted-foreground text-sm">{RELEASE_EVIDENCE_NOTE}</p>
      </header>
      {signal && !signal.closed ? (
        <div
          className="space-y-2 rounded-md border border-border/70 p-3"
          role="status"
        >
          <p>
            {`This Project Release is Published and ${signal.openWork.length} Work ${signal.openWork.length === 1 ? "item is" : "items are"} still open in its scope. This does not change any status.`}
          </p>
          <Button
            onClick={() => {
              actions.onCloseSignal().catch(() => undefined);
            }}
            type="button"
            variant="outline"
          >
            Close signal
          </Button>
        </div>
      ) : null}
      <section aria-labelledby={`${headingId}-attention`} className="space-y-2">
        <h4 className="font-medium" id={`${headingId}-attention`}>
          {`Attention (${pack.attention.length})`}
        </h4>
        {pack.attention.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No source needs attention. This is not a verdict.
          </p>
        ) : (
          <ul className="space-y-2">
            {pack.attention.map((row) => (
              <li
                className="space-y-1 rounded-md border border-border/60 p-3"
                key={row.rowId}
              >
                <p className="font-medium">{row.title}</p>
                <p className="text-muted-foreground text-sm">
                  {`${row.section}: ${row.why}`}
                </p>
                <OpenSource projectId={projectId} source={row.source} />
              </li>
            ))}
          </ul>
        )}
      </section>
      {pack.sections.map((section) => {
        const id = `${headingId}-${section.section.toLowerCase().replaceAll(" ", "-")}`;
        return (
          <section
            aria-labelledby={id}
            className="space-y-2"
            key={section.section}
          >
            <h4 className="font-medium" id={id}>
              {`${section.section} (${section.count})`}
            </h4>
            {section.unavailableReason ? (
              <p className="text-muted-foreground text-sm" role="status">
                {`Source unavailable: ${section.unavailableReason}`}
              </p>
            ) : null}
            {section.section === "Checklist" ? (
              <ChecklistRows
                actions={actions}
                pack={pack}
                readOnly={pack.readOnly}
              />
            ) : (
              <>
                {section.rows.length === 0 && !section.unavailableReason ? (
                  <p className="text-muted-foreground text-sm">
                    Nothing is related to this Project Release here.
                  </p>
                ) : null}
                <ul className="space-y-2">
                  {section.rows.map((row) => (
                    <EvidenceRow
                      key={row.rowId}
                      projectId={projectId}
                      row={row}
                    />
                  ))}
                </ul>
              </>
            )}
          </section>
        );
      })}
    </section>
  );
}
