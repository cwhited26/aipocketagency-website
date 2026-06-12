---
slug: vellair-private-jets-overlap-headline
name: Vellair — Private Jets Light Overlap Headline
vibe: light, premium, quiet, airy, restrained
industries: private aviation, jet charter, luxury travel, chauffeur services, yacht charter, concierge services, executive travel agencies, premium memberships
source: motionsites.ai archive (catalog title "SkyElite Private Jets — Landing Page", free tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: starter
last_used: never
last_client: never
---

## Hero treatment
Full-viewport hero over a background video, but the palette is LIGHT — dark gray text sits directly on bright footage (sky, clouds, tarmac at dawn), no dark overlay. Content is centered and pulled UP from true center so it sits in the upper-middle of the frame. A small uppercase label ("PRIVATE JETS") with wide tracking, then the signature: a TWO-LINE OVERLAPPING HEADLINE. Line one ("Premium.") renders in mid-gray `#6b7280`; line two ("Accessible.") in deep slate `#202A36`, pulled up with a `-12px` negative margin so the lines visually overlap and read as one stacked mark. Both lines at `text-6xl` → `text-8xl`, leading-none, tracking-tighter. One short subtitle below, then two rounded-full pill buttons: a soft gray "Discover" and a solid slate "Book Now".

## Page layout
Single hero viewport, max-width 7xl container, `px-8 py-6` nav padding. Nav is plain text on the footage: brand left, five links right in dark gray with subtle hover, hamburger on mobile opening a white/95 blurred dropdown with rounded corners and shadow. Mobile-first breakpoints; the headline scale steps down cleanly.

## Typography
- Display + body: Inter (Google Fonts, weights 400-700) — headline at font-normal, tracking-tighter, leading-none
- Uppercase eyebrow label at `text-sm` font-semibold with wide letter-spacing
- The two headline lines differ ONLY by color — same size, same weight

## Color palette
- Page base: light gray `#f9fafb`
- Headline line 1: mid gray `#6b7280`
- Headline line 2 + primary button: deep slate `#202A36` (hover `#1a2229`)
- Secondary button: gray-300 fill, gray-800 text
- Body text: gray-600

## Visual motifs
- **Overlapping two-line headline** (the signature) — second line pulled up by negative margin so the stacked words touch; the gray/slate color split does the hierarchy work
- **Dark type on bright footage** — no overlay, no glass; legibility comes from choosing light, airy video
- **Rounded-pill button pair** — one soft gray, one solid slate, small and quiet rather than oversized
- **Uppercase tracked eyebrow** — a small category label above the headline sets context before the pitch
- **White blurred mobile dropdown** — the mobile menu is a floating white card with backdrop blur, not a full-screen takeover

## When to use
- Private aviation, charter brokers, executive travel
- Luxury services that sell on calm confidence: chauffeur fleets, yacht charter, concierge memberships
- Brands with bright, high-quality footage (sky, water, architecture) that a dark site would waste
- Two-word value propositions — the overlap headline is built for exactly two lines
- Audiences that expect understatement, not hype

## When to NOT use
- Brands without light-toned footage — dark video kills the dark-text-on-video trick
- Multi-section storytelling needs; this is a one-viewport statement (for full scroll-driven luxury use `velar-luxury-real-estate`)
- Urgent or phone-first services (use `trades-phone-first-emergency`)
- Brands whose proposition needs more than two stacked words

## Build complexity
LOW complexity. One viewport, no animation logic beyond hover transitions and a mobile menu toggle. The overlap is a single negative margin.

## Library cross-references
- Motif: `overlapping-two-line-headline`
- Motif: `dark-type-on-bright-footage`
- Motif: `rounded-pill-button-pair`
- Motif: `uppercase-tracked-eyebrow`
- Typography: `inter-tight-two-tone-stack`
- Color palette: `light-gray-deep-slate-premium`
