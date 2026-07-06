"use client";

// The fake-live chat feed (PA-POS-38 §24.4). Seeded messages fire from the registry when the
// position crosses their trigger; the attendee's own messages log to the server for Chase's
// later review and appear only in THEIR feed, followed by the scripted auto-reply. No live
// moderation, no attendee-to-attendee visibility (§24.8).

import { useEffect, useMemo, useRef, useState } from "react";
import type { WorkshopChatSegment } from "@/data/workshop/chat-script";
import { CHAT_AUTO_REPLY, dueChatMessages } from "@/lib/workshop/live";
import { WORKSHOP_COPY } from "@/lib/workshop/copy";

type FeedMessage = {
  key: string;
  name: string;
  seed: string;
  message: string;
  own?: boolean;
  host?: boolean;
};

function avatarHue(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return h;
}

function Avatar({ seed, name }: { seed: string; name: string }) {
  const hue = avatarHue(seed);
  return (
    <span
      aria-hidden
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white/90"
      style={{ background: `hsl(${hue} 45% 32%)` }}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function WorkshopChatFeed({ segment, positionSec, registrationId, allowInput }: {
  segment: WorkshopChatSegment;
  positionSec: number;
  registrationId: string;
  allowInput: boolean;
}) {
  const [ownMessages, setOwnMessages] = useState<FeedMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [senderName, setSenderName] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("pa-workshop-chat-name");
      if (saved) setSenderName(saved);
    } catch {
      // storage blocked — the name field just starts empty
    }
  }, []);

  const scripted = useMemo<FeedMessage[]>(
    () =>
      dueChatMessages(segment, positionSec).map((m) => ({
        key: `s-${m.segment}-${m.trigger_sec}-${m.avatar_seed}`,
        name: m.attendee_name,
        seed: m.avatar_seed,
        message: m.message,
      })),
    [segment, positionSec],
  );

  const feed = useMemo(() => [...scripted, ...ownMessages], [scripted, ownMessages]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [feed.length]);

  async function send() {
    const message = draft.trim();
    const name = senderName.trim() || "You";
    if (!message || sending) return;
    setSending(true);
    setDraft("");
    try {
      window.localStorage.setItem("pa-workshop-chat-name", name);
    } catch {
      // storage blocked — nothing to persist
    }
    setOwnMessages((prev) => [
      ...prev,
      { key: `o-${prev.length}-${message.slice(0, 12)}`, name, seed: `own-${name}`, message, own: true },
    ]);
    const res = await fetch("/api/workshop/chat-messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ registration_id: registrationId, sender_name: name, message }),
    }).catch(() => null);
    if (!res || !res.ok) {
      setOwnMessages((prev) => [
        ...prev,
        {
          key: `e-${prev.length}`,
          name: "Pocket Agent",
          seed: "host-pa",
          message: "That message didn't send — try it again.",
          host: true,
        },
      ]);
      setSending(false);
      return;
    }
    window.setTimeout(() => {
      setOwnMessages((prev) => [
        ...prev,
        { key: `r-${prev.length}`, name: "Chase (host)", seed: "host-chase", message: CHAT_AUTO_REPLY, host: true },
      ]);
    }, 1400);
    setSending(false);
  }

  return (
    <div className="flex h-full min-h-0 flex-col rounded-2xl border border-white/10 bg-white/[0.02]">
      <div className="border-b border-white/10 px-4 py-2 text-xs font-semibold text-slate-300">
        Session chat
      </div>
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {feed.map((m) => (
          <div key={m.key} className="flex items-start gap-2">
            <Avatar seed={m.seed} name={m.name} />
            <div>
              <span className={`text-xs font-semibold ${m.host ? "text-cyan-300" : m.own ? "text-slate-100" : "text-slate-300"}`}>
                {m.name}
              </span>
              <p className="text-sm leading-snug text-slate-200">{m.message}</p>
            </div>
          </div>
        ))}
        {feed.length === 0 ? (
          <p className="text-xs text-slate-500">Chat opens as the room fills.</p>
        ) : null}
      </div>
      {allowInput ? (
        <div className="border-t border-white/10 p-3">
          <div className="flex gap-2">
            <input
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              placeholder="Your name"
              className="w-24 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-2 text-xs text-slate-100 outline-none focus:border-accent/60"
            />
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void send();
              }}
              placeholder={WORKSHOP_COPY.player.chatPlaceholder}
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-100 outline-none focus:border-accent/60"
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={sending}
              className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground disabled:opacity-60"
            >
              Send
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
