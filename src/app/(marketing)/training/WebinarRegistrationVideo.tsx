import { MONO_FONT } from "@/components/marketing/cta";

// The 60–90s registration video (Part 3A "Webinar Registration Page Video Script"). Until the recorded
// video is produced, this renders the script verbatim inside a video-frame placeholder so the page is
// real, not a TODO. Swap the placeholder for the embed once the video URL exists (WEBINAR_INTRO_VIDEO).
const SCRIPT_LINES: string[] = [
  "Everyone is telling business owners the same thing right now.",
  "Use AI agents.",
  "Automate your business.",
  "Use AI for sales, admin, content, follow-up, lead research, and operations.",
  "Cool.",
  "How?",
  "Most business owners do not want to learn APIs.",
  "They do not want to build automations from scratch.",
  "They do not want to hire an AI consultant every time they need a new workflow.",
  "And they do not want another blank chatbot that forgets their business every time they open it.",
  "That is why we built Pocket Agent.",
  "Pocket Agent is the AI Agent Workspace for owner-led businesses.",
  "It gives you one place to build your Business Brain, create trained Personas, use workflow Apps, and review everything from Mission Control.",
  "Your Business Brain is your company memory in markdown, stored in your own git repo.",
  "Your Personas are the trained AI roles.",
  "Your Apps are the workflow tools those Personas use.",
  "Mission Control is where you approve the work.",
  "On this training, I'll show you how to build your AI team without becoming technical.",
  "You'll see the first three Personas to create, the first workflows to install, and how to keep everything under your control.",
  "Generic AI starts from zero.",
  "Pocket Agent starts from your business.",
  "Click the button and save your seat.",
];

export function WebinarRegistrationVideo() {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/40">
        <div className="flex aspect-video items-center justify-center bg-gradient-to-br from-cyan-500/10 to-transparent">
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-accent/15 text-accent ring-1 ring-accent/30">
              <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor" aria-hidden>
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
            <span
              className="text-xs uppercase tracking-wider text-slate-400"
              style={{ fontFamily: MONO_FONT }}
            >
              60–90 second intro
            </span>
          </div>
        </div>
      </div>
      <details className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-4 text-left">
        <summary className="cursor-pointer text-sm font-semibold text-slate-200">
          Read the intro
        </summary>
        <div className="mt-3 space-y-2 text-sm leading-relaxed text-slate-400">
          {SCRIPT_LINES.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      </details>
    </div>
  );
}
