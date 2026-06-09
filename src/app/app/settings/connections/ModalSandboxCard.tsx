// ModalSandboxCard.tsx — the Build Tools section card for code execution (Build Tools Roadmap
// §9.1, task item 2). Unlike the productivity connectors, this is PLATFORM infrastructure: the
// owner doesn't connect anything. It runs on Pocket Agent's own secure execution environment, so
// the card is status-only — explanatory copy, no Connect button, no setup.
//
// Server component: `configured` is read from the runtime config on the server and passed in.

function SandboxIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="2.6" width="12" height="10.8" rx="1.6" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M4.6 6.2 6.4 8l-1.8 1.8M8 9.8h3"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function ModalSandboxCard({ configured }: { configured: boolean }) {
  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 px-5 py-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-[#a78bfa]">
            <SandboxIcon />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-100">Code Execution (Modal Sandbox)</p>
            <p className="text-[11px] text-slate-500 font-mono tracking-wide">Build Tools</p>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${
            configured
              ? "bg-[#22d3ee]/10 text-[#22d3ee] border border-[#22d3ee]/25"
              : "bg-slate-800/60 text-slate-400 border border-slate-700/60"
          }`}
        >
          {configured ? "Built in" : "Comes with your plan"}
        </span>
      </div>

      <p className="text-sm text-slate-300 leading-relaxed">
        When your agent builds something — a website, an app, an automation — it sometimes needs to
        run a real command, like installing the project or running its tests. It does that in a
        fresh, throwaway workspace that exists only for that one job and is thrown away the moment
        it’s done. Nothing runs on your computer, and nothing is left behind.
      </p>

      <p className="text-sm text-slate-400 leading-relaxed">
        There’s nothing to connect — this comes built in. Before any command runs, you’ll see it in
        your Inbox with one tap to approve. Anything unusual — a command that reaches out to the
        internet or could delete files — always asks you every single time, no matter how many
        you’ve approved before.
      </p>
    </div>
  );
}
