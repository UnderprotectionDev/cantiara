import type { WorkType } from "@cantiara/api/work-lifecycle";
import { useForm } from "@tanstack/react-form";

export function useWorkTypeChangeForm(type: WorkType) {
  return useForm({ defaultValues: { type } });
}
