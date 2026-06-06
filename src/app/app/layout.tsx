import { createClient } from "@/lib/supabase/server";
import AppChrome from "./_components/AppChrome";

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

  // AppChrome (client) renders the standard tabbed chrome for every route except the
  // chat-as-surface home (/app/home), which brings its own full-screen rail + input.
  return <AppChrome>{children}</AppChrome>;
}
