// biome-ignore-all lint/performance/noJsxPropsBind: The panel binds its own name field.
import type { TechnicalDiagramVersion } from "@cantiara/api/technical-diagram-version";
import type { TechnicalDiagramSource } from "@cantiara/api/technical-diagrams";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { Label } from "@cantiara/ui/components/label";
import { useId, useState } from "react";

interface Props {
  diagram: Pick<TechnicalDiagramSource, "authorityMode" | "id" | "revision">;
  disabled: boolean;
  error: string | null;
  onCreate: (name: string) => void;
  onRestore: (version: TechnicalDiagramVersion) => void;
  versions: TechnicalDiagramVersion[];
}

/**
 * Diagram Version panel: an append-only list of immutable checkpoints.
 * Restore writes a new live revision; it never edits a listed Diagram Version.
 */
export function DiagramVersionPanel({
  diagram,
  disabled,
  error,
  onCreate,
  onRestore,
  versions,
}: Props) {
  const nameId = useId();
  const [name, setName] = useState("");
  if (diagram.authorityMode === "External Source Link") {
    return (
      <section aria-label="Diagram Version" className="space-y-2">
        <h4 className="font-medium">Diagram Version</h4>
        <p className="text-muted-foreground text-sm">
          An External Source Link keeps its content in the external tool, so it
          has no Diagram Version.
        </p>
      </section>
    );
  }
  return (
    <section aria-label="Diagram Version" className="space-y-2">
      <h4 className="font-medium">Diagram Version</h4>
      <p className="text-muted-foreground text-sm">
        A Diagram Version is an immutable checkpoint. Live revision{" "}
        {diagram.revision}.
      </p>
      <ol aria-label="Diagram Versions" className="list-inside list-decimal">
        {versions.map((version) => (
          <li className="space-x-2" key={version.id}>
            <span>
              {version.name} · version {version.number} · taken at live revision{" "}
              {version.revision}
            </span>
            <Button
              aria-label={`Restore Diagram Version ${version.name}`}
              disabled={disabled}
              onClick={() => onRestore(version)}
              size="sm"
              type="button"
              variant="outline"
            >
              Restore
            </Button>
          </li>
        ))}
      </ol>
      {versions.length > 0 ? (
        <p className="text-muted-foreground text-sm">
          Restore writes a new live revision; the Diagram Version stays
          unchanged.
        </p>
      ) : null}
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          onCreate(name.trim());
          setName("");
        }}
      >
        <Label htmlFor={nameId}>Diagram Version name</Label>
        <Input
          id={nameId}
          onChange={(event) => setName(event.target.value)}
          required
          value={name}
        />
        <Button disabled={disabled || !name.trim()} type="submit">
          Create Diagram Version
        </Button>
      </form>
      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
}
