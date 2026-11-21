import { useCreateStore, useSelector } from "@tanstack/react-store";
import { useEffect } from "react";

/** A clock for the mounted planning surface and its Account time zone. */
export function useViewClock(interval = 60_000) {
  const clock = useCreateStore(new Date());
  useEffect(() => {
    const refresh = () => clock.setState(() => new Date());
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    };
    refresh();
    const timer = window.setInterval(refresh, interval);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [clock, interval]);
  return useSelector(clock, (value) => value);
}
