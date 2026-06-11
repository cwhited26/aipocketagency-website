---
slug: codenest-coding-education-dev-platform
name: CodeNest — Coding Education / Dev Platform
vibe: dark, technical, premium-tech, education-focused, liquid-glass, cyan-green-accent
industries: coding bootcamps, dev education platforms, technical course creators, dev tools SaaS, AI/ML education, dev community / membership, technical career platforms
source: motionsites.ai (catalog title "Luxury Botanical" — actual brand: CodeNest coding education platform — extracted Jun 11 2026)
last_used: never
last_key: never
last_used: never
last_client: never
---

## Hero treatment
Dark-themed full-screen hero with an HLS-streamed video background at 60% opacity. A LIQUID GLASS card floats ABOVE the main headline (`translate-y-[-50px]`) carrying a small `[ 2025 ]` year tag, an italic-serif-accent heading ("Taught by *Industry* Professionals"), and a small description. Below the card, the main headline reads "LAUNCH YOUR CODING CAREER." in heavy uppercase, with the final period in green accent. Subtle vertical grid lines at 25%/50%/75% suggest precision. A central SVG ellipse glow in cyan/dark-green adds depth without dominating.

The signature is the FLOATING LIQUID GLASS CARD positioned above the headline — a small piece of premium UI hovering in front of the main copy, signaling "this is current / curated / by someone who knows."

## Page layout
Single full-viewport hero. Vertical hierarchy: floating glass card → main headline → description → CTA. The vertical grid lines + the center-top SVG glow create implicit composition lines without competing with content.

## Typography
- Display: Inter Extra Bold — uppercase, `tracking-tight`, 40px mobile → 72px desktop
- Body: Inter
- Eyebrow: Plus Jakarta Sans, bold, 11px, color `#5ed29c`
- Italic accent: Instrument Serif italic — used for one word INSIDE the floating card heading ("Industry")
- The final period of the main headline gets the green accent color — a tiny detail that pulls the eye

## Color palette
- Background: deep near-black `#070b0a` (warm dark with a green hint)
- Primary text: white
- Body text: white at 70% opacity
- Accent: vibrant green `#5ed29c` (mint / fresh / forward — feels modern + technical, NOT corporate green)
- Glass card surface: `rgba(255, 255, 255, 0.01)` with `background-blend-mode: luminosity`, `backdrop-filter: blur(4px)`, inset 0 1px 1px rgba(255,255,255,0.1) box-shadow
- Glow: cyan/dark-green hue via SVG ellipse + 25px Gaussian blur filter

## Visual motifs
- **HLS video streaming background** (the technical signal — using HLS instead of MP4 implies "production-quality") at 60% opacity
- **Liquid glass floating card** above the headline — positioned with `translate-y-[-50px]` so it appears to hover, with a `::before` pseudo-element using `-webkit-mask-composite: xor` and `mask-composite: exclude` for a sharp gradient border frame
- **Vertical grid lines** at 25% / 50% / 75% (white at 10% opacity) — visible only on desktop, suggests a designed grid system without dominating
- **Center-top SVG ellipse glow** in cyan / dark green with 25px Gaussian blur — provides depth and color temperature
- **Italic serif accent inside a sans heading** ("Taught by *Industry* Professionals") — the Prisma mixed-style pattern but condensed into a single small card
- **Year tag `[ 2025 ]`** — signals freshness / current cohort
- **Bracketed editorial tags** as a visual motif — `[ 2025 ]`, eyebrow labels, suggest curated press-style content
- **Final-period accent color** — a tiny detail (the period after the headline is green) that demonstrates designer attention
- **Dark linear gradient overlays** on the video (left to transparent + bottom-up) for headline readability without darkening the whole video

## When to use
- Coding bootcamps, dev education platforms
- Technical course creators (online courses, cohort-based learning)
- Dev tools SaaS marketing pages
- AI / ML education platforms
- Dev communities, paid memberships, technical newsletters
- Technical career platforms (LeetCode-tier, interview prep, ML engineering paths)
- Brands whose audience is technical AND aspirational ("I want this to be my career")

## When to NOT use
- Non-technical education (use a warmer / softer direction)
- B2B SaaS that's not dev-tools-adjacent
- Consumer brands wanting approachability
- Anyone whose audience finds HLS streaming + glass cards "trying too hard"
- Lifestyle / wellness brands (the technical signal is wrong)

## Build complexity
MEDIUM complexity. The HLS video streaming + the liquid glass card are reusable patterns, but tuning the glow + grid lines for a specific brand takes iteration. Tier 3 build can ship this direction in 2-3 days.

## Library cross-references
- Motif: `hls-video-streaming-background`
- Motif: `floating-liquid-glass-card-above-headline`
- Motif: `vertical-grid-lines-composition`
- Motif: `svg-ellipse-glow-center-top`
- Motif: `italic-serif-accent-in-sans-heading`
- Motif: `final-period-accent-color`
- Motif: `bracketed-editorial-year-tag`
- Typography: `inter-extra-bold-plus-instrument-serif-italic`
- Color palette: `warm-near-black-mint-green-accent`
