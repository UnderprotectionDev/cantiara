import {
  type DocumentEvidenceForTarget,
  groupEvidenceByRole,
} from "@cantiara/api/document-evidence";

/** Target-side surface: groups by stored Evidence Role; each count opens its exact accessible set. */
export default function EvidenceRoleGroups({
  items,
}: {
  items: DocumentEvidenceForTarget[];
}) {
  const { groups, withheld } = groupEvidenceByRole(items);
  if (!items.length) {
    return null;
  }
  return (
    <section aria-label="Evidence by Evidence Role" className="space-y-2">
      <h4 className="font-medium">Evidence Role</h4>
      {groups.map((group) => (
        <details key={group.role}>
          <summary>
            {group.role} ({group.items.length})
          </summary>
          <ul className="space-y-1">
            {group.items.map((item) => (
              <li key={item.id}>
                <p>{item.source.title ?? "Unavailable source"}</p>
                {item.pin ? (
                  <p className="whitespace-pre-wrap break-words">
                    Version {item.pin.source.revision} · Range {item.pin.start}–
                    {item.pin.end} · {item.pin.excerpt}
                  </p>
                ) : null}
                {item.interpretation ? (
                  <p className="whitespace-pre-wrap break-words">
                    Founder interpretation: {item.interpretation}
                  </p>
                ) : null}
                {item.source.brokenReason ? (
                  <p>{item.source.brokenReason}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
      ))}
      {withheld ? <p>{withheld} unavailable (role withheld)</p> : null}
    </section>
  );
}
