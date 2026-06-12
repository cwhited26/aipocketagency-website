---
slug: corvane-payments-grayscale-video
name: Corvane — Payments on Grayscale Video
vibe: light, fintech, restrained, monochrome, trust-led
industries: payments, fintech, banking software, billing platforms, checkout providers, b2b financial services, accounting software, payroll
source: motionsites.ai archive (catalog title "FinFlow", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
last_used: never
last_client: never
---

## Hero treatment
A full-screen hero where the background video is forced to GRAYSCALE — `filter: saturate(0)` on a full-bleed autoplay loop (`/placeholder-hero.mp4`), with NO overlay. Because the footage is desaturated to near-white tones, the foreground text runs DARK: a near-black headline (`clamp(1.75rem, 6vw, 3.75rem)`, max 800px, line-height 1.1) about a faster path to financial flow, a short gray `#333333` support line, and two pill CTAs — a primary on a vertical black gradient (`#3a3a3a` to `#111111`) and a secondary 1.5px-outlined transparent pill with `backdrop-blur`. Dark-on-video is the whole trick; it only works because the saturation is stripped.

The nav matches the monochrome system: text wordmark in `#111111` on the left, a center pill group on solid `#e5e5e5` holding four links that highlight `bg-white/50` on hover, and the same outline/gradient button pair on the right. Mobile collapses to a hamburger opening a rounded `#e5e5e5` dropdown card with the links and full-width buttons.

## Page layout
One viewport, three bands: nav at top, centered headline block pulled slightly above center (`-mt-40`), and a floating TRUST CARD at the bottom — a white rounded-2xl card with a heavy soft shadow (`0 20px 60px rgba(0,0,0,0.18)`) holding six payment-network logos in their native brand colors at 60% opacity, rising to 100% on hover. The logo card is the only saturated color on the page, which makes the trust signal pop. No scroll sections, no animations beyond hover transitions.

## Typography
- Display + body: Jost (substitute for the prompt's ITC Avant Garde Gothic) — one geometric face for wordmark, headline, links, and buttons
- Headline bold, tight leading; support copy 14-18px relaxed
- Buttons and links at 13-14px in pill cases

## Color palette
- Video backdrop: grayscale via `saturate(0)`, reading as silver-white
- Ink: `#111111` headline and wordmark, `#333333` support copy, `#222222` outlines
- Nav pill group and mobile card: `#e5e5e5`
- Primary CTA: gradient `#3a3a3a` to `#111111`, white label
- Trust card: white `#ffffff` with `0 20px 60px rgba(0,0,0,0.18)` shadow

## Visual motifs
- **Grayscale video with dark text** (the signature) — the footage is desaturated to silver so near-black type sits directly on it with no overlay
- **Color reserved for the trust card** — the six payment-brand logos are the only full-color elements on the page; trust gets the saturation budget
- **Floating shadow card** — a white rounded card with a deep two-layer soft shadow, docked at the bottom of the viewport
- **Black-gradient pill CTA** — vertical `#3a3a3a` to `#111111` gradient pills paired with 1.5px outline secondaries everywhere (nav, hero, mobile sheet)
- **Pill-group navigation** — links live inside one light-gray rounded capsule, each lighting up `white/50` on hover
- **Sized-up logo row** — wider logo marks render ~15% taller than the rest so the row reads optically even

## When to use
- Payments, billing, and checkout platforms that lead with processor and network partnerships
- Fintech brands that want motion in the hero without the usual dark-mode look
- B2B financial products where restraint and neutrality read as credibility
- Companies with recognizable integration partners worth a logo row
- One-message launches: single headline, two buttons, proof strip, done

## When to NOT use
- Footage with dark or busy regions — dark text on video fails without the near-white grayscale
- Brands whose identity depends on color; this layout allows almost none outside the logo card
- Pages needing features, pricing, or any second section — it is a single-viewport hero
- Consumer apps chasing warmth or play; the monochrome reads institutional

## Build complexity
LOW — one CSS filter, static layout, hover transitions only; the care goes into picking footage bright enough to carry dark type.

## Library cross-references
- Motif: `grayscale-video-dark-text`
- Motif: `floating-shadow-trust-card`
- Motif: `black-gradient-pill-cta`
- Motif: `pill-group-navigation`
- Motif: `color-reserved-for-logos`
- Typography: `jost-geometric-mono-weight`
- Color palette: `silver-video-ink-monochrome`
