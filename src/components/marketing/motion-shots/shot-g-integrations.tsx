"use client";

// Shot G (PA-POS-29 companion, §14.9): the integrations constellation. Sixteen adapters PA
// has actually shipped radiate from the workspace on soft-pulse lines; the category chips
// filter which nodes glow. Honest framing only — these are the adapters we've built, not a
// five-thousand-integration catalog claim.
import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { MONO_FONT } from "../cta";
import { ShotFrame } from "./shot-frame";

type NodeCategory =
  | "sales"
  | "marketing"
  | "ops"
  | "support"
  | "real-estate"
  | "home-services";

type IntegrationNode = {
  label: string;
  /** File under public/logos/integrations/ — every one exists on disk. */
  logo: string;
  categories: readonly NodeCategory[];
};

// Every node maps to a shipped adapter surface: the connector registry
// (src/lib/connectors/*), the Channels Gateway adapters (src/lib/channels/adapters),
// or the Gmail/Calendar connections. Nothing here is aspirational.
const NODES: readonly IntegrationNode[] = [
  { label: "Gmail", logo: "gmail.svg", categories: ["sales", "marketing", "support", "ops", "real-estate", "home-services"] },
  { label: "Slack", logo: "slack.svg", categories: ["ops", "support", "marketing"] },
  { label: "Google Calendar", logo: "google-calendar.svg", categories: ["sales", "ops"] },
  { label: "Calendly", logo: "calendly.svg", categories: ["sales", "real-estate", "home-services"] },
  { label: "Zoom", logo: "zoom.svg", categories: ["sales", "support"] },
  { label: "HubSpot", logo: "hubspot.svg", categories: ["sales", "marketing"] },
  { label: "QuickBooks", logo: "quickbooks.svg", categories: ["ops", "home-services"] },
  { label: "Stripe", logo: "stripe.svg", categories: ["sales", "ops"] },
  { label: "SMS / Twilio", logo: "sms.svg", categories: ["sales", "support", "real-estate", "home-services"] },
  { label: "WhatsApp", logo: "whatsapp.svg", categories: ["support", "sales"] },
  { label: "iMessage", logo: "imessage.svg", categories: ["support", "sales", "real-estate"] },
  { label: "Telegram", logo: "telegram.svg", categories: ["support"] },
  { label: "Google Maps", logo: "google-maps.svg", categories: ["real-estate", "home-services"] },
  { label: "GitHub", logo: "github.svg", categories: ["ops", "marketing"] },
  { label: "Vercel", logo: "vercel.svg", categories: ["marketing", "ops"] },
  { label: "Supabase", logo: "supabase.svg", categories: ["ops"] },
];

const CHIPS: readonly { key: NodeCategory | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "sales", label: "Sales" },
  { key: "marketing", label: "Marketing" },
  { key: "ops", label: "Ops" },
  { key: "support", label: "Support" },
  { key: "real-estate", label: "Real Estate" },
  { key: "home-services", label: "Home Services" },
];

// Two rings around the center, positions in percent of the stage. Computed once at module
// load — deterministic, no runtime layout math.
const POSITIONS: readonly { x: number; y: number }[] = (() => {
  const positions: { x: number; y: number }[] = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
    positions.push({ x: 50 + 24 * Math.cos(angle), y: 50 + 26 * Math.sin(angle) });
  }
  for (let i = 0; i < 10; i += 1) {
    const angle = (Math.PI * 2 * i) / 10 - Math.PI / 2 + Math.PI / 10;
    positions.push({ x: 50 + 42 * Math.cos(angle), y: 50 + 42 * Math.sin(angle) });
  }
  return positions;
})();

export function IntegrationsShot() {
  const reduced = useReducedMotion() ?? false;
  const [category, setCategory] = useState<NodeCategory | "all">("all");

  const isLit = (node: IntegrationNode) =>
    category === "all" || node.categories.includes(category);

  return (
    <div>
      <ShotFrame
        shot="integrations"
        title="Pocket Agent — Connections"
        cornerLabel="adapters · already built"
        reduced={reduced}
      >
        <div
          className="flex flex-wrap items-center justify-center gap-1.5"
          role="group"
          aria-label="Filter integrations by category"
        >
          {CHIPS.map((chip) => {
            const selected = category === chip.key;
            return (
              <button
                key={chip.key}
                type="button"
                aria-pressed={selected}
                onClick={() => setCategory(chip.key)}
                className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                  selected
                    ? "border-cyan-300/40 bg-cyan-400/10 text-cyan-200"
                    : "border-white/10 bg-white/[0.02] text-slate-400 hover:border-white/20 hover:text-slate-200"
                }`}
                style={{ fontFamily: MONO_FONT }}
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        <div className="relative mx-auto mt-4 aspect-square max-h-[420px] w-full max-w-[420px]">
          {/* The pulse lines, drawn under the nodes. */}
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
            aria-hidden
          >
            {NODES.map((node, i) => {
              const pos = POSITIONS[i];
              const lit = isLit(node);
              return (
                <motion.line
                  key={node.label}
                  x1={50}
                  y1={50}
                  x2={pos.x}
                  y2={pos.y}
                  stroke="#22d3ee"
                  strokeWidth={0.35}
                  initial={false}
                  animate={
                    reduced || !lit
                      ? { opacity: lit ? 0.3 : 0.08 }
                      : { opacity: [0.12, 0.45, 0.12] }
                  }
                  transition={
                    reduced || !lit
                      ? { duration: 0 }
                      : { duration: 3, delay: i * 0.2, repeat: Infinity, ease: "easeInOut" }
                  }
                />
              );
            })}
          </svg>

          {/* Center — the workspace. */}
          <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
            <span
              className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/40 bg-cyan-400/10 text-base font-bold text-cyan-200 shadow-[0_0_28px_rgba(34,211,238,0.25)]"
              style={{ fontFamily: MONO_FONT }}
            >
              PA
            </span>
          </div>

          {/* The integration nodes. */}
          {NODES.map((node, i) => {
            const pos = POSITIONS[i];
            const lit = isLit(node);
            return (
              <div
                key={node.label}
                className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center transition-opacity duration-300"
                style={{ left: `${pos.x}%`, top: `${pos.y}%`, opacity: lit ? 1 : 0.3 }}
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-xl border bg-[#0d1118] transition ${
                    lit ? "border-cyan-300/25" : "border-white/10"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- static local SVGs, no optimization pass needed */}
                  <img
                    src={`/logos/integrations/${node.logo}`}
                    alt={node.label}
                    className="h-5 w-5"
                  />
                </span>
                <span className="mt-1 hidden whitespace-nowrap text-[10px] text-slate-500 sm:block">
                  {node.label}
                </span>
              </div>
            );
          })}
        </div>

        <p className="mt-3 text-center text-[11px] text-slate-500" style={{ fontFamily: MONO_FONT }}>
          The tools we&rsquo;ve already built adapters for. The Custom Connector App composes
          new ones on request (coming soon).
        </p>
      </ShotFrame>
    </div>
  );
}
