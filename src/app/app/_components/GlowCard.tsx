import Link from "next/link";
import type { ReactNode } from "react";

type GlowCardProps = {
  href?: string;
  children: ReactNode;
  className?: string;
  /** When true the card is rendered as a div (non-interactive). */
  static?: boolean;
};

/**
 * Reusable card with cyan edge glow that intensifies on hover and active/touch.
 * Pure CSS — no JS event handlers — safe to render from Server Components.
 * Matches the design system: bg-slate-900/70, slate-700/60 border at rest.
 */
export function GlowCard({ href, children, className = "", static: isStatic }: GlowCardProps) {
  const base = `glow-card block${className ? ` ${className}` : ""}`;
  if (href && !isStatic) {
    return (
      <Link href={href} className={base}>
        {children}
      </Link>
    );
  }
  return <div className={base}>{children}</div>;
}
