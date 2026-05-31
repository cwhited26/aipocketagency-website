// Shared routine constants — safe to import in both Server Components and Client Components.
// No process.env or fetch dependencies here.

export const ROUTINE_KINDS = ["daily_brief", "followup_sweep", "weekly_digest"] as const;
export type RoutineKind = (typeof ROUTINE_KINDS)[number];

export type RoutineDef = {
  kind: RoutineKind;
  label: string;
  description: string;
  scheduleCron: string;
};

export const ROUTINE_DEFS: Record<RoutineKind, RoutineDef> = {
  daily_brief: {
    kind: "daily_brief",
    label: "Daily Brief",
    description:
      "A morning summary of what's on your radar, pending items, and today's top priority — generated from your brain and waiting in your inbox by 8am.",
    scheduleCron: "0 8 * * *",
  },
  followup_sweep: {
    kind: "followup_sweep",
    label: "Follow-up Sweep",
    description:
      "Every Monday morning, your agent scans your brain for stalled leads, open proposals, and relationships that need a nudge.",
    scheduleCron: "0 9 * * 1",
  },
  weekly_digest: {
    kind: "weekly_digest",
    label: "Weekly Digest",
    description:
      "A Monday read of what your agent currently knows, what needs your attention, and what's worth adding to your brain next.",
    scheduleCron: "0 7 * * 1",
  },
};
