import Link from "next/link";

export const MONO_FONT =
  "var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, monospace";

export function Arrow({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className={className} fill="currentColor">
      <path d="M7.05 4.05a1 1 0 011.414 0l5.243 5.243a1 1 0 010 1.414l-5.243 5.243a1 1 0 01-1.414-1.414L11.586 11H3a1 1 0 110-2h8.586L7.05 5.464a1 1 0 010-1.414z" />
    </svg>
  );
}

export function PrimaryCTA({
  href = "/start",
  label = "Start free for 14 days",
  className = "",
}: {
  href?: string;
  label?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`group inline-flex items-center justify-center gap-3 rounded-full bg-accent px-8 py-4 text-base font-semibold text-accent-foreground shadow-[0_0_40px_-10px_rgba(34,211,238,0.7)] transition hover:scale-[1.02] hover:shadow-[0_0_60px_-8px_rgba(34,211,238,0.85)] sm:text-lg ${className}`}
    >
      <span>{label}</span>
      <Arrow className="hidden h-5 w-5 transition group-hover:translate-x-1 sm:inline" />
    </Link>
  );
}

export function SecondaryCTA({
  href,
  label,
  className = "",
}: {
  href: string;
  label: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`group inline-flex items-center justify-center gap-2 rounded-full border border-accent/50 bg-accent/[0.04] px-7 py-4 text-base font-semibold text-accent transition hover:scale-[1.02] hover:border-accent hover:bg-accent/[0.08] sm:text-lg ${className}`}
    >
      <span>{label}</span>
      <Arrow className="hidden h-5 w-5 transition group-hover:translate-x-1 sm:inline" />
    </Link>
  );
}
