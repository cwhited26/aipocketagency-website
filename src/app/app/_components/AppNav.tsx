"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { CommandPaletteButton } from "./CommandPalette";

function AgentIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="7.5" cy="7.5" r="2" fill="currentColor" />
    </svg>
  );
}

function BrainIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <path d="M7.5 1.5C5 1.5 2.5 3.5 2.5 6.5c0 2 1 3.5 2.5 4.5v2h5v-2c1.5-1 2.5-2.5 2.5-4.5 0-3-2.5-5-5-5z"
        stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M5.5 6.5h4M7.5 4.5v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function WorkIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <rect x="1.5" y="5" width="12" height="8.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5 5V4a2.5 2.5 0 015 0v1" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function CommunityIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <circle cx="5.5" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="10.5" cy="4.5" r="2" stroke="currentColor" strokeWidth="1.2" />
      <path d="M1 12.5c0-2.5 2-3.5 4.5-3.5M8.5 11c0-1.5 1-2.5 3-2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <circle cx="7.5" cy="7.5" r="2.25" stroke="currentColor" strokeWidth="1.2" />
      <path d="M7.5 1v1.5M7.5 12.5V14M1 7.5h1.5M12.5 7.5H14M3 3l1 1M11 11l1 1M3 12l1-1M11 4l1-1"
        stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function DocsIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <path
        d="M3 1.5h6.5L12 4v9.5H3v-12z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="M9.5 1.5V4H12" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M5 7h5M5 9.5h3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function BrainMapIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <circle cx="3.5" cy="4" r="1.6" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="11.5" cy="3.5" r="1.6" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="7.5" cy="11" r="1.6" stroke="currentColor" strokeWidth="1.2" />
      <path d="M4.8 5.1L6.6 9.6M10.3 4.6L8.5 9.7M5 4.2l5-0.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

function CaptureIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <path d="M2.5 3h10M2.5 7.5h7M2.5 12h4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

// An inbox-with-a-spark glyph — the captures feed where everything you forward/text/share lands.
function CapturesIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <path d="M1.5 9h3l1.5 2h3L11 9h3" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M1.5 9V5a1 1 0 011-1h5" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M11.5 1.5l.7 1.6 1.6.7-1.6.7-.7 1.6-.7-1.6-1.6-.7 1.6-.7z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  );
}

function TasksIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <path d="M5.5 3h7M5.5 7.5h7M5.5 12h7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="2.5" cy="3" r="1" fill="currentColor" />
      <circle cx="2.5" cy="7.5" r="1" fill="currentColor" />
      <circle cx="2.5" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}

function SkillsIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <path d="M7.5 1.5l1.6 3.5 3.9.4-2.9 2.6.9 3.8-3.5-2-3.5 2 .9-3.8L2 5.4l3.9-.4z"
        stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

function PersonasIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <circle cx="5" cy="5" r="2.25" stroke="currentColor" strokeWidth="1.2" />
      <path d="M1.5 12.5c0-2.2 1.6-3.5 3.5-3.5s3.5 1.3 3.5 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="10.5" cy="4" r="1.6" stroke="currentColor" strokeWidth="1.1" />
      <path d="M9.5 11c0-1.8 1.2-2.9 3-2.9" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

function RoutinesIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <path d="M7.5 2v2.5M7.5 10.5V13M2 7.5h2.5M10.5 7.5H13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="7.5" cy="7.5" r="2.5" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function InboxIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <path d="M1.5 9h3l1.5 2h3L11 9h3" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M1.5 9V4a1 1 0 011-1h10a1 1 0 011 1v5" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <rect x="1.5" y="3" width="12" height="10.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <path d="M1.5 6.5h12M5 1.5v3M10 1.5v3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <rect x="1.5" y="3" width="12" height="9" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <path d="M1.5 4l6 4 6-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function ProjectsIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <rect x="1.5" y="2" width="12" height="11" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <path d="M4 5.5h3M4 8h7M4 10.5h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function ConnectionsIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <circle cx="4" cy="4" r="2" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="11" cy="11" r="2" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5.5 5.5l4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

// A balance/scales glyph — the roundtable weighing both sides of a call.
function DecisionsIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <path d="M7.5 2v11M3 13h9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M2 4.5h11M4 4.5L2.5 8h3L4 4.5zM11 4.5L9.5 8h3L11 4.5z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function HamburgerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M2 4.5h14M2 9h14M2 13.5h14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

type NavItemProps = {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  label: string;
  title?: string;
  disabled?: boolean;
  soon?: boolean;
  badge?: number;
  onClick?: () => void;
};

function NavItem({ href, active, icon, label, title, disabled, soon, badge, onClick }: NavItemProps) {
  if (disabled) {
    return (
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg opacity-30 cursor-not-allowed select-none">
        <span className="shrink-0 text-slate-600">{icon}</span>
        <span className="text-sm text-slate-600">{label}</span>
        {soon && (
          <span className="ml-auto text-[9px] font-mono text-slate-700 border border-slate-800 rounded px-1 py-0.5 uppercase tracking-wider">
            soon
          </span>
        )}
      </div>
    );
  }

  return (
    <Link
      href={href}
      onClick={onClick}
      title={title}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 group ${
        active
          ? "bg-slate-800/70 text-slate-100"
          : "text-slate-500 hover:text-slate-200 hover:bg-slate-800/30"
      }`}
    >
      <span className={`shrink-0 transition-colors ${active ? "text-[#22d3ee]" : "text-slate-600 group-hover:text-slate-400"}`}>
        {icon}
      </span>
      <span className="font-medium">{label}</span>
      {badge !== undefined && badge > 0 ? (
        <span className="ml-auto shrink-0 min-w-[18px] h-[18px] rounded-full bg-[#22d3ee]/15 border border-[#22d3ee]/40 text-[#22d3ee] text-[10px] font-mono flex items-center justify-center px-1.5">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : active ? (
        <span className="ml-auto w-[3px] h-4 rounded-full bg-[#22d3ee] opacity-80 shrink-0" />
      ) : null}
    </Link>
  );
}

export default function AppNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [taskCount, setTaskCount] = useState(0);
  const [inboxCount, setInboxCount] = useState(0);

  useEffect(() => {
    fetch("/api/app/tasks/count")
      .then((r) => (r.ok ? (r.json() as Promise<{ total: number }>) : Promise.reject()))
      .then((d) => { setTaskCount(d.total); })
      .catch(() => { /* badge stays hidden on error */ });
    fetch("/api/app/inbox/count", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<{ total: number }>) : Promise.reject()))
      .then((d) => { setInboxCount(d.total); })
      .catch(() => { /* badge stays hidden on error */ });
  }, []);

  // Promoted Inbox / Connections live under /app/apps and /app/settings respectively,
  // so their parent ("Apps", "Settings") must not also light up when they're active.
  const isInbox = pathname.startsWith("/app/mission-control");
  const isConnections = pathname.startsWith("/app/settings/connections");

  const isAgent =
    pathname.startsWith("/app/ask") || pathname.startsWith("/app/agent");
  const isBrain =
    pathname.startsWith("/app/brain") || pathname.startsWith("/app/onboarding");
  const isApps = pathname.startsWith("/app/apps") && !isInbox;
  const isSkills = pathname.startsWith("/app/skills");
  const isDocs = pathname.startsWith("/app/documents");
  const isBrainMap = pathname.startsWith("/app/brain-map");
  const isCommunity = pathname.startsWith("/app/skool");
  const isSettings = pathname.startsWith("/app/settings") && !isConnections;
  // The plural Captures dashboard (/app/captures) must not also light up the singular Capture
  // (/app/capture) voice-recorder entry, since the former is a prefix of the latter check.
  const isCaptures = pathname.startsWith("/app/captures");
  const isCapture = pathname.startsWith("/app/capture") && !isCaptures;
  const isTasks = pathname.startsWith("/app/tasks");
  const isRoutines = pathname.startsWith("/app/routines");
  const isPersonas = pathname.startsWith("/app/personas");
  const isCalendar = pathname.startsWith("/app/calendar");
  const isEmail = pathname.startsWith("/app/email");
  const isProjects = pathname.startsWith("/app/projects");
  const isDecisions = pathname.startsWith("/app/decisions");

  const close = () => setMobileOpen(false);

  const navContent = (
    <>
      <div className="flex items-center h-14 px-5 border-b border-slate-800/50 shrink-0">
        <span className="text-[11px] font-mono tracking-[0.24em] text-[#22d3ee] font-semibold uppercase select-none">
          Pocket Agent
        </span>
        {mobileOpen && (
          <button
            onClick={close}
            className="ml-auto text-slate-500 hover:text-slate-200 transition-colors p-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close navigation"
          >
            <CloseIcon />
          </button>
        )}
      </div>

      <nav className="flex-1 py-4 px-3 flex flex-col gap-0.5 overflow-y-auto">
        <div className="mb-2">
          <CommandPaletteButton />
        </div>
        <NavItem href="/app/ask" active={isAgent} icon={<AgentIcon />} label="Agent" onClick={close} />
        <NavItem href="/app/mission-control" active={isInbox} icon={<InboxIcon />} label="Mission Control" badge={inboxCount} onClick={close} />
        <NavItem href="/app/tasks" active={isTasks} icon={<TasksIcon />} label="Tasks" badge={taskCount} onClick={close} />
        <NavItem href="/app/calendar" active={isCalendar} icon={<CalendarIcon />} label="Calendar" onClick={close} />
        <NavItem href="/app/email" active={isEmail} icon={<EmailIcon />} label="Email" onClick={close} />
        <NavItem href="/app/brain" active={isBrain} icon={<BrainIcon />} label="Brain" title="What your agent knows" onClick={close} />
        <NavItem href="/app/captures" active={isCaptures} icon={<CapturesIcon />} label="Captures" title="Everything you've forwarded, texted, shared, or spoken" onClick={close} />
        <NavItem href="/app/documents" active={isDocs} icon={<DocsIcon />} label="Documents" title="Files in your brain" onClick={close} />
        <NavItem href="/app/brain-map" active={isBrainMap} icon={<BrainMapIcon />} label="Brain Map" title="Map of what your agent knows" onClick={close} />
        <NavItem href="/app/apps" active={isApps} icon={<WorkIcon />} label="Apps" onClick={close} />
        <NavItem href="/app/skills" active={isSkills} icon={<SkillsIcon />} label="Skills" title="Techniques your agent has learned" onClick={close} />
        <NavItem href="/app/personas" active={isPersonas} icon={<PersonasIcon />} label="Personas" onClick={close} />
        <NavItem href="/app/routines" active={isRoutines} icon={<RoutinesIcon />} label="Routines" onClick={close} />
        <NavItem href="/app/projects" active={isProjects} icon={<ProjectsIcon />} label="Projects" onClick={close} />
        <NavItem
          href="/app/decisions"
          active={isDecisions}
          icon={<DecisionsIcon />}
          label="Decisions"
          title="Roundtable verdicts your agents argued out"
          onClick={close}
        />
        <NavItem href="/app/skool" active={isCommunity} icon={<CommunityIcon />} label="Community" onClick={close} />
        <NavItem href="/app/settings/connections" active={isConnections} icon={<ConnectionsIcon />} label="Connections" onClick={close} />

        <div className="my-2 border-t border-slate-800/50" />

        <NavItem href="/app/capture" active={isCapture} icon={<CaptureIcon />} label="Capture" onClick={close} />
      </nav>

      <div className="border-t border-slate-800/50 px-3 py-4 shrink-0">
        <NavItem href="/app/settings" active={isSettings} icon={<SettingsIcon />} label="Settings" onClick={close} />
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar — mob-top-bar extends behind the iPhone notch/Dynamic Island */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-40 mob-top-bar flex items-center px-4 bg-[#070c11] border-b border-slate-800/60">
        <button
          onClick={() => setMobileOpen(true)}
          className="text-slate-500 hover:text-slate-200 transition-colors p-2.5 -ml-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Open navigation"
        >
          <HamburgerIcon />
        </button>
        <span className="ml-3 text-[11px] font-mono tracking-[0.22em] text-[#22d3ee] font-semibold uppercase">
          Pocket Agent
        </span>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={close}
          />
          <aside className="relative w-[240px] flex flex-col bg-[#070c11] border-r border-slate-800/60 h-full">
            {navContent}
          </aside>
        </div>
      )}

      {/* Desktop left rail */}
      <aside className="hidden lg:flex w-[220px] shrink-0 flex-col bg-[#070c11] border-r border-slate-800/60 h-screen sticky top-0">
        {navContent}
      </aside>
    </>
  );
}
