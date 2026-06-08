"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// ── Inline SVG icons (15×15 viewBox, matches AppNav) ─────────────────────────

function IcAgent() {
  return (
    <svg width="14" height="14" viewBox="0 0 15 15" fill="none">
      <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="7.5" cy="7.5" r="2" fill="currentColor" />
    </svg>
  );
}

function IcBrain() {
  return (
    <svg width="14" height="14" viewBox="0 0 15 15" fill="none">
      <path
        d="M7.5 1.5C5 1.5 2.5 3.5 2.5 6.5c0 2 1 3.5 2.5 4.5v2h5v-2c1.5-1 2.5-2.5 2.5-4.5 0-3-2.5-5-5-5z"
        stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"
      />
      <path d="M5.5 6.5h4M7.5 4.5v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function IcBook() {
  return (
    <svg width="14" height="14" viewBox="0 0 15 15" fill="none">
      <path d="M3 2h6.5a1 1 0 011 1v9a1 1 0 01-1 1H3V2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M9.5 2.5V13M5 5h3M5 7.5h2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function IcDoc() {
  return (
    <svg width="14" height="14" viewBox="0 0 15 15" fill="none">
      <path d="M3 1.5h6.5L12 4v9.5H3v-12z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M9.5 1.5V4H12" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M5 7h5M5 9.5h3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function IcWork() {
  return (
    <svg width="14" height="14" viewBox="0 0 15 15" fill="none">
      <rect x="1.5" y="5" width="12" height="8.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5 5V4a2.5 2.5 0 015 0v1" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function IcQuote() {
  return (
    <svg width="14" height="14" viewBox="0 0 15 15" fill="none">
      <path d="M2.5 3h10M2.5 6h10M2.5 9h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M10.5 8.5l3 2-3 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IcMail() {
  return (
    <svg width="14" height="14" viewBox="0 0 15 15" fill="none">
      <rect x="1.5" y="3" width="12" height="9" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <path d="M1.5 4l6 4 6-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function IcRadar() {
  return (
    <svg width="14" height="14" viewBox="0 0 15 15" fill="none">
      <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="7.5" cy="7.5" r="2.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M7.5 5V2M10.5 4.5L13 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function IcInbox() {
  return (
    <svg width="14" height="14" viewBox="0 0 15 15" fill="none">
      <path d="M1.5 9h3l1.5 2h3L11 9h3" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M1.5 9V4a1 1 0 011-1h10a1 1 0 011 1v5" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

function IcCalendar() {
  return (
    <svg width="14" height="14" viewBox="0 0 15 15" fill="none">
      <rect x="1.5" y="3" width="12" height="10.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <path d="M1.5 6.5h12M5 1.5v3M10 1.5v3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function IcSun() {
  return (
    <svg width="14" height="14" viewBox="0 0 15 15" fill="none">
      <circle cx="7.5" cy="7.5" r="2.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M7.5 1v1.5M7.5 12.5V14M1 7.5h1.5M12.5 7.5H14M3 3l1 1M11 11l1 1M3 12l1-1M11 4l1-1"
        stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function IcPeople() {
  return (
    <svg width="14" height="14" viewBox="0 0 15 15" fill="none">
      <circle cx="5.5" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="10.5" cy="4.5" r="2" stroke="currentColor" strokeWidth="1.2" />
      <path d="M1 12.5c0-2.5 2-3.5 4.5-3.5M8.5 11c0-1.5 1-2.5 3-2.5"
        stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function IcCapture() {
  return (
    <svg width="14" height="14" viewBox="0 0 15 15" fill="none">
      <path d="M2.5 3h10M2.5 7.5h7M2.5 12h4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function IcSettings() {
  return (
    <svg width="14" height="14" viewBox="0 0 15 15" fill="none">
      <circle cx="7.5" cy="7.5" r="2.25" stroke="currentColor" strokeWidth="1.2" />
      <path d="M7.5 1v1.5M7.5 12.5V14M1 7.5h1.5M12.5 7.5H14M3 3l1 1M11 11l1 1M3 12l1-1M11 4l1-1"
        stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function IcProjects() {
  return (
    <svg width="14" height="14" viewBox="0 0 15 15" fill="none">
      <rect x="1.5" y="2" width="12" height="11" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <path d="M4 5.5h3M4 8h7M4 10.5h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function IcConnections() {
  return (
    <svg width="14" height="14" viewBox="0 0 15 15" fill="none">
      <circle cx="4" cy="4" r="2" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="11" cy="11" r="2" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5.5 5.5l4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function IcPlus() {
  return (
    <svg width="14" height="14" viewBox="0 0 15 15" fill="none">
      <path d="M7.5 2v11M2 7.5h11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function IcUpload() {
  return (
    <svg width="14" height="14" viewBox="0 0 15 15" fill="none">
      <path d="M7.5 10V3M4.5 6l3-3 3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 12.5h11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function IcSearch() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M10 10l3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

// ── Data ──────────────────────────────────────────────────────────────────────

type Section = "NAVIGATE" | "ACTIONS";

type PaletteItem = {
  id: string;
  label: string;
  keywords: string;
  href: string;
  section: Section;
  Icon: () => React.ReactElement;
};

const PALETTE_ITEMS: PaletteItem[] = [
  // Navigate — order mirrors the side rail
  { id: "agent",      label: "Agent",                keywords: "agent ask chat conversation ai",                          href: "/app/ask",              section: "NAVIGATE", Icon: IcAgent       },
  { id: "inbox",      label: "Inbox",                keywords: "inbox messages approvals queue triage mail",              href: "/app/apps/inbox",       section: "NAVIGATE", Icon: IcInbox       },
  { id: "tasks",      label: "Tasks",                keywords: "tasks todos actions to do",                               href: "/app/tasks",            section: "NAVIGATE", Icon: IcWork        },
  { id: "calendar",   label: "Calendar",             keywords: "calendar schedule events dates google connection",        href: "/app/calendar",         section: "NAVIGATE", Icon: IcCalendar    },
  { id: "email",      label: "Email",                keywords: "email gmail threads inbox messages mail",                 href: "/app/email",            section: "NAVIGATE", Icon: IcMail        },
  { id: "brain",      label: "Brain",                keywords: "brain knowledge memory freshness what agent knows",       href: "/app/brain",            section: "NAVIGATE", Icon: IcBrain       },
  { id: "digest",     label: "Weekly Read",          keywords: "weekly digest brain read summary",                        href: "/app/brain/digest",     section: "NAVIGATE", Icon: IcBook        },
  { id: "documents",  label: "Documents",            keywords: "documents files uploads library brain",                   href: "/app/documents",        section: "NAVIGATE", Icon: IcDoc         },
  { id: "apps",       label: "Apps",                 keywords: "apps work tools catalog workbench",                       href: "/app/apps",             section: "NAVIGATE", Icon: IcWork        },
  { id: "quote",      label: "Quote / Proposal",     keywords: "quote proposal writer output client",                     href: "/app/apps/quote",       section: "NAVIGATE", Icon: IcQuote       },
  { id: "drafter",    label: "Email Drafter",        keywords: "email drafter draft write message app",                   href: "/app/apps/email",       section: "NAVIGATE", Icon: IcMail        },
  { id: "followups",  label: "Follow-up Radar",      keywords: "follow up radar cold outreach leads",                     href: "/app/apps/followups",   section: "NAVIGATE", Icon: IcRadar       },
  { id: "daily",      label: "Daily Brief",          keywords: "daily brief morning summary today",                       href: "/app/apps/daily-brief", section: "NAVIGATE", Icon: IcSun         },
  { id: "personas",   label: "Personas",             keywords: "personas team agents voices",                             href: "/app/personas",         section: "NAVIGATE", Icon: IcPeople      },
  { id: "routines",   label: "Routines",             keywords: "routines automations scheduled recurring",                href: "/app/routines",         section: "NAVIGATE", Icon: IcRadar       },
  { id: "projects",   label: "Projects",             keywords: "projects scaffolds plans milestones scaffolding",         href: "/app/projects",         section: "NAVIGATE", Icon: IcProjects    },
  { id: "community",  label: "Community",            keywords: "community skool members network",                         href: "/app/skool",            section: "NAVIGATE", Icon: IcPeople      },
  { id: "connections",label: "Connections",          keywords: "connections integrations oauth gmail slack calendar quickbooks stripe", href: "/app/settings/connections", section: "NAVIGATE", Icon: IcConnections },
  { id: "capture",    label: "Capture",              keywords: "capture upload feed brain note",                          href: "/app/capture",          section: "NAVIGATE", Icon: IcCapture     },
  { id: "settings",   label: "Settings",             keywords: "settings account api key config",                         href: "/app/settings",         section: "NAVIGATE", Icon: IcSettings    },
  // Actions
  { id: "new-conv",   label: "New conversation",     keywords: "new conversation chat start ask",                         href: "/app/ask",              section: "ACTIONS",  Icon: IcPlus        },
  { id: "feed-brain", label: "Feed your brain",      keywords: "feed brain upload document knowledge",                    href: "/app/capture",          section: "ACTIONS",  Icon: IcUpload      },
];

// ── Fuzzy match ───────────────────────────────────────────────────────────────

function matches(item: PaletteItem, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return item.label.toLowerCase().includes(q) || item.keywords.includes(q);
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CommandPaletteButton() {
  const dispatch = () =>
    window.dispatchEvent(new CustomEvent("pa:cmd-palette:open"));

  return (
    <button
      onClick={dispatch}
      aria-label="Open command palette"
      className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-slate-600 hover:text-slate-400 hover:bg-slate-800/30 transition-colors text-xs"
    >
      <IcSearch />
      <span className="flex-1 text-left font-medium">Search</span>
      <kbd className="text-[10px] font-mono border border-slate-800 rounded px-1 py-0.5 text-slate-700">
        ⌘K
      </kbd>
    </button>
  );
}

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setFilter("");
    setActiveIndex(0);
  }, []);

  // ⌘K / Ctrl+K global toggle; Escape to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [close]);

  // Custom event from CommandPaletteButton in nav
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("pa:cmd-palette:open", onOpen);
    return () => window.removeEventListener("pa:cmd-palette:open", onOpen);
  }, []);

  // Focus input on open
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Derived filtered lists
  const navItems = PALETTE_ITEMS.filter(
    (i) => i.section === "NAVIGATE" && matches(i, filter)
  );
  const actionItems = PALETTE_ITEMS.filter(
    (i) => i.section === "ACTIONS" && matches(i, filter)
  );
  const allVisible = [...navItems, ...actionItems];

  // Reset selected index when query changes
  useEffect(() => {
    setActiveIndex(0);
  }, [filter]);

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-palette-index="${activeIndex}"]`
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, allVisible.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = allVisible[activeIndex];
      if (item) {
        close();
        router.push(item.href);
      }
    }
  }

  function handleSelect(href: string) {
    close();
    router.push(href);
  }

  if (!open) return null;

  const hasNav = navItems.length > 0;
  const hasActions = actionItems.length > 0;
  const empty = !hasNav && !hasActions;

  return (
    <div className="fixed inset-0 z-[80]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={close}
      />

      {/* Modal */}
      <div className="relative z-[81] flex justify-center pt-[14vh] px-4">
        <div className="w-full max-w-[520px] rounded-2xl overflow-hidden shadow-2xl border border-slate-700/60 bg-[#0d1117]">
          {/* Search row */}
          <div className="flex items-center gap-2 border-b border-slate-700/60 px-4">
            <span className="text-slate-600 shrink-0">
              <IcSearch />
            </span>
            <input
              ref={inputRef}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Search pages and actions…"
              spellCheck={false}
              className="flex-1 bg-transparent py-3.5 text-sm text-slate-100 outline-none placeholder:text-slate-600"
            />
            <kbd className="shrink-0 text-[10px] font-mono border border-slate-700/60 rounded px-1.5 py-0.5 text-slate-600">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div ref={listRef} className="max-h-[380px] overflow-y-auto p-2">
            {empty && (
              <p className="py-10 text-center text-sm text-slate-600">
                No results.
              </p>
            )}

            {hasNav && (
              <div>
                <p className="px-3 pt-2 pb-1 text-[10px] font-mono tracking-[0.16em] uppercase text-slate-600 select-none">
                  Navigate
                </p>
                {navItems.map((item, i) => (
                  <PaletteRow
                    key={item.id}
                    item={item}
                    index={i}
                    activeIndex={activeIndex}
                    onSelect={handleSelect}
                    onHover={setActiveIndex}
                  />
                ))}
              </div>
            )}

            {hasActions && (
              <div className={hasNav ? "mt-1 pt-1 border-t border-slate-800/50" : ""}>
                <p className="px-3 pt-2 pb-1 text-[10px] font-mono tracking-[0.16em] uppercase text-slate-600 select-none">
                  Actions
                </p>
                {actionItems.map((item, i) => (
                  <PaletteRow
                    key={item.id}
                    item={item}
                    index={navItems.length + i}
                    activeIndex={activeIndex}
                    onSelect={handleSelect}
                    onHover={setActiveIndex}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Row sub-component ─────────────────────────────────────────────────────────

type PaletteRowProps = {
  item: PaletteItem;
  index: number;
  activeIndex: number;
  onSelect: (href: string) => void;
  onHover: (index: number) => void;
};

function PaletteRow({ item, index, activeIndex, onSelect, onHover }: PaletteRowProps) {
  const isActive = index === activeIndex;
  const { Icon } = item;

  return (
    <button
      data-palette-index={index}
      onClick={() => onSelect(item.href)}
      onMouseEnter={() => onHover(index)}
      className={`flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors min-h-[44px] ${
        isActive
          ? "bg-slate-800/70 text-slate-100"
          : "text-slate-400 hover:bg-slate-800/30 hover:text-slate-200"
      }`}
    >
      <span
        className={`shrink-0 transition-colors ${
          isActive ? "text-[#22d3ee]" : "text-slate-600"
        }`}
      >
        <Icon />
      </span>
      <span className="flex-1 font-medium">{item.label}</span>
    </button>
  );
}
