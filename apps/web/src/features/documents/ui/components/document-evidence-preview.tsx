import type { DocumentEvidencePlan } from "@cantiara/api/document-evidence";

export function EvidencePreview({ plan }: { plan: DocumentEvidencePlan }) {
  const newFields = Object.entries(plan.fields).filter(
    ([, value]) => value !== null,
  );
  return (
    <section aria-label="Evidence preview" className="space-y-1">
      <p>
        {plan.mode === "create" ? "New record" : "Existing record"} ·{" "}
        {(plan.newRecord ?? plan.target)?.type}: {plan.targetTitle}
      </p>
      <p>
        Document · Version {plan.pin.source.revision} · Range {plan.pin.start}–
        {plan.pin.end}
      </p>
      <p className="break-words whitespace-pre-wrap">{plan.pin.excerpt}</p>
      {plan.mode === "create" ? (
        <dl>
          {newFields.map(([name, value]) => (
            <div key={name}>
              <dt className="font-medium">{name}</dt>
              <dd className="break-words whitespace-pre-wrap">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <p>Evidence Role: Unspecified. The source text stays in place.</p>
    </section>
  );
}
