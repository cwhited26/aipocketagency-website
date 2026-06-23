// POST /capture/share — the PWA Web Share Target endpoint (PC-CORE-1, Pocket Capture standalone).
//
// public/manifest.webmanifest registers this URL as a `share_target`. When the owner taps "Pocket
// Agent" in the iOS / Android native share sheet, the browser navigates here with a
// `multipart/form-data` POST carrying { title, text, url, files[] }. We:
//   1. resolve the owner from their PWA cookie session (no session → a friendly "log in first" page),
//   2. parse the multipart form into normalized fields + files,
//   3. dedup re-fires (identical share inside a 5-second bucket is a no-op),
//   4. store any attached image/PDF through the canonical capture pipeline (absorbToMemory),
//   5. append the combined body to the owner's Capture Inbox (memory/inbox.md), tagged
//      source="share_sheet" so the dashboard can show the share icon,
//   6. return a small HTML page that confirms + auto-closes, bouncing the user back to their app.
//
// Reuses the existing Capture Inbox write path (fetchFileContent + appendEntryToRaw +
// commitMemoryFile) exactly as /api/app/share/inbox does — this lane adds a surface, not a backend.

import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { fetchFileContent, commitMemoryFile } from "@/lib/pa-brain";
import { appendEntryToRaw } from "@/lib/pa-inbox";
import { absorbToMemory } from "@/lib/brain/absorb";
import {
  parseShareForm,
  buildCaptureBody,
  pickShareKind,
  type ParsedShare,
} from "@/lib/capture-share/parse";
import { computeIdempotencyKey, markAndCheckDuplicate } from "@/lib/capture-share/idempotency";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INBOX_PATH = "memory/inbox.md";
const SHARE_SOURCE = "share_sheet";

// ─── HTML responses (this endpoint is hit as a navigation, so it renders a page) ──────────────

function htmlResponse(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function page(opts: {
  heading: string;
  message: string;
  tone: "ok" | "error";
  autoClose: boolean;
  cta?: { href: string; label: string };
}): string {
  const accent = opts.tone === "ok" ? "#22d3ee" : "#f87171";
  const closeScript = opts.autoClose
    ? `<script>setTimeout(function(){try{window.close();}catch(e){}},2000);</script>`
    : "";
  const cta = opts.cta
    ? `<a href="${opts.cta.href}" style="display:inline-block;margin-top:20px;color:#05070a;background:${accent};padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">${opts.cta.label}</a>`
    : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pocket Agent — Capture</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#05070a;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<main style="text-align:center;padding:32px;max-width:420px">
<div style="font-size:48px;line-height:1">${opts.tone === "ok" ? "✓" : "⚠"}</div>
<h1 style="font-size:22px;margin:16px 0 8px;color:${accent}">${opts.heading}</h1>
<p style="font-size:15px;line-height:1.5;color:#94a3b8;margin:0">${opts.message}</p>
${cta}
</main>${closeScript}</body></html>`;
}

// ─── Attachment handling ──────────────────────────────────────────────────────────
// Run each shared file through the canonical capture pipeline (store to assets/ + absorb into
// memory when an Anthropic key is present). Never throws — a failed file becomes a note line, not a
// failed capture. Returns the human-readable lines to append to the inbox body.

async function storeSharedFiles(
  parsed: ParsedShare,
  ctx: { repo: string; token: string; anthropicApiKey: string | null },
): Promise<string[]> {
  const lines: string[] = [];

  for (const skip of parsed.skipped) {
    lines.push(
      `• ${skip.fileName} — skipped (${skip.reason === "too-large" ? "over 10 MB" : "empty file"})`,
    );
  }

  for (const file of parsed.files) {
    const result = await absorbToMemory({
      repo: ctx.repo,
      token: ctx.token,
      anthropicApiKey: ctx.anthropicApiKey,
      fileName: file.fileName,
      mimeType: file.mimeType,
      buffer: file.buffer,
    });
    if (result.ok) {
      lines.push(
        `• ${file.fileName} — saved to Documents${result.absorbed ? " + absorbed into memory" : ""}`,
      );
    } else {
      console.error("[capture/share] attachment store failed", {
        fileName: file.fileName,
        error: result.error,
      });
      lines.push(`• ${file.fileName} — could not be saved`);
    }
  }

  return lines;
}

// ─── POST handler ───────────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  // 1. Resolve the owner from the PWA cookie session.
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return htmlResponse(
      page({
        heading: "Log in first",
        message:
          "Sign in to Pocket Agent in this app, then share again to save it to your brain.",
        tone: "error",
        autoClose: false,
        cta: { href: "/app/login?next=/capture/share", label: "Log in" },
      }),
      401,
    );
  }

  // 2. The share sheet always POSTs multipart/form-data.
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return htmlResponse(
      page({
        heading: "Couldn't save",
        message: "That share arrived in a format we couldn't read. Try again.",
        tone: "error",
        autoClose: false,
      }),
      400,
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch (err) {
    console.error("[capture/share] could not read multipart form", {
      ownerId: user.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return htmlResponse(
      page({
        heading: "Couldn't save — try again",
        message: "We couldn't read what you shared. Give it another tap.",
        tone: "error",
        autoClose: false,
      }),
      400,
    );
  }

  const parsed = await parseShareForm(form);
  const body = buildCaptureBody(parsed);
  if (!body && parsed.files.length === 0) {
    return htmlResponse(
      page({
        heading: "Nothing to capture",
        message: "That share didn't include any text, link, or file.",
        tone: "error",
        autoClose: false,
      }),
      400,
    );
  }

  // 3. Resolve the owner's brain. A capture has nowhere to land without a connected brain repo.
  const paResult = await fetchPaUser(user.id);
  if (!paResult.ok || !paResult.data) {
    console.error("[capture/share] could not load account", { ownerId: user.id });
    return htmlResponse(
      page({
        heading: "Couldn't save — try again",
        message: "We couldn't load your account just now. Give it another try shortly.",
        tone: "error",
        autoClose: false,
      }),
      500,
    );
  }
  const paUser = paResult.data;
  if (!paUser.brain_repo || !paUser.github_token) {
    return htmlResponse(
      page({
        heading: "Connect your brain first",
        message: "Finish setup in Pocket Agent, then share again to start capturing.",
        tone: "error",
        autoClose: false,
        cta: { href: "/app", label: "Open Pocket Agent" },
      }),
      400,
    );
  }
  const { brain_repo: repo, github_token: ghToken, anthropic_api_key: anthropicApiKey } = paUser;

  // 4. Dedup re-fires: an identical share inside the same 5-second bucket is a no-op.
  const nowMs = Date.now();
  const idempotencyKey = computeIdempotencyKey({
    ownerId: user.id,
    title: parsed.title,
    text: parsed.text,
    url: parsed.url,
    nowMs,
  });
  if (markAndCheckDuplicate(idempotencyKey, nowMs)) {
    return htmlResponse(
      page({
        heading: "Already saved",
        message: "We just captured that one — no need to save it twice.",
        tone: "ok",
        autoClose: true,
      }),
      200,
    );
  }

  // 5. Store any attached files through the canonical capture pipeline.
  const fileLines = await storeSharedFiles(parsed, { repo, token: ghToken, anthropicApiKey });

  // 6. Build the inbox body: combined text fields, plus a note about any stored files. A files-only
  //    share (no text) uses the file lines as the body so the entry is never empty.
  const finalContent = [body, fileLines.length > 0 ? fileLines.join("\n") : ""]
    .filter(Boolean)
    .join("\n\n")
    .trim();

  // 7. Append to the Capture Inbox (memory/inbox.md) — the same write path as /api/app/share/inbox.
  const existing = await fetchFileContent(repo, INBOX_PATH, ghToken);
  const { content: nextInbox } = appendEntryToRaw(existing, {
    kind: pickShareKind(parsed),
    content: finalContent || "(shared item)",
    ...(parsed.title ? { title: parsed.title } : {}),
    ...(parsed.url ? { sourceUrl: parsed.url } : {}),
    source: SHARE_SOURCE,
  });

  const commitResult = await commitMemoryFile({
    repo,
    token: ghToken,
    path: INBOX_PATH,
    mode: "replace",
    content: nextInbox,
    commitMessage: "Pocket Agent — share sheet capture",
  });

  if (!commitResult.ok) {
    console.error("[capture/share] inbox commit failed", {
      ownerId: user.id,
      error: commitResult.error,
    });
    return htmlResponse(
      page({
        heading: "Couldn't save — try again",
        message: "We hit a snag saving that to your brain. Give it another tap.",
        tone: "error",
        autoClose: false,
      }),
      500,
    );
  }

  // 8. Confirm + auto-close so the user bounces back to whatever app they shared from.
  return htmlResponse(
    page({
      heading: "Saved to your brain",
      message: "Captured. This window will close on its own.",
      tone: "ok",
      autoClose: true,
      cta: { href: "/app/capture", label: "View captures" },
    }),
    200,
  );
}
