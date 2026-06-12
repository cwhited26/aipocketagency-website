---
slug: stratum-vault-amber-terminal-cloud
name: Stratum Vault — Amber Terminal Cloud Platform
vibe: dark, warm-amber, technical, terminal-coded, scroll-orchestrated
industries: cloud storage, infrastructure platforms, devops tools, data compliance SaaS, backup services, enterprise IT, hosting providers, security-adjacent B2B
source: motionsites.ai archive (catalog title "Nimbus Grid", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
last_used: never
last_client: never
---

## Hero treatment
A dark warm-amber world — background `#17130d` with cream ink `#fff4d5` and gold accents `#ead09a`/`#ffd879` — built entirely from CSS, SVG, and text (no images anywhere on the site). The hero runs an animated shader iframe behind everything (scaled to cover the viewport, with a warm-gold gradient fallback layer if it fails to load). Header elements are GLASS PILLS: the brand chip, nav links, and CTA all sit in translucent warm-tinted capsules with 18px backdrop blur, all type in IBM Plex Mono 12px uppercase.

Top-left floats the signature: a CONSOLE CARD — a dark terminal panel with three tabs (CLI / API / Console) and fake window controls. The CLI pane types out a provisioning command character by character (42ms per char, blinking bar cursor); the API pane shows a POST request and a `202 accepted` response; the Console pane mocks a form with outlined input slots. Hero copy sits bottom-left at `clamp(29px, 3.5vw, 56px)` with a soft blurred dark ellipse behind it for legibility over the shader.

## Page layout
Six sections, heavily scroll-orchestrated: hero → a 420svh STICKY ACCORDION where four feature cards slide up from the bottom one at a time, collapsing into stacked header strips as you scroll (left mono-pill nav tracks the active card) → pricing with a per-GiB rate table and a full-bleed row of twelve gold BARS whose heights morph with sine/cosine functions of scroll position → three tall security cards (overlapping terminal + API-spec windows, checkmark compliance badges, a binary-art `<pre>` graphic) → a console showcase with a full dashboard mock that tilts in 3D and sweeps a sheen across itself on hover → an operations section with a floating 3D CSS cube that EXPLODES into ~14 shards when clicked, each shard flying to randomized 3D offsets. Mobile stacks everything; table columns drop and the cube spread tightens.

## Typography
- Display + body: IBM Plex Sans (Google Fonts, weights 400-500) — headings at normal weight, `clamp()`-scaled up to 72px
- Body: IBM Plex Mono (Google Fonts, weights 400-500) — ALL labels, nav, CTAs, code panes, and table values; the mono everywhere is the voice of the design
- Uppercase mono micro-labels at 11-12px with wide tracking

## Color palette
- Background: warm near-black `#17130d` (sections shift to `#050604`, `#11120f`, `#120f0a`, `#070a0b`)
- Ink: warm cream `#fff4d5`; muted `#dacaa1`
- Accents: gold `#ead09a` and bright gold `#ffd879`
- Console showcase accent: cool cyan `#97d3eb` (one deliberate temperature break)
- Glass: `rgba(255,239,199,0.16)` warm-tinted capsules

## Visual motifs
- **Typing console card** (the signature) — a tabbed terminal panel in the hero that types real CLI commands with a blinking cursor; API and form mock panes behind the other tabs
- **Scroll-stacked accordion** — four full-height cards slide up and collapse into header strips as the visitor scrolls a 420svh sticky section
- **Scroll-morphing bar chart** — twelve full-bleed gold bars whose heights ripple with sine waves tied to scroll position
- **Glass pill chrome** — brand, nav, and CTAs all live in warm translucent blurred capsules
- **3D dashboard tilt with sheen** — a full console mock that rotates subtly toward the cursor and sweeps a light band across itself on hover
- **Exploding cube** — a floating 3D CSS cube that bursts into staggered shards on click and reassembles on the next
- **Binary-art graphics** — icon shapes drawn as grids of 1s and 0s in a `<pre>` block; decoration made of text
- **Warm dark with one cyan room** — the console showcase section breaks to cyan, marking the product demo as a different space

## When to use
- Cloud storage, backup, and infrastructure platforms selling to IT buyers
- Devops and compliance tools whose buyers trust terminals more than stock photos
- Enterprise B2B that needs SOC2/ISO/GDPR storytelling baked into the design
- Brands wanting a fully asset-free build — every visual is CSS, SVG, or text
- Products with real CLI/API surfaces the console card can put on display

## When to NOT use
- Consumer or non-technical audiences — terminal panes and per-GiB pricing tables will alienate them
- Brands needing photography or human warmth; there are no images by design
- Quick single-hero engagements — six orchestrated sections is a full site build
- Cool-blue tech brands; the warm amber palette is the identity (for cool dark-tech use `ciphra-pink-arc-neumorphic-pipeline`)

## Build complexity
HIGH complexity. Scroll-driven sticky accordion math, scroll-morphing bars, a typewriter console, a 3D-tilt dashboard, and a 14-shard exploding cube — five custom JS systems plus full responsive collapse. Quote as a top-tier build.

## Library cross-references
- Motif: `typing-console-card`
- Motif: `scroll-stacked-accordion`
- Motif: `scroll-morphing-bar-chart`
- Motif: `glass-pill-chrome`
- Motif: `dashboard-3d-tilt-sheen`
- Motif: `exploding-css-cube`
- Motif: `binary-art-pre-graphics`
- Typography: `ibm-plex-sans-mono-terminal`
- Color palette: `warm-amber-dark-gold-cyan-break`
