import { useForm } from "@tanstack/react-form";

export function useWebCaptureInboxSearch() {
  return useForm({ defaultValues: { targetSearch: "" } });
}
