// Settings → Mac Capture App. Download + setup surface for the Pocket Agent Capture menu-bar app
// (PA-CAPTURE-MAC v0.1). The app watches the clipboard + screenshot folders and syncs captures to
// the brain via POST /api/capture/mac-sync, authenticating with the user's personal API token (the
// same pca_ token the iOS Shortcut uses, minted at Captures → Settings).
//
// The DMG is served from /downloads/pa-capture-mac.dmg once Chase signs + hosts the build (handoff).

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const DMG_PATH = "/downloads/pa-capture-mac.dmg";

const STEPS: { title: string; body: string }[] = [
  {
    title: "1 · Install the app",
    body: "Download the DMG, open it, and drag Pocket Agent Capture into Applications. Launch it — a small icon appears in your menu bar.",
  },
  {
    title: "2 · Paste your API token",
    body: "In the menu-bar popover, open Settings and paste your personal API token. Mint one at Captures → Settings → API tokens (it's shown once). The token is stored in your macOS Keychain, never on disk.",
  },
  {
    title: "3 · Grant macOS permissions",
    body: "macOS will ask for Accessibility (to read the active app's name for allow/deny rules) and Files & Folders access (to watch your Screenshots and Desktop folders). Both are optional — capture still works without them, just with less context.",
  },
  {
    title: "4 · Choose what to capture",
    body: "Toggle the clipboard and screenshot watchers on or off, and set per-app allow/deny rules (deny 1Password, banking, etc.). Use Pause for an hour, or Quit, any time. Captures land in your brain inbox and show up at Captures.",
  },
];

export default async function MacAppSettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  return (
    <div className="h-full overflow-y-auto bg-[#06080b]">
      <div className="max-w-lg mx-auto px-6 py-10 space-y-8">
        <div>
          <a href="/app/settings" className="text-sm text-[#22d3ee] hover:underline">
            ← Settings
          </a>
          <div className="text-[11px] text-[#22d3ee]/60 font-mono tracking-[0.18em] uppercase mb-1 mt-4">
            Mac Capture App
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Auto-capture on your Mac</h1>
          <p className="text-sm text-slate-300 leading-relaxed mt-2">
            A menu-bar app that quietly watches your clipboard and screenshots and files them into your
            brain — no copy-paste, no forwarding. Free with any Pocket Agent plan, including the $47
            Capture standalone.
          </p>
        </div>

        {/* Download */}
        <div className="rounded-xl border border-[#22d3ee]/25 bg-[#22d3ee]/5 px-5 py-5 space-y-3">
          <p className="text-sm font-semibold text-slate-100">Download for macOS</p>
          <p className="text-sm text-slate-300 leading-relaxed">
            Universal build (Apple Silicon + Intel), macOS 12 or later.
          </p>
          <a
            href={DMG_PATH}
            className="inline-flex items-center rounded-lg bg-[#22d3ee] px-4 py-2 text-sm font-semibold text-[#031820] hover:bg-[#06b6d4] transition-colors"
          >
            Download .dmg →
          </a>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            First launch: right-click the app → Open to bypass Gatekeeper until the notarized build is
            published.
          </p>
        </div>

        {/* Setup steps */}
        <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 overflow-hidden divide-y divide-slate-800/60">
          {STEPS.map((step) => (
            <div key={step.title} className="px-5 py-4 space-y-1">
              <p className="text-sm font-semibold text-slate-100">{step.title}</p>
              <p className="text-sm text-slate-300 leading-relaxed">{step.body}</p>
            </div>
          ))}
        </div>

        {/* Privacy note */}
        <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 px-5 py-4 space-y-1">
          <p className="text-sm font-semibold text-slate-100">Your privacy</p>
          <p className="text-sm text-slate-300 leading-relaxed">
            Nothing leaves your Mac until it syncs to your own brain repo. Deny-list any app you never
            want read, and the kill switch quits instantly. The app never captures from apps on your
            deny list, and an allow list (when set) limits capture to only the apps you choose.
          </p>
        </div>
      </div>
    </div>
  );
}
