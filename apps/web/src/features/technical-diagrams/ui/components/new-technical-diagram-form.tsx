// biome-ignore-all lint/performance/noJsxPropsBind: Each form binds its own field state.
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { Label } from "@cantiara/ui/components/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client } from "@/utils/orpc";

type DiagramType =
  | "Technical Architecture"
  | "Data Model"
  | "Technical Sequence";
type CreateMode = "Product-authored Model" | "External Source Link";

const TYPES: DiagramType[] = [
  "Technical Architecture",
  "Data Model",
  "Technical Sequence",
];
const MODES: CreateMode[] = ["Product-authored Model", "External Source Link"];

export function NewTechnicalDiagramForm({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<DiagramType>("Technical Architecture");
  const [mode, setMode] = useState<CreateMode>("Product-authored Model");
  const [link, setLink] = useState({ revision: "", tool: "", url: "" });
  const [error, setError] = useState<string | null>(null);
  const pendingKey = useRef<string | null>(null);
  const create = useMutation({
    mutationFn: () => {
      pendingKey.current ??= crypto.randomUUID();
      const base = {
        clientIdempotencyKey: pendingKey.current,
        projectId,
        title,
        type,
      };
      return runOnlineOnlyWrite(() =>
        mode === "External Source Link"
          ? client.createTechnicalDiagram({
              ...base,
              authorityMode: mode,
              externalSource: {
                lastCheckedAt: new Date().toISOString(),
                revision: link.revision.trim() || null,
                tool: link.tool,
                url: link.url,
              },
            })
          : client.createTechnicalDiagram({ ...base, authorityMode: mode }),
      );
    },
    onError: (failure) =>
      setError(
        failure instanceof Error
          ? failure.message
          : "Technical Diagram could not be created.",
      ),
    onSuccess: async () => {
      pendingKey.current = null;
      setError(null);
      setTitle("");
      await queryClient.invalidateQueries();
    },
  });
  return (
    <form
      aria-label="New Technical Diagram"
      className="space-y-2 rounded-lg border p-4"
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate();
      }}
    >
      <h3 className="font-medium">New Technical Diagram</h3>
      <Label htmlFor="new-diagram-title">Title</Label>
      <Input
        id="new-diagram-title"
        onChange={(event) => {
          pendingKey.current = null;
          setTitle(event.target.value);
        }}
        required
        value={title}
      />
      <Label htmlFor="new-diagram-type">Type</Label>
      <select
        id="new-diagram-type"
        onChange={(event) => setType(event.target.value as DiagramType)}
        value={type}
      >
        {TYPES.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <Label htmlFor="new-diagram-mode">Diagram Authority Mode</Label>
      <select
        id="new-diagram-mode"
        onChange={(event) => {
          pendingKey.current = null;
          setMode(event.target.value as CreateMode);
        }}
        value={mode}
      >
        {MODES.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {mode === "External Source Link" ? (
        <>
          <Label htmlFor="new-diagram-url">HTTPS URL</Label>
          <Input
            id="new-diagram-url"
            onChange={(event) => {
              pendingKey.current = null;
              setLink({ ...link, url: event.target.value });
            }}
            required
            type="url"
            value={link.url}
          />
          <Label htmlFor="new-diagram-tool">Source tool</Label>
          <Input
            id="new-diagram-tool"
            onChange={(event) => {
              pendingKey.current = null;
              setLink({ ...link, tool: event.target.value });
            }}
            required
            value={link.tool}
          />
          <Label htmlFor="new-diagram-revision">
            Known revision (optional)
          </Label>
          <Input
            id="new-diagram-revision"
            onChange={(event) => {
              pendingKey.current = null;
              setLink({ ...link, revision: event.target.value });
            }}
            value={link.revision}
          />
        </>
      ) : null}
      <Button disabled={create.isPending} type="submit">
        Create
      </Button>
      {error ? <p role="alert">{error}</p> : null}
    </form>
  );
}
