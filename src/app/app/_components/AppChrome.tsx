"use client";

// AppChrome — decides whether the standard tabbed chrome (left AppNav + command palette)
// wraps the page, or whether the page brings its own chrome. The chat-as-surface home
// (/app/home, PA v5 Wave A) renders its own SideRail + full-screen layout, so we render its
// children bare. Every other authed route keeps the existing tabbed chrome unchanged.

import { usePathname } from "next/navigation";
import AppNav from "./AppNav";
import CommandPalette from "./CommandPalette";

export default function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // The chat home owns the whole viewport (its own rail + sticky input).
  if (pathname?.startsWith("/app/home")) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen bg-[#05070a] text-slate-100 overflow-hidden">
      <AppNav />
      <CommandPalette />
      {/* Mobile top bar spacer */}
      {/* mob-top-spacer matches mob-top-bar height and self-resets to 0 on lg+.
           safe-pb clears the iPhone home indicator at the bottom. */}
      <main className="flex-1 min-w-0 overflow-hidden mob-top-spacer safe-pb">{children}</main>
    </div>
  );
}
