import Link from "next/link";
import { PocketCaptureFooter } from "./PocketCaptureFooter";

// Shared shell for the Pocket Capture legal pages (privacy, terms). Keeps the two pages
// visually consistent and gives them a way back to the landing page.

export function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <main className="text-slate-100">
      <div className="mx-auto max-w-2xl px-6 pb-20 pt-16">
        <Link
          href="/"
          className="text-sm text-cyan-300 transition hover:underline"
        >
          ← Pocket Capture
        </Link>
        <h1 className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-slate-500">Last updated {updated}</p>
        <div className="mt-10 space-y-8 text-[15px] leading-relaxed text-slate-300">
          {children}
        </div>
      </div>
      <PocketCaptureFooter />
    </main>
  );
}

export function LegalSection({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-slate-100">{heading}</h2>
      <div className="mt-3 space-y-3 text-slate-400">{children}</div>
    </section>
  );
}
