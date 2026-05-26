export type BrainTask = {
  id: string;
  label: string;
  desc: string;
  points: number;
  areaKey: string;
  link: string;
};

export const BRAIN_TASKS: BrainTask[] = [
  {
    id: "avatar",
    label: "Create a Customer Avatar",
    desc: "The specific person you sell to — makes every draft speak directly to them",
    points: 25,
    areaKey: "avatar",
    link: "/app/brain/avatar",
  },
  {
    id: "business",
    label: "Describe your business",
    desc: "What you do, who you serve, and what you charge",
    points: 20,
    areaKey: "business",
    link: "/app/capture?area=business&prompt=Describe+your+business%2C+services%2C+and+pricing",
  },
  {
    id: "customers",
    label: "Define who you serve",
    desc: "The types of customers you work with",
    points: 15,
    areaKey: "customers",
    link: "/app/capture?area=customers&prompt=Who+are+your+ideal+customers%3F",
  },
  {
    id: "style",
    label: "Capture your voice",
    desc: "How you communicate — so every draft sounds like you",
    points: 15,
    areaKey: "style",
    link: "/app/capture?area=style&prompt=Describe+how+you+communicate+with+customers",
  },
  {
    id: "projects",
    label: "Add active projects",
    desc: "What you're working on right now",
    points: 10,
    areaKey: "projects",
    link: "/app/capture?area=projects&prompt=What+are+your+current+active+projects%3F",
  },
  {
    id: "tools",
    label: "List your tools",
    desc: "Apps and systems you use day-to-day",
    points: 10,
    areaKey: "tools",
    link: "/app/capture?area=tools&prompt=What+tools+and+apps+do+you+use%3F",
  },
  {
    id: "decisions",
    label: "Lock in key decisions",
    desc: "Choices already made so the agent doesn't re-ask",
    points: 10,
    areaKey: "decisions",
    link: "/app/capture?area=decisions&prompt=What+key+business+decisions+have+you+already+made%3F",
  },
];

export const TOTAL_BRAIN_POINTS = BRAIN_TASKS.reduce((sum, t) => sum + t.points, 0);

export function getOpenBrainTasks(filledAreaKeys: string[]): BrainTask[] {
  const filled = new Set(filledAreaKeys);
  return BRAIN_TASKS.filter((t) => !filled.has(t.areaKey));
}
