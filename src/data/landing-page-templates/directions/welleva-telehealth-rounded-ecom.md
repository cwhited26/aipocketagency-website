---
slug: welleva-telehealth-rounded-ecom
name: Welleva — Telehealth E-commerce / Pill-Round Gradient Borders
vibe: clean, rounded, clinical-friendly, light, conversion-led
industries: telehealth, weight-loss programs, supplements, wellness e-commerce, med spas, pharmacies, direct-to-consumer health, longevity clinics
source: motionsites.ai archive (catalog title "E-commerce Website", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
last_used: never
last_client: never
---

## Hero treatment
A near-white health storefront (`hsl(0 0% 98%)` background, near-black text) where the global border-radius is set to 9999px — every button, badge, and input is a full pill. The hero is a two-column grid. Left: a ratings pill (green circle + star, "4.5 Average Rating • 453 Reviews"), a 6xl semibold headline ("Compounded Semaglutide for Weight Loss" in the source — swap for the client's lead treatment), three icon feature rows (syringe / dollar / truck), a divider, then the money row: bold "$296/mo" beside "*No matter the dose" and a Get Started button, plus a small "Is this right for you?" info card with thumbnail and arrow. Right (desktop only): TWO VERTICAL AUTO-SCROLLING IMAGE MARQUEES side by side — product and lifestyle photos looping in opposite directions (translateY 0→-50% and reverse, 30s linear infinite) with white fade gradients top and bottom.

The recurring brand element is the RAINBOW GRADIENT BORDER button: a 2px border running `#84a9fa → #fb6fec → #fba69e → #fdd4a3 → #fb6fec → #84a9fa` at 200% background size, with the gradient position sliding 0→200% over 0.8s on hover — a slow shimmer around an otherwise white pill. It appears in the nav login, product cards, and eligibility CTAs.

## Page layout
Nine sections: sticky nav (category links by treatment area, solid dark Get Started + gradient-border Login) → hero → products grid (uppercase eyebrow "OUR MEDS", "Medication Made Affordable Without The Insurance", 3-up cards with square photos, price-per-month, gradient-border buttons) → a personalization split ("Lose weight with a plan made just for you." + bullet icons + photo) → a product carousel (one static full-height image card beside a chevron-and-dots carousel of others, images scaling 1.05 on hover) → a science band ("Discover the harmony of science and nature." + six white badge cards with thin-stroke icons: rabbit, pine, leaf, flask, atom, wheat) → an FAQ accordion of white 3xl-radius cards → a guide/blog 4-up grid with pill category links → a dark zinc footer with email signup, link columns, social icons, and compliance badges. Alternating `gray-50`/`gray-100` bands separate sections; all cards share one soft shadow token `2px 4px 12px rgba(0,0,0,0.08)`.

## Typography
- Display + body: system font stack (the prompt loads no custom fonts) — semibold 4xl-6xl headings, 13-18px UI text; the discipline is spacing and radius, not type personality

## Color palette
- Background `hsl(0 0% 98%)` (#fafafa), foreground near-black `hsl(11 6% 11%)` (~`#1e1b1a`)
- Gradient border ramp: periwinkle `#84a9fa`, pink `#fb6fec`, salmon `#fba69e`, peach `#fdd4a3`
- Section bands: gray-50 / gray-100; footer dark zinc `#18181b`
- Accents: green rating dot, light-blue time/info chips; shadow token `rgba(0,0,0,0.08)`

## Visual motifs
- **Animated rainbow gradient-border buttons** (the signature) — a 2px pastel gradient ring around white pills, sliding its background position on hover for a slow shimmer
- **Dual vertical image marquees** — two side-by-side photo columns auto-scrolling in opposite directions with fade masks, the hero's motion without video
- **Everything-is-a-pill radius** — a global 9999px radius making inputs, badges, buttons, and links read soft and medical-friendly
- **Price-forward hero row** — bold monthly price, an asterisk disclaimer, and the CTA on one line; no hidden pricing
- **Thin-stroke nature badges** — six oversized strokeWidth-1.5 icons in white cards telling the science-meets-nature story
- **Soft single-shadow card system** — one shared `2px 4px 12px` shadow across product, FAQ, and guide cards
- **FAQ as fat rounded cards** — accordion items styled as separate 3xl-radius white slabs with 2xl triggers

## When to use
- Telehealth and treatment-program brands selling subscriptions (weight loss, hair, hormones)
- Supplement and wellness e-commerce with strong product photography
- Med spas and clinics adding online purchase or eligibility funnels
- Health brands that must look trustworthy AND affordable — transparent pricing is built into the hero
- Catalog businesses needing product grid + carousel + FAQ + guides in one coherent system

## When to NOT use
- Single-product or single-CTA launches — this is a full storefront skeleton (use `medspa-booking-calendar-first` when booking, not buying, is the conversion)
- Luxury positioning — pill-round friendliness reads accessible, not exclusive
- Brands without a deep photo library — the marquees and grids need 12+ images
- Regulated claims-sensitive categories without legal review — the structure foregrounds pricing and treatment claims

## Build complexity
MEDIUM. Nine sections, a carousel, accordion, and the dual marquee — all standard patterns, but it is a full e-commerce page, not a hero.

## Library cross-references
- Motif: `animated-gradient-border-pill`
- Motif: `dual-vertical-image-marquee`
- Motif: `global-pill-radius-system`
- Motif: `price-forward-hero-row`
- Motif: `thin-stroke-icon-badge-grid`
- Motif: `rounded-slab-faq-accordion`
- Typography: `system-stack-semibold-clean`
- Color palette: `near-white-pastel-gradient-zinc`
