import { ClientShellContent } from "@/features/web-macos-client/ui/components/client-shell";
import NotificationCenterSurface from "../components/notification-center-surface";

export default function NotificationCenterView() {
  return (
    <ClientShellContent>
      <main className="mx-auto grid w-full max-w-3xl gap-4 p-4">
        <h1 className="font-semibold text-xl">Notification Center</h1>
        <NotificationCenterSurface />
      </main>
    </ClientShellContent>
  );
}
