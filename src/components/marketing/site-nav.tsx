import Link from "next/link";
import { MONO_FONT } from "./cta";
import { PERSONA_LINKS } from "@/data/marketing/persona-pages";

const NAV_LINKS: { label: string; href: string }[] = [
  { label: "How it works", href: "/pocket-agent" },
  { label: "Why Pocket Agent", href: "/why-pa" },
  { label: "Pricing", href: "/pricing" },
];

// CSS-only dropdown (group-hover + focus-within) so the header stays a server component.
function ForMenu() {
  return (
    <div className="group relative">
      <span className="flex cursor-default items-center gap-1 text-sm text-slate-400 transition group-hover:text-slate-100 group-focus-within:text-slate-100">
        For
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
          <path d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" />
        </svg>
      </span>
      <div className="invisible absolute left-1/2 top-full z-50 -translate-x-1/2 pt-3 opacity-0 transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
        <div className="w-72 rounded-2xl border border-white/10 bg-[#0a0d13] p-2 shadow-2xl">
          {PERSONA_LINKS.map((p) => (
            <Link
              key={p.slug}
              href={`/for/${p.slug}`}
              className="block rounded-xl px-3 py-2.5 transition hover:bg-white/[0.05]"
            >
              <span className="block text-sm font-medium text-slate-200">{p.label}</span>
              <span className="mt-0.5 block text-xs leading-snug text-slate-500">{p.hook}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-[#05070a]/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-3.5">
        <Link href="/" className="flex items-center gap-2.5 text-slate-100">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent/15 text-accent ring-1 ring-accent/30">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path d="M4 6h16M4 12h10M4 18h7" strokeLinecap="round" />
            </svg>
          </span>
          <span className="text-[15px] font-semibold tracking-tight">Pocket Agent</span>
        </Link>
        <nav className="hidden items-center gap-7 md:flex">
          <ForMenu />
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm text-slate-400 transition hover:text-slate-100"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href="/app"
            className="hidden text-sm text-slate-400 transition hover:text-slate-100 sm:inline"
          >
            Sign in
          </Link>
          <Link
            href="/start"
            className="inline-flex min-h-[40px] items-center rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition hover:scale-[1.02]"
          >
            Start free
          </Link>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const product: { label: string; href: string; external?: boolean }[] = [
    { label: "How it works", href: "/pocket-agent" },
    { label: "Why Pocket Agent", href: "/why-pa" },
    { label: "Template Gallery", href: "/templates" },
    { label: "Pricing", href: "/pricing" },
    { label: "Open the app", href: "/app" },
  ];
  const company: { label: string; href: string; external?: boolean }[] = [
    { label: "About", href: "/about" },
    { label: "Whited Consulting", href: "https://whited.consulting", external: true },
    { label: "Buildout Studios", href: "https://buildoutstudios.com", external: true },
    { label: "For developers (getpa.dev)", href: "https://getpa.dev", external: true },
  ];
  return (
    <footer className="border-t border-white/5 bg-black/40">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-16 sm:grid-cols-[1.4fr_1fr_1fr]">
        <div className="max-w-sm">
          <div className="text-[15px] font-semibold text-slate-100">Pocket Agent</div>
          <p className="mt-3 text-sm leading-relaxed text-slate-500">
            The one chat that runs your business with you — it remembers how you
            work, it&apos;s plugged into your tools, and it does the work you
            keep meaning to hand off. A Whited Consulting product.
          </p>
        </div>
        <FooterCol title="Product" links={product} />
        <FooterCol title="Company" links={company} />
      </div>
      <div className="border-t border-white/5">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-5 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Whited Consulting. All rights reserved.</span>
          <span style={{ fontFamily: MONO_FONT }}>aipocketagent.com</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string; external?: boolean }[];
}) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {title}
      </div>
      <ul className="mt-4 space-y-2.5 text-sm">
        {links.map((l) => (
          <li key={l.label}>
            <Link
              href={l.href}
              {...(l.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="text-slate-400 transition hover:text-accent"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
