// /workshop/checkout?slot=<iso>&tz=<zone> — the workshop order form (PA-POS-38 §24.3). The slot
// arrives from the picker; a missing/expired slot bounces back to /workshop.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SiteHeader, SiteFooter } from "@/components/marketing/site-nav";
import { isValidSlot, safeTimeZone } from "@/lib/workshop/slots";
import { formatSlotDisplay } from "@/lib/workshop/provision";
import { WORKSHOP_COPY } from "@/lib/workshop/copy";
import { WorkshopCheckoutForm } from "./CheckoutForm";

export const metadata: Metadata = {
  title: "Reserve your seat — The Business Brain Workshop",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default function WorkshopCheckoutPage({
  searchParams,
}: {
  searchParams: { slot?: string; tz?: string };
}) {
  const slot = searchParams.slot ?? "";
  const tz = safeTimeZone(searchParams.tz ?? "UTC");
  if (!slot || !isValidSlot(slot, Date.now())) {
    redirect("/workshop");
  }

  return (
    <>
      <SiteHeader />
      <main className="text-slate-100">
        <section className="mx-auto max-w-xl px-6 pb-20 pt-16">
          <h1 className="text-3xl font-extrabold tracking-tight">
            {WORKSHOP_COPY.checkout.heading}
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-slate-300">
            {WORKSHOP_COPY.frame.valueLine}
          </p>
          <WorkshopCheckoutForm
            slotIso={slot}
            timeZone={tz}
            slotDisplay={formatSlotDisplay(slot, tz)}
          />
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
