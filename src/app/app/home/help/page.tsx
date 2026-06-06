import { redirect } from "next/navigation";
import { chatAsHomeEnabled, TABBED_HOME_PATH } from "@/lib/chat/feature-flag";
import { SLASH_COMMANDS } from "@/lib/chat/filters";

export const dynamic = "force-dynamic";

// /app/home/help — the documented slash-command reference, generated from the single
// command registry so it can never drift from what the parser accepts.
export default function ChatHelpPage() {
  if (!chatAsHomeEnabled()) {
    redirect(TABBED_HOME_PATH);
  }

  return (
    <div className="h-screen overflow-y-auto bg-[#06080b] text-slate-100">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <a href="/app/home" className="text-[12px] font-mono text-[#22d3ee] hover:underline">
          ← Back to chat
        </a>
        <div className="mt-4 mb-2 text-[#22d3ee] text-[10px] font-mono tracking-[0.22em] uppercase">
          Pocket Agent · Commands
        </div>
        <h1 className="text-2xl font-bold">Slash commands</h1>
        <p className="text-slate-400 text-sm mt-2 leading-relaxed">
          Type <span className="font-mono text-slate-300">/</span> in the chat to filter your
          history, jump to a tool, or take an action. You can also click any item in the left
          rail — it does the same thing.
        </p>

        <div className="mt-6 space-y-2">
          {SLASH_COMMANDS.map((cmd) => (
            <div
              key={cmd.name}
              className="flex items-start gap-4 rounded-xl border border-slate-800/60 bg-slate-900/40 px-4 py-3"
            >
              <code className="shrink-0 font-mono text-sm text-[#22d3ee] w-32">/{cmd.name}</code>
              <div className="min-w-0">
                <p className="text-sm text-slate-200">{cmd.description}</p>
                {cmd.aliases.length > 0 && (
                  <p className="text-[11px] font-mono text-slate-600 mt-0.5">
                    also: {cmd.aliases.map((a) => `/${a}`).join(", ")}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-xl border border-slate-800/60 bg-slate-900/40 px-4 py-4">
          <p className="text-sm font-medium text-slate-200">Natural-language actions</p>
          <ul className="mt-2 space-y-1.5 text-sm text-slate-400">
            <li>
              <span className="font-mono text-slate-300">add to memory: …</span> — save a note to
              your brain
            </li>
            <li>
              <span className="font-mono text-slate-300">ask my &lt;persona&gt;: …</span> — route a
              question to one of your personas
            </li>
            <li>
              <span className="font-mono text-slate-300">/capture voice</span> — record a voice memo
              inline
            </li>
            <li>
              <span className="font-mono text-slate-300">/upload</span> — attach a file as a preview
              card
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
