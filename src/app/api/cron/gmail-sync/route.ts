import { NextResponse } from "next/server";
import {
  fetchActiveGmailConnections,
  markGmailConnectionError,
  updateGmailSyncCursor,
  type GmailConnectionFull,
} from "@/lib/pa-gmail-connections";
import {
  ensureFreshAccessToken,
  getProfile,
  getMessageMeta,
  listHistoryAdded,
  listRecentInboxMessages,
} from "@/lib/gmail";
import {
  createInboxItem,
  fetchGmailTriageThreadIds,
} from "@/lib/pa-inbox-items";
import { notifyConnectionReauthNeeded } from "@/lib/connectors/system";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_PER_CYCLE = 50;

type SyncResult = {
  userId: string;
  status: "ok" | "skipped" | "error";
  staged?: number;
  reason?: string;
};

function isDuplicate(status: number, error: string): boolean {
  return status === 409 || error.includes("23505") || error.includes("duplicate key");
}

// Collect the new inbox message refs for one connection, plus the historyId to
// persist as the next cursor. First run (no cursor, or a cursor Gmail rejects as
// too old) falls back to a recent 7-day window seeded by the profile historyId.
async function collectNewMessages(
  conn: GmailConnectionFull,
  accessToken: string,
): Promise<
  | { ok: true; messages: { id: string; threadId: string }[]; nextHistoryId: string | null }
  | { ok: false; authError: boolean; error: string }
> {
  if (conn.last_sync_history_id) {
    const history = await listHistoryAdded(accessToken, conn.last_sync_history_id, MAX_PER_CYCLE);
    if (history.ok) {
      return { ok: true, messages: history.data.messages, nextHistoryId: history.data.historyId };
    }
    // 404 → the stored historyId aged out of Gmail's window; reseed below.
    if (history.status !== 404) {
      return { ok: false, authError: history.authError, error: history.error };
    }
  }

  // First run (or reseed): recent window + a fresh historyId from the profile.
  const recent = await listRecentInboxMessages(accessToken, MAX_PER_CYCLE);
  if (!recent.ok) return { ok: false, authError: recent.authError, error: recent.error };
  const profile = await getProfile(accessToken);
  const nextHistoryId = profile.ok ? profile.data.historyId ?? null : null;
  return { ok: true, messages: recent.data, nextHistoryId };
}

function buildThreadUrl(threadId: string): string {
  return `https://mail.google.com/mail/u/0/#inbox/${threadId}`;
}

function receivedAtIso(internalDate: string | null): string | null {
  if (!internalDate) return null;
  const ms = Number(internalDate);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

async function syncConnection(conn: GmailConnectionFull): Promise<SyncResult> {
  const token = await ensureFreshAccessToken(conn);
  if (!token.ok) {
    if (token.authError) {
      await markGmailConnectionError(conn.id);
      // OAuth refresh failed — the connection needs re-authorization. Email the owner a reconnect
      // link. Best-effort + idempotent (connection_reauth:<connectionId>) so a failing sync cron
      // pings once, not every 5 minutes; the Connections card is the durable signal.
      const notice = await notifyConnectionReauthNeeded({
        userId: conn.user_id,
        connector: "Gmail",
        connectionId: conn.id,
        toEmail: conn.email,
      });
      if (!notice.ok) {
        console.error("[cron/gmail-sync] reauth email failed", {
          userId: conn.user_id,
          connectionId: conn.id,
          status: notice.status,
          error: notice.error,
        });
      }
    }
    return { userId: conn.user_id, status: "error", reason: `auth: ${token.error}` };
  }

  const collected = await collectNewMessages(conn, token.data);
  if (!collected.ok) {
    if (collected.authError) await markGmailConnectionError(conn.id);
    return { userId: conn.user_id, status: "error", reason: collected.error };
  }

  const seenResult = await fetchGmailTriageThreadIds(conn.user_id);
  if (!seenResult.ok) {
    return { userId: conn.user_id, status: "error", reason: seenResult.error };
  }
  const seen = seenResult.data;

  // One triage item per thread: dedup against already-staged threads and within
  // this batch, capped at MAX_PER_CYCLE.
  const newThreads: { id: string; threadId: string }[] = [];
  const batchSeen = new Set<string>();
  for (const m of collected.messages) {
    if (seen.has(m.threadId) || batchSeen.has(m.threadId)) continue;
    batchSeen.add(m.threadId);
    newThreads.push(m);
    if (newThreads.length >= MAX_PER_CYCLE) break;
  }

  let staged = 0;
  for (const t of newThreads) {
    const meta = await getMessageMeta(token.data, t.id);
    if (!meta.ok) {
      if (meta.authError) {
        await markGmailConnectionError(conn.id);
        return { userId: conn.user_id, status: "error", reason: meta.error, staged };
      }
      continue; // skip a single unreadable message, keep going
    }
    if (!meta.data.inInbox) continue; // archived between list and fetch

    const receivedAt = receivedAtIso(meta.data.internalDate);
    const created = await createInboxItem({
      userId: conn.user_id,
      kind: "email_triage",
      title: meta.data.subject || "(no subject)",
      bodyMd: meta.data.snippet || null,
      source: "gmail",
      payload: {
        threadId: meta.data.threadId,
        from: meta.data.from,
        subject: meta.data.subject,
        snippet: meta.data.snippet,
        url: buildThreadUrl(meta.data.threadId),
        receivedAt,
        // Threading metadata so a drafted reply sends back into this conversation:
        // messageId is the Gmail API id, rfcMessageId the RFC 2822 Message-ID that
        // becomes the reply's In-Reply-To / References headers.
        messageId: meta.data.id,
        rfcMessageId: meta.data.rfcMessageId,
      },
    });
    if (created.ok) {
      staged += 1;
    } else if (!isDuplicate(created.status, created.error)) {
      return { userId: conn.user_id, status: "error", reason: created.error, staged };
    }
    // Duplicate (unique-index race) → silently skip, it is already staged.
  }

  const cursor = await updateGmailSyncCursor(conn.id, {
    lastSyncAt: new Date().toISOString(),
    lastSyncHistoryId: collected.nextHistoryId,
  });
  if (!cursor.ok) {
    return { userId: conn.user_id, status: "error", reason: cursor.error, staged };
  }

  return { userId: conn.user_id, status: "ok", staged };
}

export async function GET(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const activeResult = await fetchActiveGmailConnections();
  if (!activeResult.ok) {
    return NextResponse.json({ error: activeResult.error }, { status: activeResult.status });
  }

  const results: SyncResult[] = [];
  for (const conn of activeResult.data) {
    try {
      results.push(await syncConnection(conn));
    } catch (e) {
      // One connection failing must not crash the whole job.
      results.push({
        userId: conn.user_id,
        status: "error",
        reason: e instanceof Error ? e.message : "unexpected error",
      });
    }
  }

  const stagedTotal = results.reduce((n, r) => n + (r.staged ?? 0), 0);
  return NextResponse.json({ processed: results.length, staged: stagedTotal, results });
}
