---
slug: quarry-ultralight-glass-saas-hero
name: Quarry — Productivity SaaS / Ultra-Light Glass
vibe: airy, ultra-light, glassy, minimal, cinematic
industries: productivity SaaS, team collaboration tools, project management software, B2B software, knowledge management, hr software, workplace platforms, startup tools
last_used: never
last_client: never
source: motionsites.ai archive (catalog title "Slate", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
---

## Hero treatment
Full-screen video hero where EVERY interface surface is liquid glass and EVERY letter is ultra-light. The global font weight is 200 — applied to literally everything via a universal selector — which gives the page a whisper-thin, premium feel against the full-bleed background video. The headline ("Grow Your Team" / "Thriving") is two stacked lines at `clamp(36px, 8vw, 76px)`, letter-spacing -1.5px, animated with a GSAP SplitText character entrance: each char rises 40px and fades in over 0.8s on power3.out with a 60ms stagger. A soft text-shadow (0 2px 20px black at 30%) keeps the thin strokes legible over video.

Above the headline sits a liquid-glass badge pill ("Welcome to Slate 2.4" | "Read Guide →" with a divider). Below, subtext and two CTAs fade up on a staggered cubic-bezier(0.22, 1, 0.36, 1) timeline (0.6s, 0.85s, 1.0s delays). The primary CTA is a glass pill with a brighter white fill (rgba 0.22) and an ArrowUpRight icon that nudges diagonally on hover; the secondary is bare glass that gains a faint white wash on hover.

## Page layout
Single full-viewport hero: navbar (geometric chevron-mark logo + wordmark left, five nav links center, glass "Start today" pill right), centered hero column. Locked to viewport height on desktop (`lg:h-screen lg:overflow-hidden`), free-scrolling on mobile. No color anywhere — the entire foreground is white at varying opacities; the video supplies all the color.

## Typography
- Display + body: Inter at weight 200 (substitute for the prompt's Helvetica Neue ultra-light) — one face, one weight, applied globally including headings
- Headline: clamp(36px, 8vw, 76px), letter-spacing -1.5px, line-height 1.1, second line pulled up with -0.15em margin
- Subtext: clamp(13px, 1.5vw, 17px) at 65% white

## Color palette
- Foreground: white `#ffffff` at tiered opacities (100% headline, 65% subtext, 70% nav links)
- Glass fills: `rgba(255,255,255,0.22)` on emphasized pills, near-zero `rgba(255,255,255,0.01)` on quiet ones
- Fallback page base behind video: near-black `#0a0a0a`
- Explicit constraint: no purple or indigo hues, no colored accents at all — white-on-video only

## Visual motifs
- **Everything is glass** — navbar CTA, badge pill, both hero CTAs all use one liquid-glass recipe: luminosity blend, 4px backdrop blur, inset top highlight, and a gradient hairline border drawn with mask-composite exclude
- **Ultra-light type as the identity** — weight 200 on every element including h1; the thinness IS the brand
- **Character-stagger headline entrance** — GSAP SplitText chars rise 40px and fade over 0.8s, power3.out, 60ms per-char delay
- **Stacked two-line display heading** — second line tucked up with negative margin so the lines read as one mass
- **Staggered fade-up timeline** — subtext then primary then secondary CTA, each on its own animation delay with a soft spring-like cubic-bezier
- **Diagonal-nudge hover arrow** — ArrowUpRight icon translates up-right 0.5px on group hover
- **Full-bleed video, zero overlay** — the video runs at full opacity; legibility comes from text-shadow, not a scrim

## When to use
- Productivity and collaboration SaaS that wants a calm, premium first impression
- B2B software launching with a single strong brand video
- Workplace, HR, or knowledge tools targeting design-aware buyers
- Brands that want minimal copy and maximum atmosphere
- Products whose UI screenshots are weak — this hero needs no product shot at all

## When to NOT use
- Brands that need color-coded identity in the hero — this direction is strictly white-on-video
- Local service businesses where a phone call is the conversion (use `trades-phone-first-emergency`)
- Anyone without a strong looping video; bare glass over a flat background falls apart
- Audiences on old hardware — heavy backdrop-filter use is GPU-hungry

## Build complexity
LOW-MEDIUM. One screen, one glass recipe reused four times; the GSAP SplitText component is the only real engineering.

## Library cross-references
- Motif: `liquid-glass-pill-system`
- Motif: `gsap-splittext-char-entrance`
- Motif: `ultra-light-global-weight`
- Motif: `staggered-fade-up-timeline`
- Motif: `full-bleed-video-no-overlay`
- Typography: `single-face-weight-200`
- Color palette: `white-opacity-tiers-on-video`
