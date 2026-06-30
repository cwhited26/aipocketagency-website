// Pure queue-prune logic. Synced items are kept for a retention window (so a brief outage or a
// re-sync can still see them) then dropped. Selecting WHICH ids to prune is pure and unit-tested;
// the actual DELETE lives in db/queue.ts.

export const DEFAULT_RETENTION_DAYS = 7;

export interface PrunableRow {
  id: number;
  synced: boolean;
  /** ISO timestamp of when the row was marked synced, or null if never synced. */
  syncedAt: string | null;
}

/**
 * Return the ids of rows safe to prune: synced, with a valid syncedAt at least `retentionDays` old.
 * Unsynced rows, rows missing syncedAt, and rows with an unparseable timestamp are always kept.
 */
export function selectPrunableIds(
  rows: readonly PrunableRow[],
  now: Date,
  retentionDays: number = DEFAULT_RETENTION_DAYS,
): number[] {
  const cutoff = now.getTime() - retentionDays * 24 * 60 * 60 * 1000;
  const out: number[] = [];
  for (const row of rows) {
    if (!row.synced || !row.syncedAt) continue;
    const t = Date.parse(row.syncedAt);
    if (Number.isNaN(t)) continue;
    if (t <= cutoff) out.push(row.id);
  }
  return out;
}
