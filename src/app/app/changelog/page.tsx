import { readFileSync } from "fs";
import { join } from "path";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ChangelogRenderer from "./ChangelogRenderer";

export const metadata = { title: "Changelog — Pocket Agent" };

export default async function ChangelogPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const content = readFileSync(
    join(process.cwd(), "src/content/changelog.md"),
    "utf-8"
  );

  return <ChangelogRenderer content={content} />;
}
