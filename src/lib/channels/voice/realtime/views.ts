// lib/channels/voice/realtime/views.ts — request schemas + row→view mappers for the Voice App
// surface (/app/apps/voice + its API routes). Views carry only what the client renders — no SIDs
// beyond what the UI links on, no config, no tokens.

import { z } from "zod";
import type { VoiceCallRow } from "../calls-store";
import type { VoiceCallEventRow } from "./events-store";

export const CreateCallBodySchema = z.object({
  to: z
    .string()
    .regex(/^\+[1-9]\d{6,14}$/, "Enter the number in international format, like +14045551234."),
  purpose: z.string().min(3).max(500),
});

export const SpeakBodySchema = z.object({
  text: z.string().min(1).max(500),
});

export type VoiceCallListView = {
  id: string;
  direction: "inbound" | "outbound";
  counterparty: string;
  status: string;
  startedAt: string;
  durationSeconds: number | null;
  costCents: number | null;
  purpose: string | null;
  engine: string | null;
};

export function toVoiceCallListView(row: VoiceCallRow): VoiceCallListView {
  return {
    id: row.id,
    direction: row.direction,
    counterparty: row.direction === "inbound" ? row.from_number : row.to_number,
    status: row.status,
    startedAt: row.started_at,
    durationSeconds: row.duration_seconds,
    costCents: row.cost_cents === null ? null : Math.round(Number(row.cost_cents)),
    purpose: row.purpose ?? null,
    engine: row.engine ?? null,
  };
}

export type VoiceCallEventView = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type VoiceCallDetailView = VoiceCallListView & {
  transcript: { role: string; text: string; atMs: number }[];
  functionCalls: {
    name: string;
    arguments: Record<string, unknown>;
    stagedActionId: string | null;
    outcome: string;
  }[];
  events: VoiceCallEventView[];
  /** True while the call can still receive speak-as-Poc lines / be hung up. */
  live: boolean;
};

export function toVoiceCallDetailView(
  row: VoiceCallRow,
  events: readonly VoiceCallEventRow[],
): VoiceCallDetailView {
  // The finalized transcript_json wins; while the call is live it's empty and the client renders
  // the speech events as the streaming transcript instead.
  const transcript = (row.transcript_json ?? []).map((t) => ({
    role: t.role,
    text: t.text,
    atMs: t.at_ms,
  }));
  return {
    ...toVoiceCallListView(row),
    transcript,
    functionCalls: (row.function_calls ?? []).map((c) => ({
      name: c.name,
      arguments: c.arguments,
      stagedActionId: c.staged_action_id,
      outcome: c.outcome,
    })),
    events: events.map((e) => ({
      id: e.id,
      type: e.event_type,
      payload: e.payload,
      createdAt: e.created_at,
    })),
    live: row.status === "ringing" || row.status === "in_progress",
  };
}
