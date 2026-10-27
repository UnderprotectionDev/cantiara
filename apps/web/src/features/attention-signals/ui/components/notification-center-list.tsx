// biome-ignore-all lint/performance/noJsxPropsBind: Row actions close over the signal they act on.

import type {
  AttentionFollowUpPreview,
  AttentionSignal,
  MarkAttentionSignalInput,
  NotificationCenter,
  OpenAttentionSignalOutput,
} from "@cantiara/api/attention-signals";
import { Button } from "@cantiara/ui/components/button";

function signalState(signal: AttentionSignal) {
  if (signal.closedAt) {
    return "Closed";
  }
  return signal.readAt ? "Read" : "Unread";
}

export interface NotificationCenterActions {
  onCreateFollowUp: (signal: AttentionSignal) => void;
  onMark: (
    signal: AttentionSignal,
    mark: MarkAttentionSignalInput["mark"],
  ) => void;
  onOpen: (signal: AttentionSignal) => void;
  onPreviewFollowUp: (signal: AttentionSignal) => void;
}

export interface NotificationCenterPanels {
  opened: { output: OpenAttentionSignalOutput; signalRowId: string } | null;
  preview: AttentionFollowUpPreview | null;
}

function OpenedPanel({
  opened,
}: {
  opened: NonNullable<NotificationCenterPanels["opened"]>;
}) {
  const { output } = opened;
  if (output.outcome === "event") {
    return (
      <p className="text-sm" role="status">
        Opened event {output.eventId} on {output.group.kind} {output.group.id}.
      </p>
    );
  }
  return (
    <p className="text-sm" role="status">
      {output.explanation}
    </p>
  );
}

function PreviewPanel({
  onCreate,
  preview,
  signal,
}: {
  onCreate: (signal: AttentionSignal) => void;
  preview: AttentionFollowUpPreview;
  signal: AttentionSignal;
}) {
  return (
    <section
      aria-label="Create Follow-up Work preview"
      className="grid gap-1 rounded border p-2 text-sm"
    >
      <p>
        New {preview.work.type}: <strong>{preview.work.title}</strong>
      </p>
      <ul>
        {preview.relations.map((relation) => (
          <li key={`${relation.kind}:${relation.id}`}>
            {relation.relation}: {relation.kind} {relation.id}
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground">
        The notification stays open and the source is not changed.
      </p>
      <Button onClick={() => onCreate(signal)} size="sm" type="button">
        Create Follow-up Work
      </Button>
    </section>
  );
}

function SignalRow({
  actions,
  panels,
  signal,
}: {
  actions?: NotificationCenterActions;
  panels: NotificationCenterPanels;
  signal: AttentionSignal;
}) {
  return (
    <li className="grid gap-1 text-sm">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <code>{signal.signalId}</code>
        <span>{signal.reason}</span>
        <time className="text-muted-foreground" dateTime={signal.occurredAt}>
          {signal.occurredAt}
        </time>
        <span className="text-muted-foreground">{signalState(signal)}</span>
      </div>
      {actions ? (
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => actions.onOpen(signal)}
            size="sm"
            type="button"
            variant="outline"
          >
            Open source
          </Button>
          <Button
            onClick={() =>
              actions.onMark(signal, signal.readAt ? "unread" : "read")
            }
            size="sm"
            type="button"
            variant="outline"
          >
            {signal.readAt ? "Mark unread" : "Mark read"}
          </Button>
          <Button
            onClick={() =>
              actions.onMark(signal, signal.closedAt ? "reopened" : "closed")
            }
            size="sm"
            type="button"
            variant="outline"
          >
            {signal.closedAt ? "Reopen" : "Close"}
          </Button>
          <Button
            onClick={() => actions.onPreviewFollowUp(signal)}
            size="sm"
            type="button"
            variant="outline"
          >
            Preview Follow-up Work
          </Button>
        </div>
      ) : null}
      {panels.opened?.signalRowId === signal.id ? (
        <OpenedPanel opened={panels.opened} />
      ) : null}
      {actions && panels.preview?.signalRowId === signal.id ? (
        <PreviewPanel
          onCreate={actions.onCreateFollowUp}
          preview={panels.preview}
          signal={signal}
        />
      ) : null}
    </li>
  );
}

function SectionView({
  actions,
  panels,
  section,
}: {
  actions?: NotificationCenterActions;
  panels: NotificationCenterPanels;
  section: NotificationCenter["sections"][number];
}) {
  const count = section.groups.reduce(
    (total, group) => total + group.signals.length,
    0,
  );
  return (
    <details className="rounded-md border" open={section.defaultOpen}>
      <summary className="cursor-pointer px-3 py-2 font-medium">
        {section.section} ({count})
      </summary>
      {section.groups.length === 0 ? (
        <p className="px-3 pb-3 text-muted-foreground text-sm">
          No signals in {section.section}.
        </p>
      ) : (
        <ul className="grid gap-3 px-3 pb-3">
          {section.groups.map((group) => (
            <li key={group.key}>
              <h3 className="font-medium text-sm">
                {group.group.kind} {group.group.id}
              </h3>
              <ul className="mt-1 grid gap-2">
                {group.signals.map((signal) => (
                  <SignalRow
                    actions={actions}
                    key={signal.id}
                    panels={panels}
                    signal={signal}
                  />
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}

export default function NotificationCenterList({
  actions,
  center,
  panels = { opened: null, preview: null },
}: {
  actions?: NotificationCenterActions;
  center: NotificationCenter;
  panels?: NotificationCenterPanels;
}) {
  return (
    <div className="grid gap-4">
      {center.sections.map((section) => (
        <SectionView
          actions={actions}
          key={section.section}
          panels={panels}
          section={section}
        />
      ))}
      <p className="text-muted-foreground text-xs">
        Notification Center shows registered signals only; it does not claim to
        show everything that needs attention.
      </p>
    </div>
  );
}
