---
slug: stepdoc-minimal-workflow-saas
name: Stepdoc — Minimal Workflow SaaS / Slate on Video
vibe: minimal, calm, slate, product-led, quiet-confidence
industries: workflow software, sop and training platforms, hr onboarding, internal tools, documentation saas, productivity tools, ops consulting, b2b software
source: motionsites.ai archive (catalog title "Minimal Workflow SaaS", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
last_used: never
last_client: never
---

## Hero treatment
A light, restrained SaaS hero sitting on a full-bleed background video. The video covers the whole viewport at 98% opacity with an extremely subtle white wash (`bg-white/[0.05]`) and a 2px backdrop blur — the footage reads as texture, not spectacle. Content is centered: a three-line headline at a modest ~45px desktop / 36px mobile, a small 13px subtext, and a single dark-gradient pill CTA. Everything fades up in a stagger (headline 0s, subtext 0.2s, button 0.4s).

The signature is below the CTA: an infinite auto-scrolling task queue inside a glass highlight card. A static frosted-glass row (`bg-white/[0.08]`, backdrop blur, 1px white border at 20%, inset top highlight) holds a small white icon tile with the brand's tilted three-bar mark. Behind it, a list of how-to tasks ("How to build charts with data in Excel", "How to set up a custom task rule in Asana"...) slides upward one item every 4.5 seconds. The active row sits inside the glass card with a tiny uppercase "Learn the step" label; queued rows fade and blur progressively below it (opacity 0.55 → 0.04, blur 0.2px → 1.1px per step). The list is tripled in the DOM and silently teleports back to the start when exhausted, so the loop never visibly resets. Slide easing is a custom `cubic-bezier(0.16, 1, 0.3, 1)` over 1 second — fast start, long smooth landing.

## Page layout
Effectively a single-viewport hero: minimal top nav (wordmark + tilted three-bar logo left, five centered 13px links, a small frosted "Join us" pill right), hero content centered, and a faint "All people aligned." tagline at 50% white below the task list. A monochrome eight-logo brand strip exists as a white band component for an optional second section. Nav links hide on mobile; the task list narrows from 420px to 340px; headline steps down one size.

## Typography
- Display + body: Inter (Google Fonts, weights 400-700) — one face for everything, hierarchy carried by size and opacity, not weight contrast
- Deliberately small scale: headline ~45px, subtext 13px, nav links 13px, task rows 11.5-13px, labels down to 7.5px uppercase

## Color palette
- Page base: `#f8fafc` (slate-50)
- Primary text: `#1e293b` (slate-800), brand mark `#0f172a`
- CTA gradient: `#252a38` to `#1a1e29` (charcoal-navy) with an inset white top highlight
- Muted gray accent on logo bar: `#64748b`
- On-video text: white at 100/70/50% opacity steps; no purple or indigo anywhere

## Visual motifs
- **Auto-scrolling task queue** (the signature) — an infinite upward-sliding list of how-to tasks; tripled array, silent teleport reset, one slide per 4.5s with `cubic-bezier(0.16, 1, 0.3, 1)` easing
- **Glass highlight row** — a static frosted card the active task slides into: `bg-white/[0.08]`, backdrop blur, 1px white/20 border, inset top highlight shadow
- **Fade-and-blur depth stack** — queued list items lose opacity and gain blur the further from the active row, reading as physical depth
- **Tilted three-bar logo mark** — three staggered rounded bars rotated -15°, repeated as a mini mark inside the white icon tile
- **Whisper-quiet video background** — full-bleed footage at 98% opacity under a 5% white wash and 2px blur; texture, not hero imagery
- **Dark gradient pill CTA** — charcoal-navy gradient with `inset 0 1px 0 rgba(255,255,255,0.12)` highlight and active-press scale
- **Monochrome logo strip** — eight inline-SVG brand marks in slate grays, all type-and-icon, no color logos

## When to use
- Workflow, SOP, or training-documentation software
- HR onboarding and internal-tools products
- Any SaaS whose pitch is "we make process simple" — the quiet scale backs the claim
- Products that demo well as a list of small repeatable steps
- Teams that want a product moment in the hero without building a full dashboard mock

## When to NOT use
- Brands that need bold color — this direction is slate-and-white by design
- Local service businesses; it reads pure software (use `trades-phone-first-emergency`)
- Marketing teams that want big 100px+ headline energy — the whole point here is small type
- Anyone without believable task content to feed the queue; lorem ipsum kills the effect

## Build complexity
MEDIUM. The layout is simple, but the task-queue animation needs careful state work — interval, distance-based position/opacity/blur math, and the silent teleport reset — to loop without a visible jump.

## Library cross-references
- Motif: `auto-scrolling-task-queue`
- Motif: `glass-highlight-row`
- Motif: `fade-blur-depth-stack`
- Motif: `whisper-video-background`
- Motif: `dark-gradient-pill-cta`
- Motif: `monochrome-logo-strip`
- Typography: `inter-single-face-small-scale`
- Color palette: `slate-white-charcoal-navy`
