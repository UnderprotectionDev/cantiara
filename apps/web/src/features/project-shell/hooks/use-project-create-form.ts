import {
  type CreateProjectMutationInput,
  createProjectInputSchema,
  type StarterConfiguration,
} from "@cantiara/api/project-shell";
import { useForm, useSelector } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useRef } from "react";
import { toast } from "sonner";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, projectsQueryPrefix } from "@/utils/orpc";

const INITIAL_VALUES = {
  logo: "",
  logoFile: null as File | null,
  name: "",
  problem: "",
  purpose: "",
  scope: "",
  starterConfiguration: "Blank Project" as StarterConfiguration,
  targetDate: "",
};

function errorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "data" in error) {
    const { data } = error;
    if (typeof data === "object" && data !== null && "label" in data) {
      const { label } = data;
      if (typeof label === "string") {
        return label;
      }
    }
  }
  return "Project could not be created. Try again.";
}

function optionalValue(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function useProjectCreateForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const pendingCreate = useRef<{
    clientIdempotencyKey: string;
    values: string;
  } | null>(null);

  const createProject = useMutation({
    mutationFn: (input: CreateProjectMutationInput) =>
      runOnlineOnlyWrite(() => client.createProject(input)),
    onSuccess: async () => {
      pendingCreate.current = null;
      await queryClient.invalidateQueries({ queryKey: projectsQueryPrefix });
      toast.success("Project created.");
      await navigate({ to: "/projects" });
    },
  });

  const form = useForm({
    defaultValues: INITIAL_VALUES,
    onSubmit: async ({ value }) => {
      const parsed = createProjectInputSchema.safeParse({
        logo: optionalValue(value.logo),
        name: value.name,
        problem: optionalValue(value.problem),
        purpose: optionalValue(value.purpose),
        scope: optionalValue(value.scope),
        starterConfiguration: value.starterConfiguration,
        targetDate: optionalValue(value.targetDate),
      });
      if (!parsed.success) {
        form.setErrorMap({
          onSubmit: {
            form: parsed.error.issues[0]?.message ?? "Check the form.",
            fields: {},
          },
        });
        return;
      }

      form.setErrorMap({ onSubmit: undefined });
      const serialized = JSON.stringify(parsed.data);
      const pending = pendingCreate.current;
      const clientIdempotencyKey =
        pending?.values === serialized
          ? pending.clientIdempotencyKey
          : crypto.randomUUID();
      pendingCreate.current = { clientIdempotencyKey, values: serialized };
      await createProject.mutateAsync({
        ...parsed.data,
        baseRevision: 0,
        clientIdempotencyKey,
      });
    },
  });
  const validationError = useSelector(
    form.store,
    (state): string | undefined => state.errorMap.onSubmit,
  );
  const formError =
    validationError ??
    (createProject.isError ? errorMessage(createProject.error) : undefined);

  return { form, formError, isPending: createProject.isPending };
}
