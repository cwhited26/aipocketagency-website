"use client";

import { useEffect, useState } from "react";

type State =
  | { kind: "loading" }
  | { kind: "ready"; personaName: string; chatUrl: string }
  | { kind: "error"; message: string };

export default function AcceptClient({ token }: { token: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    fetch("/api/personas/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (r) => {
        const body = (await r.json().catch(() => ({}))) as {
          personaName?: string;
          chatUrl?: string;
          error?: string;
        };
        if (!r.ok || !body.chatUrl || !body.personaName) {
          throw new Error(body.error ?? "This invite link is no longer valid.");
        }
        setState({ kind: "ready", personaName: body.personaName, chatUrl: body.chatUrl });
      })
      .catch((e: unknown) =>
        setState({ kind: "error", message: e instanceof Error ? e.message : "Something went wrong" }),
      );
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#05070a] text-slate-100 px-6">
      <div className="text-center max-w-sm">
        {state.kind === "loading" && <p className="text-slate-500 text-sm">Setting up your access…</p>}
        {state.kind === "error" && (
          <>
            <h1 className="text-lg font-semibold">Invite unavailable</h1>
            <p className="text-sm text-slate-500 mt-2">{state.message}</p>
          </>
        )}
        {state.kind === "ready" && (
          <>
            <h1 className="text-lg font-semibold">You&apos;re in.</h1>
            <p className="text-sm text-slate-500 mt-2">
              You now have access to <strong className="text-slate-300">{state.personaName}</strong>.
            </p>
            <a
              href={state.chatUrl}
              className="inline-block mt-6 rounded-lg bg-[#22d3ee] text-[#06222a] text-sm font-semibold px-5 py-2.5 hover:bg-[#67e8f9] transition-colors"
            >
              Start chatting
            </a>
            <p className="text-[11px] text-slate-600 mt-6">
              Bookmark the next page — it&apos;s your personal link to {state.personaName}.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
