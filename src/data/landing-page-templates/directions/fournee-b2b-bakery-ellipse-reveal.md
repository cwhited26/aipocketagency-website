---
slug: fournee-b2b-bakery-ellipse-reveal
name: Fournée — B2B Food Supplier / Ellipse-Clip Video Slider
vibe: dark, appetizing, scroll-driven, premium, multi-regional
industries: food distributors, bakery suppliers, hospitality wholesale, restaurant groups, catering companies, specialty food importers, FMCG brands, culinary equipment
source: motionsites.ai archive (catalog title unidentified — no export title matches a B2B bakery; premium tier assumed — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
last_used: never
last_client: never
---

## Hero treatment
A scroll-driven video slider for a premium B2B food supplier. The hero wrapper is `100vh + 300vh` tall with a sticky full-screen section inside; three looping product videos stack on top of each other and each new slide reveals through a growing `clip-path: ellipse()` — starting as a small oval (`5% 8%` at center) and expanding past 150% with a cubic ease-in-out, 150vh of scroll per slide. The effect reads as each new film blooming open over the last.

The headline "THE SMART BAKERY SOLUTION" runs in Instrument Serif at 9.7vw, a single line hugging the bottom edge, entering per-character (rise from y:40, 30ms stagger, power3 ease). After it lands, a cursive "for Professionals" subtitle in Luxurious Script fades in at the top. The fixed navbar starts transparent and snaps to black/90 with an 80px backdrop blur after 50px of scroll; it carries a region dropdown (multi-market: think Hong Kong / Mainland China / Taiwan), a centered clover-shaped logo flanked by dropdown menus, and an EN/繁 language toggle whose active state fills gold.

## Page layout
Five sections: the sticky video slider, a white masonry product gallery (4 columns desktop, the middle card of row two spanning 2 columns, 3:4 tiles that enter with a blur-and-rise stagger and slow-zoom to 1.2 scale over 6 seconds on hover), a scroll-scrubbed About block (uppercase serif at 40px/56px where each word fades from 10% to full opacity and sharpens from 4px blur as you scroll, the whole block un-rotating from 3°), a dark "Partnering With Us" band of four Lottie-icon cards rising in 150ms apart, and a white footer with four regional office columns over a black legal bar. A floating right-rail (desktop) holds three circular black buttons — brochure, LinkedIn, chat — that expand sideways on hover to reveal labels, gold on hover.

## Typography
- Display: Instrument Serif (Google Fonts) — hero headline at 9.7vw, section titles, the scroll-reveal About text
- Body: Open Sans (Google Fonts, 300-700) — nav, buttons, copy
- Accent: Luxurious Script (Google Fonts) — the cursive "for Professionals" subtitle and small section labels
- Labels: Manrope (Google Fonts, 500) — gallery captions and card text

## Color palette
- Background: near-black `#171717` (9% lightness) for hero and dark bands; white for gallery, About, and footer
- Text: white on dark, black on white
- Accent: gold `#CB9D06` on every hover — nav dropdowns, buttons, links, the active language pill
- Radius: 2px globally — square, trade-catalog edges

## Visual motifs
- **Ellipse bloom slide transitions** — each video slide reveals through a growing oval clip-path driven by scroll position, 150vh per slide
- **Viewport-width serif headline** — a 9.7vw single-line title pinned to the hero's bottom edge, entering character by character
- **Scroll-scrub word reveal** — About copy where every word fades in and sharpens individually as the visitor scrolls, the block straightening from a 3° tilt
- **Masonry gallery with slow zoom** — 3:4 product tiles that blur-rise into place, then zoom imperceptibly over 6 seconds on hover
- **Expanding rail buttons** — circular black buttons fixed mid-right that slide open to show labels (brochure, LinkedIn, chat), gold on hover
- **Multi-region navigation** — region dropdown plus bilingual toggle built into the header, signaling a cross-border operation
- **Partner name marquee** — supplier wordmarks scrolling at 80px/s in letterspaced uppercase at 40% black, fading at the edges
- **Cursive-over-serif pairing** — a script flourish layered against big serif caps, the premium-food signature

## When to use
- B2B food suppliers, bakery and pastry wholesalers, hospitality distributors
- Multi-region trading companies that need region and language switching in the header
- Premium FMCG or ingredient brands with strong product footage
- Catering and restaurant-group sites selling capability, not bookings
- Brands whose product is filmed beautifully and benefits from full-screen film

## When to NOT use
- Anyone without three strong product videos — the slider is the whole hero
- Direct-to-consumer bakeries wanting warmth and a simple order button
- Mobile-dominant traffic — the 9.7vw headline and 400vh scroll choreography are desktop-first
- Lean launches; this is a five-section build with custom scroll logic (for a lighter food page consider `prisma-cinematic-cream-collective`)

## Build complexity
HIGH complexity. Scroll-driven clip-path math, sticky stacking, per-character and per-word scrubbed text, masonry with custom spans, Lottie cards, and a multi-level dropdown nav. Two to three times a standard hero-led build.

## Library cross-references
- Motif: `ellipse-clip-scroll-slider`
- Motif: `viewport-width-serif-headline`
- Motif: `scroll-scrub-word-reveal`
- Motif: `masonry-blur-rise-slow-zoom`
- Motif: `expanding-rail-buttons`
- Motif: `multi-region-bilingual-nav`
- Motif: `partner-name-marquee`
- Typography: `instrument-serif-open-sans-script-accent`
- Color palette: `near-black-white-gold-hover`
