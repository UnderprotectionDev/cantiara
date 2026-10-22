import type { DocumentTransferPreview } from "@cantiara/api/document-transfer";

export function DocumentTransferPreviewPanel({
  preview,
}: {
  preview: DocumentTransferPreview;
}) {
  return (
    <div aria-live="polite" className="space-y-2 rounded-md border p-3">
      <p>Target scope: {preview.targetLabel}</p>
      <p>Visibility remains account-only. No content becomes public.</p>
      <p>
        Unselected children remain in the source scope and lose a moved parent
        link.
      </p>
      <ul className="list-inside list-disc">
        {preview.documents.map((item) => (
          <li key={item.id}>
            {item.title} — Version {item.revision}
          </li>
        ))}
      </ul>
      {preview.detachedChildren?.length ? (
        <ul className="list-inside list-disc">
          {preview.detachedChildren.map((child) => (
            <li key={child.id}>{child.title}</li>
          ))}
        </ul>
      ) : null}
      {preview.references?.length ? (
        <>
          <p>
            Record references retain their source scope and access requirements:
          </p>
          <p>
            Unavailable references remain broken. Availability can change after
            Preview.
          </p>
          <ul className="list-inside list-disc">
            {preview.references.map((reference) => (
              <li
                key={`${reference.recordType}-${reference.id}-${reference.title}`}
              >
                {reference.recordType}: {reference.title} ·{" "}
                {reference.available
                  ? `Available · ${reference.projectId ? `Project: ${reference.projectId}` : "Personal Wiki"}`
                  : "Unavailable"}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <p>File Attachments</p>
      <ul className="list-inside list-disc">
        {preview.attachments.map((item) => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
      <p>Broken references: {preview.brokenReferences.length}</p>
      <ul>
        {[
          ...new Map(
            preview.brokenReferences.map((item) => [
              `${item.recordId}:${item.label}`,
              item,
            ]),
          ).values(),
        ].map((item) => (
          <li key={`${item.recordId}:${item.label}`}>{item.label}</li>
        ))}
      </ul>
      <p>
        External Surfaces requiring cancellation:{" "}
        {preview.externalSurfaceIds.length}. Cancelled surfaces and snapshots
        stay in their original scope.
      </p>
      {preview.reason ? <p role="alert">{preview.reason}</p> : null}
    </div>
  );
}
