// Action-button registry for the Business Brain Workshop player (PA-POS-38, §24.4).
// The right-hand panel watches video.currentTime; when a trigger_sec is crossed the button
// appears. Each kind maps to exactly one handler:
//
//   fork_repo      → POST /api/workshop/actions/fork-repo  (GitHub template generate)
//   add_zone       → POST /api/workshop/actions/add-zone   (Contents API PUT into their fork)
//   connect_claude → external link to Claude with the repo URL pre-filled
//   login_to_pa    → /app/agents (workspace provisioned at checkout; Brain wired at login)
//
// Chase tunes this file directly — keep trigger_sec ascending.

export const WORKSHOP_ZONES = [
  "voice",
  "customers",
  "products",
  "competitive",
  "decisions",
] as const;

export type WorkshopZone = (typeof WORKSHOP_ZONES)[number];

export function isWorkshopZone(value: string): value is WorkshopZone {
  return (WORKSHOP_ZONES as readonly string[]).includes(value);
}

export type WorkshopActionKind =
  | "fork_repo"
  | "add_zone"
  | "connect_claude"
  | "login_to_pa";

export type WorkshopAction = {
  /** Video position in seconds at which the button appears. */
  trigger_sec: number;
  kind: WorkshopActionKind;
  label: string;
  /** Present only when kind === "add_zone". */
  payload?: { zone: WorkshopZone };
};

export const WORKSHOP_ACTION_SCRIPT: readonly WorkshopAction[] = [
  { trigger_sec: 900, kind: "fork_repo", label: "Fork the template repo →" },
  { trigger_sec: 1200, kind: "add_zone", label: "Add my Voice zone →", payload: { zone: "voice" } },
  { trigger_sec: 1500, kind: "add_zone", label: "Add my Customers zone →", payload: { zone: "customers" } },
  { trigger_sec: 1800, kind: "add_zone", label: "Add my Products zone →", payload: { zone: "products" } },
  { trigger_sec: 2100, kind: "add_zone", label: "Add my Competitive zone →", payload: { zone: "competitive" } },
  { trigger_sec: 2340, kind: "add_zone", label: "Add my Decisions zone →", payload: { zone: "decisions" } },
  { trigger_sec: 2640, kind: "connect_claude", label: "Connect my Brain to Claude →" },
  { trigger_sec: 3240, kind: "login_to_pa", label: "Log in to Pocket Agent →" },
];
