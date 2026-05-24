"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

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

function CaptureIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <path d="M2.5 3h10M2.5 7.5h7M2.5 12h4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
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
  disabled?: boolean;
  soon?: boolean;
  onClick?: () => void;
};

function NavItem({ href, active, icon, label, disabled, soon, onClick }: NavItemProps) {
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
      {active && (
        <span className="ml-auto w-[3px] h-4 rounded-full bg-[#22d3ee] opacity-80 shrink-0" />
      )}
    </Link>
  );
}

export default function AppNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAgent = pathname.startsWith("/app/ask");
  const isBrain = pathname.startsWith("/app/onboarding");
  const isWork = pathname.startsWith("/app/apps");
  const isCommunity = pathname.startsWith("/app/skool");
  const isSettings = pathname.startsWith("/app/settings");
  const isCapture = pathname.startsWith("/app/capture");

  const close = () => setMobileOpen(false);

  const navContent = (
    <>
      <div className="flex items-center h-14 px-5 border-b border-slate-800/50 shrink-0">
        <span className="text-[11px] font-mono tracking-[0.24em] text-[#22d3ee] font-semibold uppercase select-none">
          Pocket Agent
        </span>
        {mobileOpen && (
          <button onClick={close} className="ml-auto text-slate-500 hover:text-slate-200 transition-colors">
            <CloseIcon />
          </button>
        )}
      </div>

      <nav className="flex-1 py-4 px-3 flex flex-col gap-0.5 overflow-y-auto">
        <NavItem href="/app/ask" active={isAgent} icon={<AgentIcon />} label="Agent" onClick={close} />
        <NavItem href="/app/onboarding" active={isBrain} icon={<BrainIcon />} label="Brain" onClick={close} />
        <NavItem href="/app/apps" active={isWork} icon={<WorkIcon />} label="Work" onClick={close} />
        <NavItem href="/app/skool" active={isCommunity} icon={<CommunityIcon />} label="Community" onClick={close} />

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
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-40 h-12 flex items-center px-4 bg-[#070c11] border-b border-slate-800/60">
        <button
          onClick={() => setMobileOpen(true)}
          className="text-slate-500 hover:text-slate-200 transition-colors"
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
