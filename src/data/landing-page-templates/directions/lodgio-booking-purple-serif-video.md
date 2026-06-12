---
slug: lodgio-booking-purple-serif-video
name: Lodgio — Booking Platform / Purple Serif Over Video
vibe: polished, centered, serif-led, purple-accented, travel-coded
industries: hotel booking, travel platforms, vacation rentals, hospitality saas, reservation software, resorts, tour operators, event venues
source: motionsites.ai archive (catalog title "Datacore Booking", free tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: starter
last_used: never
last_client: never
---

## Hero treatment
A full-screen hero with an opaque background video (autoplay, loop, object-cover — deliberately NO dark overlay; the footage stays at full strength) and dead-centered content stacked on top. The stack: a glassmorphism tagline pill — `rgba(85,80,110,0.4)` with backdrop blur and a soft violet border `rgba(164,132,215,0.5)`, holding a small solid-purple "New" badge plus "Say Hello to Lodgio v3.2" — then the headline in Instrument Serif at 5xl mobile up to 96px desktop, line-height 1.1: "Book your perfect stay instantly and hassle-free", with the word "and" italicized as a small typographic wink. Below: an 18px Inter subhead at 70% white (max-width 662px), then two side-by-side CTAs — "Book a Free Demo" in brand purple `#7b39fc` and "Get Started Now" in dark purple `#2b2344`, both rounded 10px, both lightening slightly on hover.

The mood comes from the serif-headline-over-video pairing: the big Instrument Serif sets a hospitality-magazine tone while the purple version-pill and demo CTA keep it reading as software, not a hotel. It works for either a booking SaaS or the travel brand itself.

## Page layout
Single viewport: transparent navbar over the video (white SVG logo left; Home / Services-with-chevron / Reviews / Contact us center-left in 14px Manrope; white-bordered "Sign In" + purple "Get Started" buttons right at desktop padding px-[120px]), then the centered hero stack at mt-32. On mobile the nav collapses to a white hamburger that opens a full-screen black overlay menu, and the headline drops to text-5xl.

## Typography
- Display: Instrument Serif (Google Fonts) — the headline only, with one italicized conjunction
- Body: Inter (18px subhead at white/70); Manrope for nav links and nav buttons (medium/semibold 14px); Cabin for CTAs and the tagline pill (medium, 14-16px)
- Four families, each with one narrow job — nav, headline, body, buttons

## Color palette
- Primary: vivid purple `#7b39fc` (CTA, "New" badge, Get Started)
- Secondary: dark muted purple `#2b2344` (second CTA)
- Text: white; subhead white at 70%; off-white `#f6f7f9` on the dark button
- Tagline pill: `rgba(85,80,110,0.4)` glass with `rgba(164,132,215,0.5)` border
- Nav "Sign In": white bg, `#d4d4d4` border, near-black `#171717` text
- No page background color matters — the video is the background, edge to edge

## Visual motifs
- **Serif headline over full-strength video** — a 96px Instrument Serif line sitting straight on unfiltered footage; the video must be calm enough to carry white text
- **Version-announcement pill** — a glass capsule with a small solid-purple "New" badge and a product-version line, the classic SaaS launch signal placed above the headline
- **Italicized conjunction** — one small word in the headline switched to italic with adjusted spacing, a cheap detail that reads as typographic care
- **Two-purple CTA pair** — primary action in vivid purple, secondary in dark purple, same shape and size; hierarchy by color alone
- **Glass on violet tint** — the pill's smoky violet glass picks up the brand color without using it flat
- **Full-screen black mobile menu** — the hamburger opens an opaque black overlay rather than a drawer

## When to use
- Booking and reservation platforms (hotels, stays, venues, tours)
- Travel and hospitality SaaS announcing a version or feature launch
- Resort or rental brands with strong destination footage
- Any product where one centered message plus two CTAs is the entire ask
- Brands whose color is purple or violet-adjacent

## When to NOT use
- Anyone without bright, low-contrast video — there is no overlay to rescue white text
- Brands far from purple; the two-purple CTA system is the identity here
- Pages needing search widgets, date pickers, or listings above the fold — use `real-estate-listing-grid-search` for inventory-first layouts
- Editorial luxury hospitality wanting scroll storytelling — use `velar-luxury-real-estate`

## Build complexity
LOW complexity. One viewport, no scroll choreography, standard glassmorphism pill, four Google Fonts. The mobile overlay menu is the only stateful piece.

## Library cross-references
- Motif: `serif-headline-over-video`
- Motif: `version-announcement-pill`
- Motif: `two-tone-cta-pair`
- Motif: `full-bleed-video-no-overlay`
- Motif: `fullscreen-black-mobile-menu`
- Typography: `instrument-serif-inter-manrope-cabin`
- Color palette: `vivid-purple-dark-purple-white`
