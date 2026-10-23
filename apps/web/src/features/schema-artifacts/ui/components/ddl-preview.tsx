import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

import { SqlOutput } from "./sql-output";
import { StaticValidationStatus } from "./static-validation-status";
import { ViolationList } from "./violation-list";

/** PostgreSQL DDL of one exact Data Model Diagram Version. */
export function DdlPreview({ versionId }: { versionId: string }) {
  const preview = useQuery({
    ...orpc.schemaDdlPreview.queryOptions({ input: { versionId } }),
    // One disposable database run per version; refetch only when it changes.
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
  });
  const { data } = preview;
  if (preview.isPending) {
    return <p>Validating PostgreSQL DDL…</p>;
  }
  if (preview.isError || !data) {
    return <p role="alert">PostgreSQL DDL could not be previewed.</p>;
  }
  if (data.status === "Blocked") {
    return <ViolationList violations={data.violations} />;
  }
  return (
    <section aria-label="PostgreSQL DDL" className="space-y-2">
      <h4 className="font-medium">PostgreSQL DDL</h4>
      <p className="text-muted-foreground text-sm">
        {`${data.version.name} · version ${data.version.number} · model hash ${data.modelHash.slice(0, 12)} · ${data.generatorVersion}`}
      </p>
      <StaticValidationStatus validation={data.validation} />
      {data.warnings.length > 0 ? (
        <ul aria-label="Warning manifest" className="text-sm">
          {data.warnings.map((warning) => (
            <li key={`${warning.code}:${warning.path}`}>
              {`${warning.path}: ${warning.message}`}
            </li>
          ))}
        </ul>
      ) : null}
      <SqlOutput exported={data.export} label="PostgreSQL DDL" sql={data.sql} />
    </section>
  );
}
