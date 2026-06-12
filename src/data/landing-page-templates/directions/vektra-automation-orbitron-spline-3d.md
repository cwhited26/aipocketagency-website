---
slug: vektra-automation-orbitron-spline-3d
name: Vektra — Automation Machines / Orbitron Sci-Fi / Spline 3D
vibe: dark, sci-fi, 3d-scene, mono-detail, engineered
industries: industrial automation, robotics, machine builders, hardware startups, iot, manufacturing tech, ai infrastructure, dev tools
source: motionsites.ai archive (catalog title "Automation Machines", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
last_used: never
last_client: never
---

## Hero treatment
Single full-viewport black hero with NO navbar — the hero is the entire page — and an interactive Spline 3D scene filling the viewport behind everything, shifted 15% to the right so the machine renders off-center while the type owns the left. The content layer sits above at z-10 with `pointer-events-none` (individual buttons opt back in with `pointer-events-auto`), so the cursor reaches the 3D scene everywhere except on controls.

Upper-left: the heading in Orbitron at `40-72px`, font-extralight, uppercase, two lines ("Automation / Machines •" pattern with a bullet glyph), wearing a left-to-right gradient clip from `white/20` through `white/70` to full white — the headline literally fades in from nothing on its left edge. Below it a short light subtitle, then three circular hairline icon buttons (snowflake, maximize, zap) in a row. Entrances stagger on a fixed timeline: heading slides in from the left at 0s, subtitle 0.2s, icons 0.4s, specs card 0.8s, badge bar 1.0s.

## Page layout
A flex column pinning content to top and bottom of the viewport (12-col grid on desktop, stacked on mobile). Bottom-left: a "Technical Specs" card — a micro-label at 10px mono with `0.3em` tracking, then four hairline-divided rows pairing a label with a JetBrains Mono value (stack, runtime, uptime, scale pattern). Bottom-right: a frosted pill bar (`bg-white/10` backdrop-blur, rounded-full) holding four small mono badges — one active in solid white-on-black text inversion, three outlined. Selection color is inverted (white background, black text) as a tiny system-level flourish.

## Typography
- Display: Orbitron (Google Fonts, 400-900) — uppercase, font-extralight at hero scale, tracking-tight
- Body: Space Grotesk (300-700) — light subtitle and labels
- Mono: JetBrains Mono (400/500) — spec values and pill badges at 10px with wide tracking
- Accent on reserve: Instrument Serif italic is loaded in the theme but unused in the hero

## Color palette
- Background: pure black `#000` / `#0a0a0a`
- Text: `#f5f5f5` white with opacity steps (`/80`, `/70`, `/60`, `/20`, `/10`, `/5`)
- Brand orange `#F27D26` defined in the theme as the single warm token
- Hairlines: `#1f1f1f` strokes and `white/10` borders
- Headline gradient: `from-white/20 via-white/70 to-white`

## Visual motifs
- **Spline 3D scene as the background** (the signature) — a live 3D machine scene fills the viewport, lazy-loaded behind Suspense, offset 15% right so content and render share the frame
- **Gradient-reveal headline** — uppercase Orbitron clipped to a horizontal white gradient that fades the left edge to 20% opacity
- **Pointer-events pass-through** — the whole content layer ignores the mouse so visitors can spin the 3D scene; only buttons capture clicks
- **Technical specs card** — four hairline rows pairing plain labels with mono values, headed by a wide-tracked micro-label
- **Mono badge pill bar** — frosted capsule of tiny monospace badges, one inverted solid-white as the active state
- **Circular hairline icon buttons** — 40px rings with thin white/20 borders that brighten on hover
- **Fixed-timeline entrance stagger** — five elements arrive over one second in reading order, no scroll triggers

## When to use
- Robotics, industrial automation, and machine builders with a 3D model worth showing
- Hardware and IoT startups that want the product rendered, not photographed
- Dev-tool or infrastructure brands going for a terminal/engineering register (mono details do the work)
- Single-page teaser or launch pages — no nav means no expectation of depth
- Brands that want visitors to PLAY with the hero — the scene is interactive

## When to NOT use
- Anyone without a 3D asset — the Spline scene is the page; a video fallback changes the whole direction
- Performance-strict or low-end-device audiences — a live 3D runtime is heavy
- Multi-page marketing sites — there is no navbar and no scroll content
- Warm or human-centered brands — Orbitron + mono reads machine-cold by design
- Conversion pages needing a clear single CTA — the hero offers exploration, not a funnel

## Build complexity
MEDIUM. The layout and stagger are simple, but the direction depends on producing or licensing a Spline scene, tuning its right-offset placement across breakpoints, and lazy-loading it without layout jank.

## Library cross-references
- Motif: `spline-3d-scene-background`
- Motif: `gradient-reveal-uppercase-headline`
- Motif: `pointer-events-passthrough-content`
- Motif: `mono-spec-rows-hairline`
- Motif: `mono-badge-pill-bar`
- Typography: `orbitron-space-grotesk-jetbrains-mono`
- Color palette: `pure-black-white-opacity-steps-orange-token`
