import { expect, test } from "vitest";
import type {
  ReturnEvent,
  ReturnVisualTarget,
  SinceLastLooked,
} from "./return-to-work";
import {
  createReturnVisualTour,
  type ReturnCanvasViewport,
} from "./return-visual-tour";

function event(id: string, visualTarget?: ReturnVisualTarget): ReturnEvent {
  return {
    id,
    kind: "Work updated",
    occurredAt: "2026-10-07T10:00:00.000Z",
    source: {
      id: `work-${id}`,
      projectId: "project",
      title: `PAY-${id} · Payment retry`,
      sourcePath: `/projects/project#work-${id}`,
    },
    ...(visualTarget ? { visualTarget } : {}),
  };
}

function changes(events: ReturnEvent[]): SinceLastLooked {
  return {
    lastViewedAt: "2026-10-06T10:00:00.000Z",
    groups: [{ name: "Work", events }],
  };
}

function roadmap(id: string): ReturnVisualTarget {
  return {
    surface: "Roadmap",
    surfaceId: "current-view",
    recordType: "Work",
    recordId: `work-${id}`,
  };
}

function canvasDouble() {
  const shown: ReturnVisualTarget[] = [];
  const initialViewport = { center: { x: 120, y: 80 }, zoom: 1.5 };
  const viewport: ReturnCanvasViewport = {
    captureViewport: () => initialViewport,
    showTarget: (target) => {
      shown.push(target);
      return Promise.resolve({ status: "shown" });
    },
    clearHighlight: () => Promise.resolve(),
    restoreViewport: () => Promise.resolve(true),
    fitVisibleContent: () => Promise.resolve(),
  };
  return { initialViewport, shown, viewport };
}

test("Return to Work starts only explicitly and tours visual targets in the existing list order with the event explanation", async () => {
  const canvas = canvasDouble();
  const first = event("first", roadmap("first"));
  const second = event("second", {
    surface: "Project Wall",
    surfaceId: "wall",
    elementId: "exact-card",
  });
  const tour = createReturnVisualTour(
    changes([first, event("nonvisual"), second]),
    canvas.viewport,
  );
  expect(tour.state.status).toBe("idle");
  expect(canvas.shown).toEqual([]);
  await tour.start();
  expect(tour.state.current).toEqual({
    event: first,
    outcome: { status: "shown" },
  });
  expect(tour.state.position).toBe(1);
  await tour.next();
  expect(tour.state.current).toEqual({
    event: second,
    outcome: { status: "shown" },
  });
  expect(canvas.shown).toEqual([
    roadmap("first"),
    {
      surface: "Project Wall",
      surfaceId: "wall",
      elementId: "exact-card",
    },
  ]);
});

test.each(["deleted", "inaccessible", "unplaceable"] as const)(
  "Return to Work explains a %s target without moving to a substitute",
  async (reason) => {
    const canvas = canvasDouble();
    canvas.viewport.showTarget = (target) => {
      if (target.surface === "Roadmap" && target.recordId === "work-missing") {
        return Promise.resolve({ status: "skipped", reason });
      }
      canvas.shown.push(target);
      return Promise.resolve({ status: "shown" });
    };
    const missing = event("missing", roadmap("missing"));
    const tour = createReturnVisualTour(
      changes([missing, event("next", roadmap("next"))]),
      canvas.viewport,
    );
    await tour.next();
    expect(tour.state.status).toBe("idle");
    await tour.start();
    expect(tour.state.current).toEqual({
      event: missing,
      outcome: { status: "skipped", reason },
    });
    expect(canvas.shown).toEqual([]);
    await tour.next();
    expect(canvas.shown).toEqual([roadmap("next")]);
  },
);

test("Return to Work explains a failed viewport move as unplaceable and allows continuing", async () => {
  const canvas = canvasDouble();
  canvas.viewport.showTarget = () =>
    Promise.reject(new Error("Current view is unavailable"));
  const tour = createReturnVisualTour(
    changes([event("failure", roadmap("failure"))]),
    canvas.viewport,
  );
  await tour.start();
  expect(tour.state.current?.outcome).toEqual({
    status: "skipped",
    reason: "unplaceable",
  });
  await tour.next();
  expect(tour.state.status).toBe("complete");
});

test.each([true, false])(
  "Return to Work closes and restores only a meaningful start viewport (%s)",
  async (meaningful) => {
    const canvas = canvasDouble();
    let restored: unknown;
    let fitted = 0;
    canvas.viewport.restoreViewport = (snapshot) => {
      restored = snapshot;
      return Promise.resolve(meaningful);
    };
    canvas.viewport.fitVisibleContent = () => {
      fitted += 1;
      return Promise.resolve();
    };
    const tour = createReturnVisualTour(
      changes([event("first", roadmap("first"))]),
      canvas.viewport,
    );
    await tour.start();
    await tour.close();
    expect(tour.state.status).toBe("closed");
    expect(tour.state.current).toBeNull();
    expect(restored).toBe(canvas.initialViewport);
    expect(fitted).toBe(meaningful ? 0 : 1);
    expect(tour.state.restoration).toBe(meaningful ? "restored" : "fit");
    await tour.close();
    await tour.start();
    await tour.next();
    expect(canvas.shown).toEqual([roadmap("first")]);
    expect(fitted).toBe(meaningful ? 0 : 1);
  },
);

test("Return to Work fits visible content if restoring throws, even if highlight cleanup fails", async () => {
  const canvas = canvasDouble();
  let fitted = false;
  const tour = createReturnVisualTour(
    changes([event("first", roadmap("first"))]),
    canvas.viewport,
  );
  await tour.start();
  canvas.viewport.clearHighlight = () =>
    Promise.reject(new Error("Surface removed"));
  canvas.viewport.restoreViewport = () =>
    Promise.reject(new Error("View removed"));
  canvas.viewport.fitVisibleContent = () => {
    fitted = true;
    return Promise.resolve();
  };
  await tour.close();
  expect(fitted).toBe(true);
  expect(tour.state.restoration).toBe("fit");
});

test("Return to Work closes immediately while a move is pending and restores after it settles", async () => {
  const canvas = canvasDouble();
  let release: () => void = () => undefined;
  const pendingMove = new Promise<void>((resolve) => {
    release = resolve;
  });
  let moveSettled = false;
  let restoredAfterMove = false;
  let moveSignal: AbortSignal | undefined;
  canvas.viewport.showTarget = async (_target, signal) => {
    moveSignal = signal;
    await pendingMove;
    moveSettled = true;
    return { status: "shown" };
  };
  canvas.viewport.restoreViewport = () => {
    restoredAfterMove = moveSettled;
    return Promise.resolve(true);
  };
  const tour = createReturnVisualTour(
    changes([event("first", roadmap("first"))]),
    canvas.viewport,
  );
  const starting = tour.start();
  await Promise.resolve();
  const closing = tour.close();
  expect(tour.state.status).toBe("closed");
  expect(moveSignal?.aborted).toBe(true);
  release();
  await Promise.all([starting, closing]);
  expect(tour.state.status).toBe("closed");
  expect(tour.state.current).toBeNull();
  expect(restoredAfterMove).toBe(true);
});

test("Return to Work cannot begin a delayed move after it has closed", async () => {
  const canvas = canvasDouble();
  let release: () => void = () => undefined;
  const pendingCleanup = new Promise<void>((resolve) => {
    release = resolve;
  });
  canvas.viewport.clearHighlight = () => pendingCleanup;
  const tour = createReturnVisualTour(
    changes([event("first", roadmap("first"))]),
    canvas.viewport,
  );
  const starting = tour.start();
  const closing = tour.close();
  release();
  await Promise.all([starting, closing]);
  expect(canvas.shown).toEqual([]);
  expect(tour.state.status).toBe("closed");
});

test("Return to Work caps the existing visual events at twenty and points to the remainder in the same list", async () => {
  const canvas = canvasDouble();
  const events = Array.from({ length: 23 }, (_, index) =>
    event(String(index + 1), roadmap(String(index + 1))),
  );
  events.splice(2, 0, event("nonvisual"));
  const tour = createReturnVisualTour(changes(events), canvas.viewport);
  expect(tour.state.limit).toBe(20);
  expect(tour.state.total).toBe(20);
  expect(tour.state.remainder).toEqual({ count: 3, firstEventId: "21" });
  await tour.start();
  for (let index = 0; index < 22; index += 1) {
    // biome-ignore lint/performance/noAwaitInLoops: A tour advances sequentially through user actions.
    await tour.next();
  }
  expect(tour.state.status).toBe("complete");
  expect(tour.state.position).toBe(20);
  expect(canvas.shown).toHaveLength(20);
  expect(canvas.shown.at(-1)).toEqual(roadmap("20"));
});

test.each([null, "2026-10-06T10:00:00.000Z"])(
  "Return to Work leaves the viewport untouched without eligible changes (visit %s)",
  async (lastViewedAt) => {
    const canvas = canvasDouble();
    canvas.viewport.captureViewport = () => {
      throw new Error("Viewport must not be captured");
    };
    const summary = changes(
      lastViewedAt ? [event("nonvisual")] : [event("first", roadmap("first"))],
    );
    summary.lastViewedAt = lastViewedAt;
    const tour = createReturnVisualTour(summary, canvas.viewport);
    await tour.start();
    await tour.close();
    expect(canvas.shown).toEqual([]);
    expect(tour.state.restoration).toBe("not-needed");
    expect(tour.state.total).toBe(0);
  },
);

test("Return to Work serializes repeated controls while the current target is loading", async () => {
  const canvas = canvasDouble();
  let release: () => void = () => undefined;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  canvas.viewport.clearHighlight = () => ready;
  const tour = createReturnVisualTour(
    changes([
      event("first", roadmap("first")),
      event("second", roadmap("second")),
    ]),
    canvas.viewport,
  );
  const starting = tour.start();
  await tour.start();
  await tour.next();
  release();
  await starting;
  expect(canvas.shown).toEqual([roadmap("first")]);
  expect(tour.state.position).toBe(1);
});

test("Return to Work fits or reports restoration failure without reopening the closed tour", async () => {
  const canvas = canvasDouble();
  canvas.viewport.restoreViewport = () => Promise.resolve(false);
  canvas.viewport.fitVisibleContent = () =>
    Promise.reject(new Error("No visible canvas"));
  const tour = createReturnVisualTour(
    changes([event("first", roadmap("first"))]),
    canvas.viewport,
  );
  await tour.start();
  await tour.close();
  expect(tour.state.status).toBe("closed");
  expect(tour.state.restoration).toBe("failed");
});

test("Return to Work uses exact identities across all supported canvas surfaces", async () => {
  const targets: ReturnVisualTarget[] = [
    { surface: "Project Wall", surfaceId: "wall", elementId: "wall-card" },
    { surface: "User Flow", surfaceId: "flow", elementId: "flow-node" },
    {
      surface: "Screen Wireframe",
      surfaceId: "screen-version",
      elementId: "wireframe-block",
    },
    {
      surface: "Moodboard",
      surfaceId: "moodboard",
      elementId: "moodboard-item",
    },
    roadmap("last"),
  ];
  const canvas = canvasDouble();
  const tour = createReturnVisualTour(
    changes(targets.map((target, index) => event(String(index), target))),
    canvas.viewport,
  );
  await tour.start();
  for (let index = 1; index < targets.length; index += 1) {
    // biome-ignore lint/performance/noAwaitInLoops: A tour advances sequentially through user actions.
    await tour.next();
  }
  expect(canvas.shown).toEqual(targets);
});
