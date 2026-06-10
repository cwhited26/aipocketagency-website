// sweep.ts — the Ritual Scheduler sweep helper (SPEC §6, PA-RITUAL-4).
//
// The `*/5` cron (/api/cron/rituals) calls sweepDueRituals every five minutes: pull the enabled rituals
// whose next_run_at is due (next-run polling, the same pattern Podcast Watch and Follow-Up Sweeps use)
// and run each one. One ritual failing doesn't sink the sweep — runRitual records its own failed run and
// advances its cursor, and the loop continues. Service-role throughout (the cron has no user session);
// each ritual carries the owner_id the run threads through.

import { fetchDueRituals } from "./db";
import { runRitual, type RitualRunReport } from "./run";

export type SweepReport = {
  due: number;
  ran: RitualRunReport[];
};

type SweepResult = { ok: true; data: SweepReport } | { ok: false; status: number; error: string };

/** Run every due ritual. A per-ritual throw is contained so one bad ritual can't stop the sweep. */
export async function sweepDueRituals(limit = 50): Promise<SweepResult> {
  const due = await fetchDueRituals(limit);
  if (!due.ok) return { ok: false, status: due.status, error: due.error };

  const ran: RitualRunReport[] = [];
  for (const ritual of due.data) {
    try {
      ran.push(await runRitual(ritual));
    } catch (e) {
      ran.push({
        ritualId: ritual.id,
        status: "failed",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return { ok: true, data: { due: due.data.length, ran } };
}
