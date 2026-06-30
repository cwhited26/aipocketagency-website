// lib/launch-funnel/copy.ts — shared copy constants for the launch funnel. Kept in one place so
// the social-proof numbers are configurable and the placeholder is honest about being a placeholder.

export const MONO_FONT =
  "var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, monospace";

// Social-proof count. PLACEHOLDER — Chase sets the real number before paid traffic. Reads from an
// optional public env so it can change without a deploy. Used in "Trusted by [X]+ owner-operators"
// and "Rated 4.9/5 by [X]+ operators".
export const OPERATOR_COUNT =
  process.env.NEXT_PUBLIC_FUNNEL_OPERATOR_COUNT ?? "200";

export const STAR_RATING = "4.9";

// Composite testimonials — no real customer names (feedback_no_real_customer_names_in_product_copy).
export interface Testimonial {
  quote: string;
  attribution: string;
}

export const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "I stopped re-explaining my business to a blank box every morning. My agent already knows my customers, my prices, and how I talk. The follow-ups I always meant to send actually go out now.",
    attribution: "Service business owner, 2 helpers",
  },
  {
    quote:
      "The Business Brain is the part that sold me. Every other AI tool forgot everything the second I closed the tab. This one gets sharper every week instead.",
    attribution: "Solo consultant",
  },
  {
    quote:
      "I run three things off one workspace now. I approve the work in Mission Control instead of doing all of it myself. That's the whole difference.",
    attribution: "Agency operator",
  },
];
