import { createClient } from "@/lib/supabase/server";
import AppNav from "./_components/AppNav";

export const metadata = {
  title: "Pocket Agent",
  description: "Your AI co-founder — built for getting shit done.",
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthed = Boolean(user);

  if (!isAuthed) {
    return (
      <div className="min-h-screen bg-[#05070a] text-slate-100">
        {children}
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#05070a] text-slate-100 overflow-hidden">
      <AppNav />
      {/* Mobile top bar spacer */}
      <main className="flex-1 min-w-0 overflow-hidden lg:pt-0 pt-12">
        {children}
      </main>
    </div>
  );
}
