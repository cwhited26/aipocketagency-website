---
slug: astreon-aerospace-engine-sky-hero
name: Astreon — Aerospace Engine Sky-Gradient Hero
vibe: light, engineered, monumental, airy, data-backed, precise
industries: aerospace, defense manufacturing, advanced manufacturing, industrial hardware, energy equipment, robotics, automotive engineering, deep tech, precision machining
source: motionsites.ai archive (catalog title "AeroCore", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
last_used: never
last_client: never
---

## Hero treatment
A tall hero (180vh+) on a SKY GRADIENT — `#7191d0` at the top through `#aab8d5` to a cloud tone `#ece9e6` — that LERPS toward warm dawn tones (rgb 240/232/220 territory) as the visitor scrolls, the sky literally changing time of day. The headline is monumental and ultra-light: white, weight 200, `clamp(144px, 18vw, 285px)`, line-height 0.88, split across two fixed rows ("Powering" on row one, "the    Ship" on row two offset 15vw with a wide gap). A photoreal cutout of the product — a rocket engine — is fixed dead center with a deep drop shadow, layered BETWEEN the title rows (z-index 10 / 3 / 2), so the hardware sits inside the typography.

Scroll runs a parallax stack on a single rAF loop: title rows drift up at -120px across the hero, the engine at -250px, and a bottom-left caption ("Precision engines for orbital-class vehicles" beside a 44px vertical rule) at -60px. Everything fades out between 0.9 and 1.35 viewport heights of scroll, and the hero gets an `is-past` class that kills pointer events. The nav hides on scroll-down and returns on scroll-up; a white pill CTA with an inset 1px white ring lifts 1px on hover.

## Page layout
A full marketing site, all light: mission statement section (small bold eyebrow in column one, a clamp 29-41px weight-260 statement in column two on a wide two-column grid, pulled up -12vh over the hero); a showcase where a fixed full-screen film layer expands out of the mission media on scroll and steps through four numbered panels (01 Precision Manufacturing, 02 Advanced Materials, 03 Thermal Testing, 04 Mission Certified — each label/title/description); a capabilities bento grid mixing metric cards, a quote card, a contact card, a media card, and a two-row tool marquee scrolling in opposite directions; a stats section with four tabs driving an animated bar chart (bars, traces, and sparklines draw in when the chart gets an `is-ready` class); a horizontal video-stories rail of five program-story cards; and a footer with a large heading and a dot-grid flourish. Content width caps at 1820px with generous clamp-based gutters.

## Typography
- Display + body: Geist (Google Fonts) — the signature is weight contrast: 200 for the 285px hero title and 260 for section statements, 700 for tiny eyebrows
- Phosphor icon set for UI glyphs
- Body copy 16px/22px; micro-labels small, bold, no letter-spacing tricks — engineering-plain

## Color palette
- Hero sky: `#7191d0` to `#aab8d5` to `#ece9e6`, scroll-lerped toward warm `#f0e8dc`
- Page: white `#ffffff`
- Ink: `#0a0a0a` / `#161616` with muted `#666666`
- Hero type and CTA ring: white over the sky
- Caption gray: `rgba(42,42,42,0.58)`

## Visual motifs
- **Hardware between the headline rows** (the signature) — the fixed product cutout is z-stacked between the first and second title lines, so the 285px type wraps around the machine
- **Time-of-day sky lerp** — scroll progress mixes the three gradient stops from blue morning sky to warm dawn, computed per frame
- **Three-speed fixed parallax** — title -120px, engine -250px, caption -60px, all fading out across 0.9-1.35 viewport heights
- **Scroll-direction nav** — the bar hides when scrolling down and slides back the moment you scroll up
- **Expanding film layer** — a fixed video grows from a small mission image to full screen and steps through four numbered capability panels as you scroll
- **Counter-scrolling tool marquee** — two rows of tool names moving in opposite directions inside a bento card
- **Tabbed animated stat charts** — four tabs swap bar-chart datasets; bars and trace lines draw in on entry
- **Caption with vertical rule** — a one-line claim beside a 44px hairline, pinned bottom-left of the hero

## When to use
- Aerospace, defense, robotics, and precision-manufacturing companies with one hero product to photograph
- Industrial hardware brands that want monumental type without going dark
- Deep-tech companies that have real numbers — the tabbed charts need data behind them
- Engineering firms selling long-cycle programs, where the page must read calm and exact
- Brands with strong test-cell or factory footage for the film and stories sections

## When to NOT use
- Companies without a single iconic product image — the hero is built around one cutout
- Service businesses and software-only products; the layout assumes physical hardware
- Dark-brand industrial looks — use `targo-logistics-dark-red-clipped` for that register
- Small scopes — this is a six-section site with charts and a scroll film, not a one-day hero
- Mobile-dominant audiences; the between-the-lines type stack compresses hard on phones

## Build complexity
HIGH — custom-element scroll engine, per-frame gradient mixing, an expanding fixed film layer with scroll lock, and animated chart components; quote it as a multi-day build.

## Library cross-references
- Motif: `hardware-between-headline-rows`
- Motif: `time-of-day-sky-lerp`
- Motif: `three-speed-fixed-parallax`
- Motif: `scroll-direction-nav`
- Motif: `expanding-film-layer`
- Motif: `counter-scrolling-tool-marquee`
- Motif: `tabbed-animated-stat-charts`
- Typography: `geist-ultralight-monumental`
- Color palette: `sky-blue-cloud-white-ink`
