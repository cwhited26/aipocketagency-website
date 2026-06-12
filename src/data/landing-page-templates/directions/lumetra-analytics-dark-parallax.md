---
slug: lumetra-analytics-dark-parallax
name: Lumetra — Analytics SaaS / Dark Parallax / Luminosity Dashboard
vibe: dark, minimal, product-led, serif-accent, scroll-reactive
industries: analytics saas, bi tools, dashboards, finance software, dev tools, data platforms, b2b saas, productivity software
source: motionsites.ai archive (catalog title "Neuralyn — SaaS", free tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: starter
last_used: never
last_client: never
---

## Hero treatment
Pure-black full-viewport hero for an analytics SaaS. Centered stack: a liquid-glass tag pill (blurred surface with a 1.4px masked-gradient border) holding a solid white "New" chip plus a version-announcement line, then the headline at `text-5xl md:text-7xl` with `-2px` tracking — "Your Insights. / One Clear Overview." — where the last word swaps into Instrument Serif italic. A near-white subtitle, then a solid white rounded-full CTA that scales 1.03 on hover.

Below the copy, a full-viewport-width 16:9 band (the `w-screen` + `marginLeft: calc(-50vw + 50%)` trick) plays a background video, and a dashboard screenshot floats centered over it at `mixBlendMode: luminosity` — the screenshot goes monochrome and the video's light bleeds through it, which makes a static PNG feel alive. Both layers parallax on scroll: the hero text group rises 200px and fades to zero over the first half of scroll, the dashboard rises 250px. Entrances stagger top-to-bottom (pill, title, subtitle, CTA, dashboard at 0 → 0.4s delays). A bottom gradient fades the band back into black.

## Page layout
Two sections. Section 1 is the hero described above with a plain top navbar (logo + wordmark + links left, solid white "Sign In" button right; links hidden on mobile). Section 2 is a min-h-screen testimonial: a large quote at `text-4xl md:text-5xl` where EVERY WORD is scroll-scrubbed — each word maps to a sequential slice of scroll progress and animates from 20% opacity / 35% gray to full white as the reader scrolls, so the quote reads itself in. Author row with bordered avatar below. Max-w-3xl, left-aligned.

## Typography
- Display + body: Inter (weights 400/500/600/700)
- Accent: Instrument Serif (400 + italic) — one italic serif word inside the headline
- Headline tracking `-2px`, leading ~1.15; testimonial at 4-5xl medium, leading 1.2

## Color palette
- Background: pure black, HSL `0 0% 0%`; foreground pure white
- Muted text: `0 0% 65%`; cards `0 0% 5%`; borders `0 0% 20%`
- Hero subtitle: `210 17% 95%` (cool near-white)
- CTA and "New" chip: solid white with black text
- Testimonial scrub: words travel `hsl(0 0% 35%)` → `hsl(0 0% 100%)`

## Visual motifs
- **Luminosity-blend dashboard** (the signature) — product screenshot floats over a video band in `mix-blend-mode: luminosity`, so the footage's glow moves through the static UI
- **Parallax fade-out hero** — headline group rises and fades as you scroll while the dashboard rises at a different rate, creating depth from two flat layers
- **Scroll-scrubbed testimonial** — each word of a big quote brightens from gray to white tied to its own slice of scroll progress
- **Liquid-glass tag pill with "New" chip** — pill-within-a-pill announcement; blurred glass outer, solid white inner badge
- **Serif italic accent word** — sans headline with one Instrument Serif italic word
- **Edge-to-edge video band** — negative-margin `w-screen` section breaks out of the content column for the product moment

## When to use
- Analytics, BI, and dashboard products with one strong screenshot
- B2B SaaS that wants dark and quiet instead of gradient-loud
- Finance and data tools where monochrome reads as serious
- Brands with a customer quote worth staging as a set piece
- Teams that want scroll interest without heavy scroll choreography

## When to NOT use
- Products whose screenshot must show true brand colors — the luminosity blend strips them to grayscale
- Anyone without a decent dashboard image AND background video — the hero needs both layers
- Light-brand or playful consumer products; see `pressline-pr-saas-gauge-dashboard` for the light product-preview equivalent
- Content-heavy marketing sites — this is a two-beat page, hero then quote

## Build complexity
MEDIUM. The parallax and word-scrub are standard Framer Motion `useScroll`/`useTransform` patterns, but the blend-mode band needs asset tuning (the right screenshot against the right footage) to look intentional.

## Library cross-references
- Motif: `luminosity-blend-screenshot-over-video`
- Motif: `parallax-fade-out-hero`
- Motif: `scroll-scrubbed-word-reveal`
- Motif: `liquid-glass-pill-with-chip`
- Motif: `serif-italic-accent-word`
- Typography: `inter-instrument-serif-accent`
- Color palette: `pure-black-white-hsl-neutral`
