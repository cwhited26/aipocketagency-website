"use client";

import { useEffect, useRef } from "react";
import { trackEvent, type AnalyticsEvent, type AnalyticsProps } from "@/lib/analytics/events";

// Fires one analytics event once on mount. Server pages drop this in to record a view/transition
// (funnel_landing_viewed, funnel_step_completed, funnel_offer_viewed, funnel_checkout_completed)
// without becoming client components themselves. trackEvent never throws.
export default function FunnelView({
  event,
  props,
}: {
  event: AnalyticsEvent;
  props?: AnalyticsProps;
}) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    trackEvent(event, props);
  }, [event, props]);
  return null;
}
