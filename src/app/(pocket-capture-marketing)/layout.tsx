import { CapturePixels } from "./CapturePixels";

// Layout for the Pocket Capture standalone marketing surface (PC-MARK-1). Nested inside the
// root layout (which owns <html>/<body> and the fonts), so this only injects the paid-social
// pixels and a min-height shell. The route group keeps these pages isolated from the main PA
// marketing chrome (no SiteHeader/SiteFooter) — Pocket Capture is its own focused product.

export default function PocketCaptureMarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#05070a] text-slate-100">
      {children}
      <CapturePixels />
    </div>
  );
}
