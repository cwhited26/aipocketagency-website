---
slug: verda-ventures-regeneration-video-hero
name: Verda Ventures — Dark Regeneration Video Hero
vibe: dark, editorial, video-led, serif-accent, understated, premium
industries: sustainability consulting, esg advisory, impact investing, renewable energy, climate tech, environmental services, venture studios, b2b consulting
source: motionsites.ai archive (catalog title "EVR Ventures", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
last_used: never
last_client: never
---

## Hero treatment
Pure-black full-screen video hero (no dark overlay — the footage carries the mood) for a regeneration-focused ventures brand. The nav is three pill shapes: a "Menu" button on the left (rounded-full, thin border at 30% white, uppercase tracking-widest, hamburger drawn as two thin bars), the wordmark dead-center, and on desktop two more pill links plus a "Get Started" CTA filled with a soft periwinkle-to-pale-gold gradient (`hsl(220,70%,78%)` → `hsl(40,80%,82%)`) with black text. Content sits at the bottom of the viewport: a tiny uppercase eyebrow row with an arrow icon ("Verda Responsible Ventures"), then a three-line headline at `clamp(2rem, 6vw, 5rem)` — the first two lines in a light sans, the third line switching to Gilda Display serif. The serif line is the signature: one typeface change that makes the whole hero read editorial instead of corporate.

The Menu button opens a full-screen WHITE overlay that expands as a circle from the button's position (`clip-path: circle(0% at 80px 40px)` → `circle(150%)`, 0.7s, ease `[0.76, 0, 0.24, 1]`). Inside: five giant menu links at `clamp(2rem, 5vw, 4.5rem)` font-light with tight negative tracking, each with a right arrow and a hairline divider, staggering in from the left (x: -60 → 0, 0.08s per link). Body scroll locks while open.

To the right of the headline (stacked below on mobile) sits an animated SVG progress ring — a 120px circle that draws to 75% on mount over 1s with "75%" centered inside, captioned by a short mission paragraph at 70% white. The viewport closes with a partner marquee: an "Our Partners" label row, a hairline top border, then brand wordmarks at 50% white scrolling left on a 20s linear loop.

## Page layout
Single full-viewport hero. Mobile puts the headline at the top of the content area and the progress ring at the bottom; desktop bottom-aligns everything with headline and ring side by side. Nav right-side buttons hide below md. Padding runs px-6 mobile to px-10 desktop.

## Typography
- Display: Gilda Display (Google Fonts, serif) — used ONLY for the final headline line; the contrast against the sans lines is the look
- Body: Geist (Google Fonts) — light weights for headline lines one and two, `leading-[0.9]` and aggressive `-0.2em` tracking on the h1
- Eyebrow and labels: text-xs uppercase with wide `0.25em` tracking

## Color palette
- Background: pure black `#000000`
- Foreground: pure white `#ffffff`
- CTA gradient: soft periwinkle `#a3bcee` to pale gold `#f6ddac` (left to right), black text
- Borders and dividers: white at 10-30% opacity
- Marquee wordmarks: white at 50% opacity

## Visual motifs
- **Serif punchline headline** — two light sans lines, then the third line flips to Gilda Display serif; one typeface swap carries the editorial tone
- **Circle-reveal menu overlay** — the white full-screen menu expands as a circle from the Menu button corner via animated `clip-path`, links stagger in from the left
- **Animated progress ring** — a 120px SVG circle that draws to 75% on load with the number centered, paired with a short mission paragraph
- **Pastel gradient CTA on black** — the only color on the page is the periwinkle-to-gold pill button
- **Pill navigation** — Menu, links, and CTA are all rounded-full pills with thin 30% white borders
- **Full-bleed video, no overlay** — the footage runs at 100% opacity; text sits straight on it
- **Partner marquee bar** — hairline-bordered bottom strip with wordmarks at 50% white on a 20s linear loop

## When to use
- Sustainability consultancies, ESG advisors, and climate-focused firms
- Impact investing and venture brands that want quiet confidence over startup noise
- Renewable energy and environmental services with strong field footage
- B2B consulting brands selling strategy and measurable outcomes
- Anyone with one strong stat to anchor the page (the progress ring needs a real number)

## When to NOT use
- Brands without good video footage — the hero is the video, with no overlay to hide weak shots
- Local service businesses that need a phone call above the fold (use `trades-phone-first-emergency`)
- Conversion-heavy landing pages — this is a brand-mood page with one soft CTA
- Anyone who needs information density up top; the hero spends the whole viewport on mood

## Build complexity
MEDIUM — the circle clip-path menu, staggered link animation, and SVG progress ring are each small but there are several moving pieces; the rest is layout.

## Library cross-references
- Motif: `circle-reveal-menu-overlay`
- Motif: `serif-punchline-headline`
- Motif: `animated-svg-progress-ring`
- Motif: `full-bleed-video-no-overlay`
- Motif: `logo-marquee-loop`
- Typography: `geist-gilda-display-contrast`
- Color palette: `black-white-pastel-gradient-cta`
