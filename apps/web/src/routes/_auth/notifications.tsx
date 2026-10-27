import { createFileRoute } from "@tanstack/react-router";
import NotificationCenterView from "@/features/attention-signals/ui/views/notification-center-view";

export const Route = createFileRoute("/_auth/notifications")({
  component: NotificationCenterView,
});
