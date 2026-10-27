import type { ProjectUpdateSnapshot } from "@cantiara/api/project-updates";

/**
 * The summary blocks of a Project at one moment: shown live above the form and,
 * frozen, inside a saved Project Update. It only lists what the blocks held; it
 * states no health of the Project.
 */
export function ProjectUpdateSummary({
  snapshot,
}: {
  snapshot: ProjectUpdateSnapshot;
}) {
  return (
    <div className="space-y-3 text-sm">
      <dl className="grid gap-1 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-x-4">
        <dt className="text-muted-foreground">Lifecycle</dt>
        <dd>{snapshot.lifecycle}</dd>
        {snapshot.purpose ? (
          <>
            <dt className="text-muted-foreground">Purpose</dt>
            <dd className="break-words">{snapshot.purpose}</dd>
          </>
        ) : null}
        {snapshot.targetDate ? (
          <>
            <dt className="text-muted-foreground">Target date</dt>
            <dd>{snapshot.targetDate}</dd>
          </>
        ) : null}
      </dl>
      {snapshot.blocks.map((block) => (
        <section aria-label={block.name} key={block.name}>
          <h4 className="font-medium">
            {block.name}{" "}
            <span className="text-muted-foreground">
              ({block.records.length})
            </span>
          </h4>
          {block.records.length ? (
            <ul className="list-disc pl-5">
              {block.records.map((record) => (
                <li className="break-words" key={record.id}>
                  {record.title}
                  {record.status ? (
                    <span className="text-muted-foreground">
                      {" "}
                      · {record.status}
                    </span>
                  ) : null}
                  {record.targetDate ? (
                    <span className="text-muted-foreground">
                      {" "}
                      · {record.targetDate}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">None</p>
          )}
        </section>
      ))}
    </div>
  );
}
