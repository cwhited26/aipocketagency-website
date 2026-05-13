import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Pocket Agent",
  description: "Your AI brain — ask, remember, decide.",
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthed = Boolean(user);

  return (
    <div className="min-h-screen bg-[#05070a] text-slate-100">
      {isAuthed && (
        <nav className="border-b border-slate-800 bg-[#05070a]/90 backdrop-blur sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-4 h-12 flex items-center justify-between">
            <Link
              href="/app/ask"
              className="text-[#22d3ee] text-sm font-mono tracking-wider font-medium hover:text-white transition-colors"
            >
              Pocket Agent
            </Link>
            <div className="flex items-center gap-6">
              <NavLink href="/app/ask">Ask</NavLink>
              <NavLink href="/app/skool">Community</NavLink>
              <NavLink href="/app/settings">Settings</NavLink>
            </div>
          </div>
        </nav>
      )}
      {children}
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-sm text-slate-400 hover:text-slate-100 transition-colors"
    >
      {children}
    </Link>
  );
}
