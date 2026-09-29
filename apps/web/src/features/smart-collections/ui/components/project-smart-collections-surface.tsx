// biome-ignore-all lint/performance/noJsxPropsBind: This small form binds its local fields and submit action.
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { Label } from "@cantiara/ui/components/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";
import { workRecordHref } from "../../../project-shell/lib/project-shell-navigation";

export default function ProjectSmartCollectionsSurface({
  projectId,
  selectedViewId,
}: {
  projectId: string;
  selectedViewId?: string;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [viewName, setViewName] = useState("Default");
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const pendingKey = useRef<string | null>(null);
  const options = orpc.smartCollectionViews.queryOptions({
    input: { projectId },
  });
  const views = useQuery(options);
  const create = useMutation({
    mutationFn: () => {
      pendingKey.current ??= crypto.randomUUID();
      return runOnlineOnlyWrite(() =>
        client.createSmartCollection({
          clientIdempotencyKey: pendingKey.current as string,
          projectId,
          name,
          viewName,
          presentation: "List",
          conditions: status
            ? {
                status: status as
                  | "Not Started"
                  | "In Progress"
                  | "Blocked"
                  | "Closed",
              }
            : {},
        }),
      );
    },
    onSuccess: async () => {
      pendingKey.current = null;
      setName("");
      setError(null);
      await queryClient.invalidateQueries({ queryKey: options.queryKey });
    },
    onError: (failure) =>
      setError(
        failure instanceof Error
          ? failure.message
          : "Smart Collection could not be saved.",
      ),
  });
  const visible = selectedViewId
    ? views.data?.filter(({ id }) => id === selectedViewId)
    : views.data;
  return (
    <section aria-label="Smart Collection" className="space-y-5">
      <h2 className="font-semibold text-2xl">Smart Collection</h2>
      <form
        className="grid gap-3 rounded-lg border p-4 md:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        <div className="space-y-1">
          <Label htmlFor="collection-name">Name</Label>
          <Input
            id="collection-name"
            onChange={(event) => {
              pendingKey.current = null;
              setName(event.target.value);
            }}
            required
            value={name}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="collection-view-name">Named view</Label>
          <Input
            id="collection-view-name"
            onChange={(event) => {
              pendingKey.current = null;
              setViewName(event.target.value);
            }}
            required
            value={viewName}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="collection-status">Status</Label>
          <NativeSelect
            id="collection-status"
            onChange={(event) => {
              pendingKey.current = null;
              setStatus(event.target.value);
            }}
            value={status}
          >
            <NativeSelectOption value="">None</NativeSelectOption>
            <NativeSelectOption value="Not Started">
              Not Started
            </NativeSelectOption>
            <NativeSelectOption value="In Progress">
              In Progress
            </NativeSelectOption>
            <NativeSelectOption value="Blocked">Blocked</NativeSelectOption>
            <NativeSelectOption value="Closed">Closed</NativeSelectOption>
          </NativeSelect>
        </div>
        <Button className="self-end" disabled={create.isPending} type="submit">
          Save
        </Button>
      </form>
      {error ? <p role="alert">{error}</p> : null}
      {views.isError ? (
        <p role="alert">Smart Collection is unavailable.</p>
      ) : null}
      {visible?.map((view) => (
        <section className="space-y-2 rounded-lg border p-4" key={view.id}>
          <h3 className="font-medium">
            {view.collectionName} · {view.name}
          </h3>
          <p className="text-muted-foreground text-sm">{view.presentation}</p>
          {view.works.length === 0 ? (
            <p>No Work matches this view.</p>
          ) : (
            <ul className="list-inside list-disc">
              {view.works.map((work) => (
                <li key={work.id}>
                  <a
                    className="underline"
                    href={workRecordHref(projectId, work.id)}
                  >
                    {work.key} · {work.title}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </section>
  );
}
