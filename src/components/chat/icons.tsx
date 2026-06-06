// icons.tsx — the small icon set shared across the chat surface. Keyed by the `iconKey`
// declared on each slash command so the side rail and autocomplete stay in lockstep with
// the registry. Pure presentational SVGs (currentColor), 15×15 to match the existing nav.

import type { ReactNode } from "react";

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
      {children}
    </svg>
  );
}

const RAIL_ICONS: Record<string, ReactNode> = {
  agent: (
    <Svg>
      <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="7.5" cy="7.5" r="2" fill="currentColor" />
    </Svg>
  ),
  tasks: (
    <Svg>
      <path d="M5.5 3h7M5.5 7.5h7M5.5 12h7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="2.5" cy="3" r="1" fill="currentColor" />
      <circle cx="2.5" cy="7.5" r="1" fill="currentColor" />
      <circle cx="2.5" cy="12" r="1" fill="currentColor" />
    </Svg>
  ),
  brain: (
    <Svg>
      <path
        d="M7.5 1.5C5 1.5 2.5 3.5 2.5 6.5c0 2 1 3.5 2.5 4.5v2h5v-2c1.5-1 2.5-2.5 2.5-4.5 0-3-2.5-5-5-5z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="M5.5 6.5h4M7.5 4.5v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </Svg>
  ),
  docs: (
    <Svg>
      <path d="M3 1.5h6.5L12 4v9.5H3v-12z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M9.5 1.5V4H12" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M5 7h5M5 9.5h3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </Svg>
  ),
  work: (
    <Svg>
      <rect x="1.5" y="5" width="12" height="8.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5 5V4a2.5 2.5 0 015 0v1" stroke="currentColor" strokeWidth="1.2" />
    </Svg>
  ),
  personas: (
    <Svg>
      <circle cx="5" cy="5" r="2.25" stroke="currentColor" strokeWidth="1.2" />
      <path d="M1.5 12.5c0-2.2 1.6-3.5 3.5-3.5s3.5 1.3 3.5 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="10.5" cy="4" r="1.6" stroke="currentColor" strokeWidth="1.1" />
      <path d="M9.5 11c0-1.8 1.2-2.9 3-2.9" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </Svg>
  ),
  routines: (
    <Svg>
      <path d="M7.5 2v2.5M7.5 10.5V13M2 7.5h2.5M10.5 7.5H13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="7.5" cy="7.5" r="2.5" stroke="currentColor" strokeWidth="1.2" />
    </Svg>
  ),
  community: (
    <Svg>
      <circle cx="5.5" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="10.5" cy="4.5" r="2" stroke="currentColor" strokeWidth="1.2" />
      <path d="M1 12.5c0-2.5 2-3.5 4.5-3.5M8.5 11c0-1.5 1-2.5 3-2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </Svg>
  ),
  capture: (
    <Svg>
      <path d="M2.5 3h10M2.5 7.5h7M2.5 12h4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </Svg>
  ),
  inbox: (
    <Svg>
      <path d="M1.5 8.5L3 2.5h9l1.5 6v4h-12v-4z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M1.5 8.5h3l1 1.5h3l1-1.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </Svg>
  ),
  connections: (
    <Svg>
      <circle cx="4" cy="7.5" r="2.25" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="11" cy="7.5" r="2.25" stroke="currentColor" strokeWidth="1.2" />
      <path d="M6.25 7.5h2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </Svg>
  ),
  settings: (
    <Svg>
      <circle cx="7.5" cy="7.5" r="2.25" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M7.5 1v1.5M7.5 12.5V14M1 7.5h1.5M12.5 7.5H14M3 3l1 1M11 11l1 1M3 12l1-1M11 4l1-1"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </Svg>
  ),
};

export function RailIcon({ iconKey }: { iconKey: string }) {
  return <>{RAIL_ICONS[iconKey] ?? RAIL_ICONS.agent}</>;
}

export function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <rect x="6.5" y="2" width="5" height="9" rx="2.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M3.5 8.5a5.5 5.5 0 0011 0M9 14v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path d="M2.5 9L15.5 3l-4 12-2.5-5-6-1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

export function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
      <circle cx="6.5" cy="6.5" r="4" stroke="currentColor" strokeWidth="1.2" />
      <path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function HamburgerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path d="M2 4.5h14M2 9h14M2 13.5h14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M7 1.5v8M4 6.5L7 9.5l3-3M2 12h10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
