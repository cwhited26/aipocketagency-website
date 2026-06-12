---
slug: ciphra-pink-arc-neumorphic-pipeline
name: Ciphra — Data Encryption / Pink Arc + Animated Icon Pipeline
vibe: dark, technical, glowing, precise, animated
industries: cybersecurity, data infrastructure, encryption services, developer tools, compliance SaaS, API platforms, fintech infrastructure, privacy products
source: motionsites.ai archive (catalog title "Cybersecurity Hero", free tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: starter
last_used: never
last_client: never
---

## Hero treatment
A rounded dark hero card (20px radius, hairline white-7% border, min-height 640px) on a black `#0a0a0f` page, capped at 1600px. Two layered effects define it. First, a GRADIENT ARC: a radial gradient centered far above the card (`circle at 50% -70%`) with a dozen hand-tuned stops walking from transparent through deepening magenta into white — it renders as a glowing pink horizon arcing across the top of the card. A 40px crosshatch grid overlays it, masked so the grid is only visible inside the arc's glow.

Second, the ICON PIPELINE: three neumorphic circular nodes (a layers icon, the brand mark, a shield-check icon) joined by thin gradient lines, with an SVG beam that travels the path on a requestAnimationFrame state machine. Phase 1 (800ms): a bright gradient window slides from the left node to the center while the left node's side-glow lights up. Splash (800ms): the beam hides and a pink radial splash ring expands and fades behind the center node. Phase 2 (800ms): the beam continues to the right node, whose purple side-glow activates. Idle 1s, loop — a 3.4s cycle reading as "data in, encrypted, verified out." Below it: a light-weight headline ("The simple way" + a gradient-text strong line), a muted sub, and a white pill CTA.

## Page layout
Three stacked blocks: a slim grid navbar (logo left, three links center, login/signup pills right, hamburger-to-X overlay menu under 768px), the hero card, and a wrapping row of five monochrome client logos at 35% white. Single screen tall on desktop. The nodes shrink and pipeline lines halve at 860px; the whole card tightens at 480px.

## Typography
- Display + body: Inter (300-800) — headline at `clamp(2.4rem, 5.5vw, 4rem)` weight 300, the strong line at weight 400 with a white-to-`#a98597` gradient clipped to the text
- Sub copy: 0.9rem at white-40%
- Nav/buttons: 0.82-0.85rem, weights 500-600

## Color palette
- Page: `#0a0a0f`; hero card: `#0d0b12`; node surfaces: `#1a1a24` / `#1e1e2c`
- Arc magenta ramp: `rgba(176,48,136,…)` deepening to `#ffffff` at the rim
- Accents: lavender `#c8a0e0`, magenta `#b04090`
- Text: `#f0f0f5`; muted `#8888a8`; borders white-8%

## Visual motifs
- **Glowing pink horizon arc** (the signature) — a many-stop radial gradient rendering a magenta-to-white arc across the card's top, with a crosshatch grid masked to appear only inside the glow
- **Animated beam pipeline** — a gradient light pulse travels node-to-node on a four-phase loop, with a splash ring at the center and side-glows that wake each node as the beam arrives
- **Neumorphic icon nodes** — soft dark circles with stacked outer/inner shadows and a dotted outer ring, pressed-metal feel; hover lifts 1px
- **Grid-in-the-glow** — the crosshatch only exists where the arc lights it, so the background reads as illuminated blueprint
- **Gradient-text headline line** — the key phrase clipped to a white-to-dusty-rose gradient
- **Monochrome logo row** — five client marks at 35% white, drawn as simple SVGs
- **Hamburger-to-X overlay nav** — two bars rotating into an X, full-screen slide-in menu on mobile

## When to use
- Security, encryption, and privacy products that want to show a process, not just claim one
- Developer infrastructure and API platforms — the pipeline reads as data flow
- Compliance and trust-heavy SaaS where a precise, engineered look earns credibility
- Fintech backends and B2B tools selling to technical buyers
- Anyone whose product is invisible — the animation gives an abstract service a visual story

## When to NOT use
- Consumer or lifestyle brands — the look is cold and technical by design
- Teams that can't maintain custom JavaScript — the beam is a hand-rolled rAF state machine, not a CSS trick
- Brands whose color is far from pink/magenta — the arc's color ramp is the identity here
- Content-heavy marketing sites needing many sections (use `bookedup-deep-shadow-saas`)

## Build complexity
HIGH. The beam animation is a requestAnimationFrame state machine with geometry recomputed on resize, the arc needs its stop ramp preserved exactly, and the z-index stack between splash, beam, and nodes is load-bearing.

## Library cross-references
- Motif: `radial-gradient-horizon-arc`
- Motif: `masked-grid-in-glow`
- Motif: `animated-beam-icon-pipeline`
- Motif: `neumorphic-dark-icon-nodes`
- Motif: `gradient-clipped-headline`
- Motif: `monochrome-client-logo-row`
- Typography: `inter-light-large-display`
- Color palette: `black-magenta-lavender-arc`
