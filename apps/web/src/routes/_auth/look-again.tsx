import { createFileRoute } from "@tanstack/react-router";
import LookAgainPageView from "@/features/personal-reminders/ui/views/look-again-page-view";
import { useOpenSourceRecord } from "@/features/record-discovery/ui/components/context-record-preview";

export const Route = createFileRoute("/_auth/look-again")({
  component: LookAgainRoute,
});

function LookAgainRoute() {
  return <LookAgainPageView openSourceRecord={useOpenSourceRecord()} />;
}
