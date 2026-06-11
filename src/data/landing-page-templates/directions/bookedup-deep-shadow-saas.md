---
slug: bookedup-deep-shadow-saas
name: BookedUp — Deep Shadow SaaS / Productized Service
vibe: warm, premium-but-approachable, productized, fully-booked, social-proof-heavy
industries: productized agencies, consultancies, lead-gen / growth marketing services, fractional executives, course creators, SaaS with a service component, booked-out solo operators, premium freelancers
source: motionsites.ai (BookedUp prompt — premium tier, extracted Jun 11 2026)
last_used: never
last_client: never
---

## Hero treatment
A split-column hero on warm off-white (`#F7F7F7`). The LEFT column carries the value prop: a small pulse-dot badge ("● BOOKING FOR SUMMER" — signaling fully booked but accepting), a giant tracking-tight headline ("Expanding [inline glowing icon] reach with every lead") that embeds a small `DeepShadow` icon BOX inline mid-sentence, a soft subhead, a CTA pair (primary "Scale revenue now" with glowing button shadow + secondary "Start Here" with Play icon), and a social-proof row showing 4 verified-client avatars (with a glowing accent on the 2nd) beside a 5-star "Top tier quality 5/5" rating.

The RIGHT column is the SECRET SAUCE: an INFINITE VERTICAL MARQUEE of fake "client booking" cards scrolling slowly upward, each card showing a day + date + 1-2 mock consultation entries with avatar + name + time slot. The cards alternate a slight rotation (`rotate-3` / `-rotate-3`) for visual rhythm. Top and bottom fade masks blur the marquee edges. The whole right column signals "I am SO booked out, look at this calendar."

## Page layout
Single hero designed for `lg:grid-cols-[1.2fr_0.8fr] gap-12`. On mobile, the marquee column drops below the value prop column (or hides entirely on the smallest screens). Max width `1440px`. The marquee is the conversion driver — it's the visible-proof-of-demand element that makes the visitor want to book NOW before the slots fill.

## Typography
- Display: SK Reykjavik Rounded Regular (custom from `onlinewebfonts.com`) — a slightly rounded display with personality
- Body + nav: Inter — weights 100-900, including italic variants
- Display tracking: `tracking-tight` or `tracking-[-0.02em]` (negative letterspacing for tight elegance)
- Body color: `#202020` (warm near-black)
- Subhead color: `text-neutral-500`

## Color palette
- Background: `#F7F7F7` (warm off-white — feels like premium paper, NOT pure white)
- Body text: `#202020` (warm near-black)
- Subhead text: `neutral-500` (mid-gray)
- Accent (CTA + inline icon + glowing avatar): `#F25C40` (warm orange-red — feels modern + warm)
- Pulse dot badge accent: `#52D352` (green) with pale green border `#D1F2D1`
- Star rating: `#FFB648` (amber)
- Card surfaces: `bg-white` with `shadow-[0_4px_20px_rgba(0,0,0,0.03)]` (very soft drop shadow)

## Visual motifs
- **Pulse badge** with a green dot (`bg-[#52D352] animate-pulse shadow-[0_0_8px_rgba(82,211,82,0.6)]`) signaling live availability — "BOOKING FOR SUMMER" — the freshness is the conversion driver
- **DeepShadow components** (the signature): inline icon boxes, buttons, and avatars get an underlying blurred glowing layer + an inner inset white shadow + an outer warm box-shadow. Three components:
  - `DeepShadowIcon`: a small box (e.g. for an inline TrendingUp icon embedded mid-headline) with an orange glow underneath + inset highlight
  - `DeepShadowButton`: a CTA pill with a `bg-[#212121] blur-[25px]` glowing shadow that scales up on hover
  - `DeepShadowAvatar`: a portrait with a black blur underneath; one of the four avatars in the social proof row has `hasGlow={true}` so the underglow is orange instead of black (a single accent in a row of 4)
- **Inline display-icon-mid-headline** — the headline `"Expanding [TrendingUp icon box] reach with every lead"` has the icon BOX embedded inline as a typography element, not as a separate element. The icon is rotated `-rotate-6` for personality.
- **Infinite vertical client marquee** (the secret sauce) — a `motion.div` with `animate={{ y: [0, -1200] }}` looping forever, populated by `[...CLIENT_CALLS, ...CLIENT_CALLS, ...CLIENT_CALLS]` (the array tripled for seamless looping). Cards rotate alternately (`rotate-3` / `-rotate-3`) for visual rhythm.
- **Top + bottom fade masks** on the marquee — `bg-gradient-to-b` / `bg-gradient-to-t from-[#F7F7F7] to-transparent` blur the edges so the marquee feels infinite, not clipped
- **4-avatar social proof row** with ONE accented (glowing orange) — a tiny detail that draws the eye to a specific "VIP" client and reads as curated, not generic
- **5-star amber rating** as concrete trust signal
- **Tracking-tight giant headline** — `tracking-tight` or `tracking-[-0.02em]` for editorial elegance on the SK Reykjavik display font

## When to use
- Productized agencies / consultancies (the headline pitch is "we are booked out and you should book now")
- Lead-gen / growth-marketing services
- Fractional executives (CMO, COO, CFO services)
- Course creators with high-touch cohorts
- SaaS with a service component (where the founder's calendar is the conversion path)
- Booked-out solo operators wanting to scale to a small team
- Premium freelancers / consultants
- Anyone who can demo "look at how full my calendar is" as social proof

## When to NOT use
- Anyone NOT booked out — the marquee is the conversion driver; an empty calendar destroys the pitch
- E-commerce — wrong format entirely
- Local services / blue collar — wrong audience register, the warm off-white reads as too soft
- Brands where speed-to-call IS the conversion (use `trades-phone-first-emergency`)
- Anyone whose conversion is buying a product, not booking a time

## Build complexity
MEDIUM complexity. The DeepShadow components are reusable. The infinite vertical marquee is straightforward Framer Motion. Mock client data is the variable — real client booking data (anonymized) reads MUCH better than lorem ipsum. Tier 3 build can ship this in a focused day with anonymized data.

## Library cross-references
- Motif: `deep-shadow-glowing-component-system` (the signature)
- Motif: `pulse-badge-with-fresh-availability`
- Motif: `inline-display-icon-mid-headline`
- Motif: `infinite-vertical-client-marquee` (vs. the horizontal one in Jack 3D Creator)
- Motif: `marquee-fade-mask-edges`
- Motif: `social-proof-row-with-one-glowing-accent`
- Typography: `sk-reykjavik-plus-inter`
- Color palette: `warm-off-white-orange-accent-warm-near-black`
