// biome-ignore-all lint/performance/noJsxPropsBind: Form field render props require closures over current field handlers.
import { documentTypeSchema } from "@cantiara/api/documents";
import {
  type CreateSmartCollectionInput,
  createSmartCollectionInputSchema,
  SMART_COLLECTION_SOURCE_TYPES,
  SMART_COLLECTION_STATUS_OPTIONS,
  type SmartCollectionSourceType,
} from "@cantiara/api/smart-collections";
import { WORK_TYPE_OPTIONS } from "@cantiara/api/work-lifecycle";
import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import { Input } from "@cantiara/ui/components/input";
import { Label } from "@cantiara/ui/components/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import {
  client,
  invalidateSmartCollectionMembership,
  orpc,
} from "@/utils/orpc";

function buildCollectionConditions({
  documentType,
  sourceType,
  status,
  tag,
  workType,
}: {
  documentType: string;
  sourceType: SmartCollectionSourceType;
  status: string;
  tag: string;
  workType: string;
}): CreateSmartCollectionInput["conditions"] {
  const conditions: CreateSmartCollectionInput["conditions"] = {};
  if (sourceType === "Work") {
    if (status) {
      conditions.status = status as NonNullable<
        CreateSmartCollectionInput["conditions"]["status"]
      >;
    }
    if (workType) {
      conditions.type = workType as NonNullable<
        CreateSmartCollectionInput["conditions"]["type"]
      >;
    }
    return conditions;
  }

  if (sourceType === "Document" || sourceType === "Wiki Document") {
    if (documentType) {
      conditions.documentType = documentType as NonNullable<
        CreateSmartCollectionInput["conditions"]["documentType"]
      >;
    }
    if (tag.trim()) {
      conditions.tag = tag.trim();
    }
    return conditions;
  }

  if (status) {
    conditions.status = status as NonNullable<
      CreateSmartCollectionInput["conditions"]["status"]
    >;
  }
  return conditions;
}

export default function SmartCollectionCreateForm({
  projectId,
}: {
  projectId: string;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const pendingKey = useRef<string | null>(null);
  const projectsQuery = useQuery(orpc.projects.queryOptions());
  const projects = projectsQuery.data ?? [];
  const form = useForm({
    defaultValues: {
      documentType: "",
      name: "",
      projectIds: [projectId],
      sourceType: "Work" as SmartCollectionSourceType,
      status: "",
      tag: "",
      viewName: "Default",
      workType: "",
    },
    onSubmit: ({ value }) => {
      pendingKey.current ??= crypto.randomUUID();
      const parsed = createSmartCollectionInputSchema.safeParse({
        clientIdempotencyKey: pendingKey.current,
        conditions: buildCollectionConditions(value),
        name: value.name,
        presentation: "List",
        projectId,
        sourceType: value.sourceType,
        ...(value.sourceType === "Wiki Document"
          ? {}
          : { scope: { projectIds: value.projectIds } }),
        viewName: value.viewName,
      });
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? "Check the form.");
        return;
      }
      create.mutate(parsed.data);
    },
  });
  const sourceType = useStore(form.store, (state) => state.values.sourceType);
  const projectIds = useStore(form.store, (state) => state.values.projectIds);
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }
  const create = useMutation({
    mutationFn: (input: CreateSmartCollectionInput) =>
      runOnlineOnlyWrite(() => client.createSmartCollection(input)),
    onSuccess: async () => {
      pendingKey.current = null;
      form.setFieldValue("name", "");
      setError(null);
      await Promise.all(invalidateSmartCollectionMembership(queryClient));
    },
    onError: (failure) =>
      setError(
        failure instanceof Error
          ? failure.message
          : "Smart Collection could not be saved.",
      ),
  });
  const statusOptions = SMART_COLLECTION_STATUS_OPTIONS[sourceType] ?? [];
  const isDocumentSource =
    sourceType === "Document" || sourceType === "Wiki Document";

  useEffect(() => {
    form.setFieldValue("projectIds", [projectId]);
  }, [form, projectId]);

  let sourceSpecificFilters: ReactNode = null;
  if (sourceType === "Work") {
    sourceSpecificFilters = (
      <div className="space-y-1">
        <Label htmlFor="collection-work-type">Work type</Label>
        <form.Field name="workType">
          {(field) => (
            <NativeSelect
              id="collection-work-type"
              name={field.name}
              onChange={(event) => {
                pendingKey.current = null;
                field.handleChange(event.target.value);
              }}
              value={field.state.value}
            >
              <NativeSelectOption value="">None</NativeSelectOption>
              {WORK_TYPE_OPTIONS.map((type) => (
                <NativeSelectOption key={type} value={type}>
                  {type}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </form.Field>
      </div>
    );
  } else if (isDocumentSource) {
    sourceSpecificFilters = (
      <>
        <div className="space-y-1">
          <Label htmlFor="collection-document-type">Document type</Label>
          <form.Field name="documentType">
            {(field) => (
              <NativeSelect
                id="collection-document-type"
                name={field.name}
                onChange={(event) => {
                  pendingKey.current = null;
                  field.handleChange(event.target.value);
                }}
                value={field.state.value}
              >
                <NativeSelectOption value="">None</NativeSelectOption>
                {documentTypeSchema.options.map((type) => (
                  <NativeSelectOption key={type} value={type}>
                    {type}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}
          </form.Field>
        </div>
        <div className="space-y-1">
          <Label htmlFor="collection-tag">Tag</Label>
          <form.Field name="tag">
            {(field) => (
              <Input
                id="collection-tag"
                name={field.name}
                onChange={(event) => {
                  pendingKey.current = null;
                  field.handleChange(event.target.value);
                }}
                value={field.state.value}
              />
            )}
          </form.Field>
        </div>
      </>
    );
  }
  const scopeField =
    sourceType === "Wiki Document" ? (
      <p className="self-end text-muted-foreground text-sm">Workspace scope</p>
    ) : (
      <fieldset className="space-y-2 md:col-span-4">
        <legend className="font-medium text-sm">Scope</legend>
        {projectsQuery.isError ? (
          <p className="text-muted-foreground text-sm">
            Project scope is unavailable.
          </p>
        ) : (
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {projects.map((project) => {
              const checked = projectIds.includes(project.id);
              return (
                <Label
                  className="flex items-center gap-2 font-normal"
                  key={project.id}
                >
                  <Checkbox
                    checked={checked}
                    disabled={
                      project.id === projectId ||
                      (checked && projectIds.length === 1)
                    }
                    onCheckedChange={(nextChecked) => {
                      pendingKey.current = null;
                      form.setFieldValue("projectIds", (current) =>
                        nextChecked
                          ? [...new Set([...current, project.id])]
                          : current.filter((id) => id !== project.id),
                      );
                    }}
                    value={project.id}
                  />
                  {project.name}
                </Label>
              );
            })}
          </div>
        )}
      </fieldset>
    );

  return (
    <>
      <form
        className="grid gap-3 rounded-lg border p-4 md:grid-cols-4"
        onSubmit={handleSubmit}
      >
        <div className="space-y-1">
          <Label htmlFor="collection-name">Name</Label>
          <form.Field name="name">
            {(field) => (
              <Input
                id="collection-name"
                name={field.name}
                onChange={(event) => {
                  pendingKey.current = null;
                  field.handleChange(event.target.value);
                }}
                required
                value={field.state.value}
              />
            )}
          </form.Field>
        </div>
        <div className="space-y-1">
          <Label htmlFor="collection-view-name">Named view</Label>
          <form.Field name="viewName">
            {(field) => (
              <Input
                id="collection-view-name"
                name={field.name}
                onChange={(event) => {
                  pendingKey.current = null;
                  field.handleChange(event.target.value);
                }}
                required
                value={field.state.value}
              />
            )}
          </form.Field>
        </div>
        <div className="space-y-1">
          <Label htmlFor="collection-source-type">Source type</Label>
          <form.Field name="sourceType">
            {(field) => (
              <NativeSelect
                id="collection-source-type"
                name={field.name}
                onChange={(event) => {
                  pendingKey.current = null;
                  field.handleChange(
                    event.target.value as SmartCollectionSourceType,
                  );
                  form.setFieldValue("status", "");
                  form.setFieldValue("workType", "");
                  form.setFieldValue("documentType", "");
                  form.setFieldValue("tag", "");
                }}
                value={field.state.value}
              >
                {SMART_COLLECTION_SOURCE_TYPES.map((type) => (
                  <NativeSelectOption key={type} value={type}>
                    {type}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}
          </form.Field>
        </div>
        {statusOptions.length > 0 ? (
          <div className="space-y-1">
            <Label htmlFor="collection-status">Status</Label>
            <form.Field name="status">
              {(field) => (
                <NativeSelect
                  id="collection-status"
                  name={field.name}
                  onChange={(event) => {
                    pendingKey.current = null;
                    field.handleChange(event.target.value);
                  }}
                  value={field.state.value}
                >
                  <NativeSelectOption value="">None</NativeSelectOption>
                  {statusOptions.map((option) => (
                    <NativeSelectOption key={option} value={option}>
                      {option}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              )}
            </form.Field>
          </div>
        ) : null}
        {sourceSpecificFilters}
        {scopeField}
        <Button className="self-end" disabled={create.isPending} type="submit">
          Save
        </Button>
      </form>
      {error ? <p role="alert">{error}</p> : null}
    </>
  );
}
