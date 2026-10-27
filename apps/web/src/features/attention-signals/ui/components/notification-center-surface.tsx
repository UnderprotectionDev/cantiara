import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";
import NotificationCenterList from "./notification-center-list";

export default function NotificationCenterSurface() {
  const center = useQuery(orpc.notificationCenter.queryOptions());
  if (center.isPending) {
    return <p>Loading Notification Center…</p>;
  }
  if (!center.data) {
    return <p role="alert">Notification Center could not be loaded.</p>;
  }
  return <NotificationCenterList center={center.data} />;
}
