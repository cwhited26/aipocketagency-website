---
slug: targo-logistics-dark-red-clipped
name: Targo — Logistics / Dark Red / Clipped Corners
vibe: dark, bold, industrial, refined-but-no-nonsense, brand-color-led
industries: logistics, shipping, freight, warehousing, trucking, fleet services, supply chain SaaS, industrial automation, B2B service-with-physical-component
source: motionsites.ai (Targo Logistics Hero prompt, premium tier — extracted Jun 11 2026)
last_used: never
last_client: never
---

## Hero treatment
Dark-themed full-bleed hero for a logistics brand. Full-screen background video, no overlay. The HEADLINE is top-third left-aligned ("Swift and Simple Transport") with a primary "Get Started" CTA in BRAND RED with CLIPPED CORNERS (CSS `clip-path` diagonal cuts on top-right and bottom-left). A "Book a Free Consultation" liquid-glass card sits in the bottom-left corner with a Phone icon. The header has a small red "Contact Us" button (same clipped corners) on the right.

The signature is the clipped-corner geometry — every primary button has a small geometric diagonal cut at the corners, suggesting precision, engineering, and industrial confidence (vs. soft rounded pills that read as consumer SaaS).

## Page layout
Single full-viewport hero with a refined-feeling layout (not full-bleed maximalism). Headlines around 64px desktop / 42px mobile — deliberately RESTRAINED for the category (logistics brands often over-shout; this one whispers). Generous but compact spacing — 64px desktop padding / 32px mobile.

## Typography
- Display + body: Rubik (Google Fonts) — bold, uppercase headlines with tight letter-spacing (`-4%`)
- Headline sizing: ~64px desktop, ~42px mobile (the prompt's deliberate "scaled-down professional look")

## Color palette
- Background: pure black `#000000`
- Primary text: crisp white
- Brand accent: vibrant red `#EE3F2C` (logistics-coded but modern — between safety orange and a confident red)
- Secondary CTA: solid white
- Glass card: `backdrop-filter: blur(40px) saturate(180%)`, 1px white border at 12% opacity, diagonal white-to-transparent shine gradient, inner box-shadow for depth

## Visual motifs
- **Clipped-corner buttons** (the signature) — every primary button uses CSS `clip-path` with 10-12px diagonal cuts on top-right + bottom-left corners. The geometry signals precision / engineering / industrial confidence
- **Full-bleed video background, 100% opacity, NO dark overlay** — bold confidence; the video carries the mood
- **Liquid-glass consultation card** with advanced glassmorphism, sitting bottom-left as a floating CTA
- **Phone icon (lucide-react)** inside the consultation card — explicit call-to-call cue
- **Restrained headline scale** (64px not 140px) — the brand whispers, doesn't shout
- **Diagonal white-to-transparent shine gradient** on the glass card surface — premium glass-pane finish
- **Top navigation with a small clipped-corner red CTA** on the right side, matching the hero geometry

## When to use
- Logistics, shipping, freight, warehousing, trucking
- Fleet services and supply chain SaaS
- B2B services with a physical / industrial component
- Industrial automation, robotics
- Anyone whose brand identity is "precise / dependable / engineered" — not "playful / creative / consumer"
- Brands where confident restraint reads better than maximalism

## When to NOT use
- Consumer brands wanting warmth or approachability
- Local services where the call IS the conversion (use `trades-phone-first-emergency`)
- Anyone whose brand color isn't red (the red is load-bearing — swap to navy or green if needed but the clipped-corner geometry needs the brand color to anchor)
- Mobile-dominant traffic where the small headline + restrained scale reads as TOO subtle

## Build complexity
LOW complexity. The clipped-corner CSS is reusable. The glass card is a single component. Tier 2 build can ship this direction in a focused day.

## Library cross-references
- Motif: `clipped-corner-buttons-csspath`
- Motif: `liquid-glass-consultation-card`
- Motif: `full-bleed-video-no-overlay`
- Motif: `restrained-headline-scale`
- Motif: `phone-icon-inline-cta`
- Typography: `rubik-bold-uppercase-tight`
- Color palette: `black-brand-red-white-restrained`
