import { PRICE_LABEL } from "@/data/pocket-capture/marketing";
import { CheckoutButton, MONO_FONT } from "./CheckoutButton";

const INCLUDED = [
  "All four capture surfaces — Share Sheet, Voice, Email, SMS",
  "A private feed only you can see",
  "Search and tags across everything you capture",
  "Auto-tagging on new captures",
  "Add to your home screen on iOS and Android",
  "Upgrade to Pocket Agent any time — your captures come with you",
];

export function Pricing() {
  return (
    <section className="border-b border-white/5 bg-black/20">
      <div className="mx-auto max-w-md px-6 py-20">
        <div className="rounded-3xl border border-cyan-300/30 bg-cyan-300/[0.04] p-8 text-center">
          <div
            className="mb-4 inline-block text-xs text-cyan-300/70"
            style={{ fontFamily: MONO_FONT }}
          >
            [ one-time · no subscription ]
          </div>
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-5xl font-extrabold text-slate-100">$47</span>
            <span className="text-sm text-slate-500">once</span>
          </div>
          <p className="mt-3 text-sm text-slate-400">
            Pay once. It’s yours. No monthly bill, no auto-renew.
          </p>

          <ul className="mt-7 space-y-3 text-left text-[15px] text-slate-300">
            {INCLUDED.map((line) => (
              <li key={line} className="flex items-start gap-2">
                <span className="mt-0.5 text-cyan-300" aria-hidden>
                  ✓
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ul>

          <div className="mt-8 flex justify-center">
            <CheckoutButton />
          </div>
          <p className="mt-4 text-xs text-slate-500">
            30-day money-back guarantee. {PRICE_LABEL}, billed once.
          </p>
        </div>
      </div>
    </section>
  );
}
