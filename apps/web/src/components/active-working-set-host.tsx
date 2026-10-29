import { useEffect } from "react";
import { endActiveWorkingSetSession } from "@/features/personal-shell/store/active-working-set";
import ActiveWorkingSetTray from "@/features/personal-shell/ui/components/active-working-set-tray";
import { useOpenSourceRecord } from "@/features/record-discovery/ui/components/context-record-preview";

/** Mounted for the signed-in session only; leaving it ends the set. */
export default function ActiveWorkingSetHost() {
  const openSourceRecord = useOpenSourceRecord();
  useEffect(() => endActiveWorkingSetSession, []);
  return <ActiveWorkingSetTray open={openSourceRecord} />;
}
