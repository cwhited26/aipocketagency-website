---
slug: vyra-giant-gradient-headline-talent
name: Vyra — Giant Gradient-Word SaaS Hero
vibe: dark, minimal, confident, one-word-headline, violet-accented
industries: hr tech, recruiting platforms, ai saas, b2b software, talent marketplaces, analytics platforms, enterprise tools, professional services software
source: motionsites.ai archive (catalog title "Grow AI Talent Platform", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
last_used: never
last_client: never
---

## Hero treatment
The entire hero is ONE WORD. The brand name renders at 230px (`text-[230px]`, font-normal, `tracking-[-0.024em]`, line-height 1.02) as gradient-clipped text — `linear-gradient(223deg, #E8E8E9 0%, #3A7BBF 104%)` running silver-white into steel blue via `bg-clip-text`. Under it sits a two-line subtitle ("The most powerful AI ever deployed / in talent acquisition" pattern — claim line one, category line two) and a single liquid-glass pill CTA ("Schedule a Consult"). Above, a clean navbar with chevron-bearing dropdown items, a glass "Sign Up" pill, and a 1px gradient divider (`from-transparent via-foreground/20 to-transparent`) running the full width below it.

The glass language is specific: a `.liquid-glass` utility with near-zero white fill (`rgba(255,255,255,0.01)`), luminosity blend mode, `blur(4px)`, an inset top highlight, and a 1.4px gradient border drawn with a masked `::before` (bright at top and bottom edges, transparent through the middle).

## Page layout
Two stacked sections, no wrapper styling. Section one is the navbar + giant word + subtitle + CTA on a near-black violet field. Section two is a social-proof band: a background video that fades in over 0.5s, fades out over 0.5s before its end, then resets and replays via `requestAnimationFrame` — a manual loop with no visible jump — under top-and-bottom gradient overlays that melt it into the page background. Over the video sits a logo marquee: "Relied on by brands across the globe" on the left, and on the right a 20s linear infinite horizontal scroll of placeholder brand names, each with a small liquid-glass letter tile.

## Typography
- Display: Hanken Grotesk (substitute for the prompt's General Sans) — the 230px gradient word
- Body: Geist (Google Fonts, weights 400-700) — nav, subtitle, marquee labels
- Subtitle at 18px / leading-8, 80% opacity, max-w-md, centered

## Color palette
- Background: deep violet-black `#05010e` (hsl 260 87% 3%)
- Foreground: warm off-white `#f3f2f0` (hsl 40 6% 95%)
- Primary / accent: violet `#7c3bed` (hsl 262 83% 58%)
- Headline gradient: `#E8E8E9` to `#3A7BBF`
- Borders and muted surfaces: hsl 240 4% 16-20%

## Visual motifs
- **One giant gradient word** (the signature) — the brand name at 230px with silver-to-blue gradient-clipped text; the headline IS the logo IS the hero
- **Liquid-glass pills** — CTAs and nav buttons use a barely-there glass recipe: 1% white fill, luminosity blend, 4px blur, masked gradient border that brightens only at the top and bottom edges
- **Hairline gradient divider** — a full-width 1px line fading in from both ends, separating nav from hero
- **Fade-loop background video** — the proof-section video fades in/out at its loop point through rAF-driven opacity, so the loop never visibly snaps
- **Gradient-melt video edges** — top and bottom `from-background via-transparent to-background` overlays dissolve the video into the page color
- **Glass-tile logo marquee** — placeholder brand logos as small glass squares holding one letter each, scrolling on a 20s linear loop next to a static claim line

## When to use
- AI or data SaaS with a short, strong brand name (4-7 letters renders best at 230px)
- Recruiting, HR, and talent platforms selling to enterprise buyers
- Any B2B product where one confident claim beats a feature list
- Brands that want a dark, expensive look without heavy animation work
- Consultation-driven sales motions — the single CTA is "book a call", not "start free trial"

## When to NOT use
- Long brand names — the one-word headline breaks past ~8 characters
- Products that need explanation; there is no feature section, screenshot, or demo above the fold
- Warm consumer brands — the violet-black field reads enterprise
- Phone-first local services (use `trades-phone-first-emergency`)

## Build complexity
LOW — one glass utility class, one gradient headline, one rAF video fade loop, one marquee keyframe; a focused half-day for the hero pair.

## Library cross-references
- Motif: `one-giant-gradient-word`
- Motif: `liquid-glass-gradient-border-pills`
- Motif: `fade-loop-background-video`
- Motif: `glass-tile-logo-marquee`
- Motif: `hairline-gradient-divider`
- Typography: `hanken-grotesk-geist-dark-saas`
- Color palette: `violet-black-steel-blue-gradient`
