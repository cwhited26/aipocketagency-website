import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import CopyButton from "./CopyButton";

export const dynamic = "force-dynamic";

// The 10 steps the owner builds in Apple's Shortcuts app to snap a photo and get an answer back.
const STEPS: { title: string; detail: string }[] = [
  {
    title: "Open the Shortcuts app and tap +",
    detail: "On your iPhone, open Shortcuts (it comes with iOS). Tap the + in the top-right to start a new one. Name it something like “Ask my agent.”",
  },
  {
    title: "Let it accept a photo",
    detail: "Tap the info (ⓘ) icon, turn on “Show in Share Sheet,” and set “Share Sheet Types” to Images and PDFs. Now the shortcut shows up when you share a photo or screenshot.",
  },
  {
    title: "Add “Ask for Input” (optional note)",
    detail: "Add the action “Ask for Input,” set it to Text, and make the prompt “Anything to add?” This is where you can type a question like “What’s this invoice for?” Leave it blank to just send the photo.",
  },
  {
    title: "Add “Text” for your API key",
    detail: "Add a “Text” action and paste your Pocket Agent API key into it (the pa_live_… key from the page before this one). You’ll point at this in the next step.",
  },
  {
    title: "Add “Get Contents of URL”",
    detail: "Add the action “Get Contents of URL.” This is the action that sends your photo to your agent.",
  },
  {
    title: "Paste your endpoint URL",
    detail: "In “Get Contents of URL,” paste the address shown above this list as the URL.",
  },
  {
    title: "Set the method to POST",
    detail: "Expand the action, change Method to POST.",
  },
  {
    title: "Add the Authorization header",
    detail: "Under Headers, add one header. Key: Authorization. Value: type “Bearer ” (with a space), then insert the Text action holding your API key.",
  },
  {
    title: "Set the request body to Form",
    detail: "Set Request Body to Form. Add a field named file and set its value to the Shortcut Input (the photo). Add a second field named prompt and set its value to the “Ask for Input” text from step 3.",
  },
  {
    title: "Show the reply",
    detail: "Add a final action: “Show Result,” and set it to the “Contents of URL” output. Now share any photo to this shortcut and your agent’s answer pops up on your phone.",
  },
];

export default async function ShortcutGuidePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://aipocketagent.com").replace(/\/$/, "");
  const endpoint = `${base}/api/mobile/capture`;

  return (
    <div className="h-full overflow-y-auto bg-[#06080b]">
      <div className="max-w-lg mx-auto px-6 py-10 space-y-7">
        <div>
          <a
            href="/app/settings/api-keys"
            className="text-xs text-slate-600 hover:text-slate-400 transition-colors font-mono"
          >
            ← API keys
          </a>
          <div className="text-[11px] text-[#22d3ee]/60 font-mono tracking-[0.18em] uppercase mt-3 mb-1">
            iPhone shortcut
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Snap a photo, get an answer</h1>
          <p className="text-sm text-slate-400 mt-2 leading-relaxed">
            Build a one-tap shortcut on your iPhone so you can share any photo, screenshot, or PDF
            straight to your agent — a receipt, a whiteboard, a business card, an invoice — and get a
            reply back on your phone. It reads the picture, pulls out the text, files it in your
            Documents, and answers. Takes about five minutes to set up, once.
          </p>
        </div>

        <div className="rounded-xl border border-slate-700/60 bg-[#0a0e14] p-5 space-y-3">
          <div className="text-xs text-slate-400 font-semibold uppercase tracking-wide">
            Your endpoint URL
          </div>
          <div className="flex items-center gap-3">
            <code className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-xs text-[#22d3ee] break-all">
              {endpoint}
            </code>
            <CopyButton value={endpoint} />
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            You’ll paste this into the shortcut in step 6. It accepts one image or PDF (PNG, JPG,
            WebP, HEIC, GIF, or PDF, up to 10&nbsp;MB) plus an optional note.
          </p>
        </div>

        <ol className="space-y-4">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-4">
              <span className="flex-none mt-0.5 flex h-7 w-7 items-center justify-center rounded-full border border-[#22d3ee]/40 text-xs font-bold text-[#22d3ee]">
                {i + 1}
              </span>
              <div>
                <div className="text-sm font-semibold text-slate-100">{step.title}</div>
                <p className="text-sm text-slate-400 mt-1 leading-relaxed">{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="rounded-xl border border-slate-700/60 bg-[#0a0e14] p-5">
          <div className="text-sm font-semibold text-slate-100">A couple of tips</div>
          <ul className="mt-2 space-y-1.5 text-sm text-slate-400 leading-relaxed list-disc pl-5">
            <li>Add the shortcut to your Home Screen or Back Tap for even faster capture.</li>
            <li>
              Everything you send shows up in your{" "}
              <a href="/app/agent" className="text-[#22d3ee] hover:underline">
                Mobile capture thread
              </a>{" "}
              and your Documents, so you can pick the conversation back up on the web.
            </li>
            <li>If a key ever leaks, revoke it on the API keys page and generate a new one.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
