export type WorkStatus = "Planned" | "In progress" | "Ready";

export type WorkItem = {
  id: number;
  title: string;
  owner: string;
  status: WorkStatus;
  due: string;
  note: string;
};

export const workItems: WorkItem[] = [
  {
    id: 1,
    title: "Confirm the launch audience",
    owner: "Product",
    status: "Ready",
    due: "Today",
    note: "The primary audience and outcome are documented.",
  },
  {
    id: 2,
    title: "Review the core journey",
    owner: "Design",
    status: "In progress",
    due: "Tomorrow",
    note: "The happy path is ready for a final walkthrough.",
  },
  {
    id: 3,
    title: "Prepare the handoff checklist",
    owner: "Delivery",
    status: "Planned",
    due: "Friday",
    note: "Evidence and ownership still need to be assigned.",
  },
];

export const directions = [
  {
    key: "a",
    name: "Operational overview",
    summary: "Parallel visibility with persistent navigation and detail context.",
  },
  {
    key: "b",
    name: "Priority queue",
    summary: "Status-led work with the next meaningful action kept visible.",
  },
  {
    key: "c",
    name: "Guided focus",
    summary: "One decision at a time with progressive context and a clear finish.",
  },
] as const;
