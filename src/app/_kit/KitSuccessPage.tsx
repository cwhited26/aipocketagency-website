import Link from "next/link";
import {
  getKitConfig,
  KIT_CONFIG,
  type KitSlug,
} from "@/lib/kit-config";

const MONO_FONT =
  "var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, monospace";

const TRIAL_URL = "/start";

export default function KitSuccessPage({
  slug,
  email,
  bundled,
}: {
  slug: KitSlug;
  email: string;
  bundled: boolean;
}) {
  const kit = getKitConfig(slug);
  if (!kit) {
    throw new Error(`KitSuccessPage rendered with unknown slug: ${slug}`);
  }
  const allKits = Object.values(KIT_CONFIG) as Array<{
    slug: KitSlug;
    shortName: string;
    pdfPath: `/${string}.pdf`;
  }>;
  return (
    <main className="min-h-screen text-slate-100">
      <section className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-grid opacity-40" aria-hidden />
        <div className="absolute inset-0 bg-hero-glow" aria-hidden />
        <div className="relative mx-auto max-w-2xl px-6 pb-24 pt-24 sm:pt-32">
          <div className="flex flex-col items-center text-center">
            <div
              className="mb-4 whitespace-nowrap text-xs text-cyan-300/70 sm:text-sm"
              style={{ fontFamily: MONO_FONT }}
            >
              [ paid · welcome ]
            </div>
            <h1 className="text-balance text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
              <span className="bg-gradient-to-r from-accent via-cyan-300 to-indigo-300 bg-clip-text text-transparent">
                You&apos;re in.
              </span>
            </h1>
            {bundled ? (
              <p className="mt-6 max-w-xl text-balance text-lg leading-relaxed text-slate-300 sm:text-xl">
                All 5 APA kits are being delivered to{" "}
                {email ? (
                  <span className="font-medium text-slate-100">{email}</span>
                ) : (
                  <>the email you used at checkout</>
                )}
                . Check your inbox within the next few minutes. If you don&apos;t
                see them, check spam or reply to the receipt for help.
              </p>
            ) : (
              <p className="mt-6 max-w-xl text-balance text-lg leading-relaxed text-slate-300 sm:text-xl">
                The {kit.shortName} PDF is being delivered to{" "}
                {email ? (
                  <span className="font-medium text-slate-100">{email}</span>
                ) : (
                  <>the email you used at checkout</>
                )}
                . Check your inbox within the next few minutes. If you don&apos;t
                see it, check spam or reply to the receipt for help.
              </p>
            )}

            {bundled ? (
              <div className="mt-10 w-full max-w-md space-y-2">
                {allKits.map((k) => (
                  <Link
                    key={k.slug}
                    href={k.pdfPath}
                    className="group flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left transition hover:border-accent/40 hover:bg-white/[0.07]"
                  >
                    <span className="text-sm font-medium text-slate-100">
                      {k.shortName}
                    </span>
                    <span className="text-xs text-accent">Open PDF →</span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="mt-10">
                <Link
                  href={kit.pdfPath}
                  className="group inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3.5 text-base font-semibold text-accent-foreground shadow-[0_0_40px_-10px_rgba(34,211,238,0.7)] transition hover:scale-[1.02] hover:shadow-[0_0_60px_-8px_rgba(34,211,238,0.85)]"
                >
                  Open the PDF now →
                </Link>
              </div>
            )}

            <p className="mt-8 text-sm text-slate-400">
              Want the software that runs these kits automatically?{" "}
              <Link
                href={TRIAL_URL}
                className="text-accent underline-offset-4 transition hover:underline"
              >
                Start your 14-day free trial of Pocket Agent
              </Link>
            </p>

            <p className="mt-2 text-sm text-slate-500">
              <Link
                href="/"
                className="text-accent underline-offset-4 transition hover:underline"
              >
                aipocketagency.com
              </Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
