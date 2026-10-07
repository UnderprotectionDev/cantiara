import { createReturnVisualTour } from "@cantiara/api/return-visual-tour";
import { expect, test } from "vitest";
import {
  createRoadmapViewport,
  type RoadmapVisualView,
} from "../../roadmap-horizon/lib/roadmap-viewport";

function setup() {
  let view: RoadmapVisualView = {
    available: true,
    records: ["Work:w", "Milestone:m"],
    nodes: [
      { id: "Work:w", x: 0, y: 0 },
      { id: "Milestone:m", x: 400, y: 0 },
    ],
  };
  const moves: string[] = [];
  let highlight: string | null = null;
  let fitted = 0;
  const restored: unknown[] = [];
  const canvas = createRoadmapViewport({
    projectId: "p",
    readView: () => view,
    capture: () => ({ x: 10, y: 20, zoom: 1 }),
    moveTo: (id) => {
      moves.push(id);
      return Promise.resolve(true);
    },
    restore: (viewport) => {
      restored.push(viewport);
      return Promise.resolve(true);
    },
    fit: () => {
      fitted += 1;
      return Promise.resolve();
    },
    highlight: (id) => {
      highlight = id;
    },
  });
  const tour = createReturnVisualTour(
    {
      lastViewedAt: "2026-10-06T00:00:00.000Z",
      groups: [
        {
          name: "Work",
          events: ["w", "m"].map((id) => ({
            id,
            kind: "Work updated",
            occurredAt: "2026-10-07T00:00:00.000Z",
            source: {
              id,
              title: id,
              projectId: "p",
              sourcePath: "/projects/p",
            },
            visualTarget: {
              surface: "Roadmap",
              surfaceId: "p",
              recordType: id === "w" ? "Work" : "Milestone",
              recordId: id,
            },
          })),
        },
      ],
    },
    canvas,
  );
  return {
    tour,
    moves,
    restored,
    get highlight() {
      return highlight;
    },
    get fitted() {
      return fitted;
    },
    setView(next: RoadmapVisualView) {
      view = next;
    },
  };
}

test("Return to Work visits exact Work and Milestone targets and restores the Roadmap viewport", async () => {
  const result = setup();
  await result.tour.start();
  expect(result.moves).toEqual(["Work:w"]);
  expect(result.highlight).toBe("Work:w");
  await result.tour.next();
  expect(result.moves).toEqual(["Work:w", "Milestone:m"]);
  await result.tour.close();
  expect(result.highlight).toBeNull();
  expect(result.restored).toEqual([{ x: 10, y: 20, zoom: 1 }]);
  expect(result.fitted).toBe(0);
});

test("filtered Work is skipped without changing filters or choosing a similar Milestone", async () => {
  const result = setup();
  result.setView({
    available: true,
    records: ["Work:w", "Milestone:m"],
    nodes: [{ id: "Milestone:m", x: 400, y: 0 }],
  });
  await result.tour.start();
  expect(result.tour.state.current?.outcome).toEqual({
    status: "skipped",
    reason: "unplaceable",
  });
  expect(result.moves).toEqual([]);
  await result.tour.next();
  expect(result.moves).toEqual(["Milestone:m"]);
});

test("a removed exact record is inaccessible and a changed current layout fits instead of restoring stale coordinates", async () => {
  const result = setup();
  await result.tour.start();
  result.setView({
    available: true,
    records: ["Work:w"],
    nodes: [{ id: "Work:w", x: 0, y: 0 }],
  });
  await result.tour.next();
  expect(result.tour.state.current?.outcome).toEqual({
    status: "skipped",
    reason: "inaccessible",
  });
  expect(result.moves).toEqual(["Work:w"]);
  await result.tour.close();
  expect(result.restored).toEqual([]);
  expect(result.fitted).toBe(1);
  expect(result.tour.state.restoration).toBe("fit");
});

test("lost project access never moves to a target", async () => {
  const result = setup();
  result.setView({ available: false, records: [], nodes: [] });
  await result.tour.start();
  expect(result.tour.state.current?.outcome).toEqual({
    status: "skipped",
    reason: "inaccessible",
  });
  expect(result.moves).toEqual([]);
});
