import type { CaptureSurfaceKey } from "@/data/pocket-capture/marketing";

// Placeholder for a capture-surface demo video (PC-MARK-6 fills these in). Renders a labeled
// poster frame today; PC-MARK-6 swaps the inner box for a <video> by surface key. The
// `data-demo-surface` attribute is the wiring point so that lane can target each slot without
// touching the page layout. Heavy media stays out of the bundle until then — protects LCP.

export function DemoSlot({
  surfaceKey,
  label,
  icon,
  className = "",
}: {
  surfaceKey: CaptureSurfaceKey;
  label: string;
  icon: string;
  className?: string;
}) {
  return (
    <div
      data-demo-surface={surfaceKey}
      className={`relative flex aspect-[9/16] flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] ${className}`}
      aria-label={`${label} demo — coming soon`}
    >
      <div className="absolute inset-0 bg-grid opacity-20" aria-hidden />
      <span className="relative text-3xl" aria-hidden>
        {icon}
      </span>
      <span className="relative text-xs font-medium text-slate-300">{label}</span>
      <span className="relative text-[10px] uppercase tracking-wide text-slate-500">
        demo
      </span>
    </div>
  );
}
