import type { RoadmapView } from "@cantiara/api/roadmap-horizon";
import { createStore } from "@tanstack/react-store";
import type { Viewport } from "@xyflow/react";
import { createContext, type ReactNode, useContext, useState } from "react";

function createRoadmapSession() {
  return createStore<{ view: RoadmapView | null; viewport: Viewport | null }>({
    view: null,
    viewport: null,
  });
}
const RoadmapSessionContext = createContext<ReturnType<
  typeof createRoadmapSession
> | null>(null);

/** Scoped to the open Project, with no storage, filter restoration or cross-session persistence. */
export function RoadmapSessionProvider({ children }: { children: ReactNode }) {
  const [session] = useState(createRoadmapSession);
  return (
    <RoadmapSessionContext value={session}>{children}</RoadmapSessionContext>
  );
}
export function useRoadmapSession() {
  return useContext(RoadmapSessionContext);
}
