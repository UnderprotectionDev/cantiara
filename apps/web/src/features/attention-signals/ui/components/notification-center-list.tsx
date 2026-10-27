import type {
  AttentionSignal,
  NotificationCenter,
} from "@cantiara/api/attention-signals";

function signalState(signal: AttentionSignal) {
  if (signal.closedAt) {
    return "Closed";
  }
  return signal.readAt ? "Read" : "Unread";
}

export default function NotificationCenterList({
  center,
}: {
  center: NotificationCenter;
}) {
  return (
    <div className="grid gap-4">
      {center.sections.map((section) => {
        const count = section.groups.reduce(
          (total, group) => total + group.signals.length,
          0,
        );
        return (
          <details
            className="rounded-md border"
            key={section.section}
            open={section.defaultOpen}
          >
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
                    <ul className="mt-1 grid gap-1">
                      {group.signals.map((signal) => (
                        <li
                          className="flex flex-wrap items-baseline gap-x-2 text-sm"
                          key={signal.id}
                        >
                          <code>{signal.signalId}</code>
                          <span>{signal.reason}</span>
                          <time
                            className="text-muted-foreground"
                            dateTime={signal.occurredAt}
                          >
                            {signal.occurredAt}
                          </time>
                          <span className="text-muted-foreground">
                            {signalState(signal)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </details>
        );
      })}
      <p className="text-muted-foreground text-xs">
        Notification Center shows registered signals only; it does not claim to
        show everything that needs attention.
      </p>
    </div>
  );
}
