---
slug: vesper-mail-dark-liquid-glass-app
name: Vesper — Desktop App Launch / Dark Liquid Glass with Live Mockup
vibe: dark, cinematic, glassy, app-native, premium
industries: desktop software, email and communication tools, ai productivity apps, developer tools, design tools, saas with downloadable clients, macos-first products, prosumer software
source: motionsites.ai archive (catalog title "AuraMail", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
last_used: never
last_client: never
---

## Hero treatment
A full-length dark product launch page (`#0c0c0c`) for a desktop app, built over a fixed full-screen background video that sits behind every section. The hero headline is two lines at up to 72px semibold with 0.9 leading: the first line plain white, the second the showpiece — an animated "shiny" gradient word whose deep-navy-to-cyan ramp (`#091020` → `#0B2551` → `#A4F4FD` → `#00d2ff`) sweeps across the text on a 6s loop at 200% background size, with an SVG fractal-noise filter multiplied over the letters for a brushed-metal grain. Below: a short paragraph and a white pill download button (platform logo + label + chevron that nudges on hover).

Directly under the hero, two app-native flourishes sell "this is real software": a slim OS-style menu bar strip (translucent black, blurred, with File/Edit/View menus, a clock, and progressive item hiding at smaller widths), and then a full three-pane inbox mockup in a rounded window frame — traffic-light dots, a sidebar with compose button and labeled folders with counts, a six-message list with unread states, and a reader pane showing an AI summary card, body paragraphs, and an attachment pill. The mockup is built in HTML, not a screenshot, so it stays crisp and editable.

Two hidden-on-mobile vertical hairlines (1px, 10% white) run fixed down the full page at the content container's edges, framing every section like a blueprint margin.

## Page layout
Nine sections on a max-w-6xl spine: nav (logo mark only, no wordmark), hero, menu-bar strip, inbox mockup, a feature split (eyebrow + headline + chips on the left, a liquid-glass triage card with four category sub-cards on the right), a text-only logo cloud, three liquid-glass testimonial cards, a cinematic pricing section, and a final glass CTA panel with a radial glow. The pricing section is its own set piece: a giant 9rem watermark repeat of the hero headline behind three glass cards (rounded-44px, blurred, 1px white borders) that lift 12px and glow cyan at the border on hover, with a yearly/monthly knob toggle; on mobile the grid becomes a horizontal scroll-snap carousel. Sections enter with staggered motion fades as they mount.

## Typography
- Display + body: Inter (Google Fonts, 400-900) — semibold headings with tight tracking and compressed 0.9-1.02 leading; the 9rem watermark runs weight 800 at -0.05em
- All UI text inside the mockup runs at true app sizes (12-13px), which is what makes it read as software

## Color palette
- Base: `#0c0c0c`
- Accent ramp: deep navy `#091020` / `#0B2551` through ice `#A4F4FD` to cyan `#00d2ff` — used only in the shiny headline, watermark, and small UI accents
- Glass: `rgba(255,255,255,0.01)` fills with 4px blur and gradient hairline borders
- Text ladder: white, 60% white body, 40-50% white supporting
- Mockup window: `#0e1014` at 90% with traffic lights `#ff5f57` / `#febc2e` / `#28c840`

## Visual motifs
- **Shiny grained gradient headline** — the key word carries an animated navy-to-cyan gradient sweep with an SVG noise filter multiplied in, so the letters look machined, not flat
- **HTML inbox mockup** — a complete three-pane email client (sidebar, message list, reader with AI summary card) built in markup inside a traffic-light window frame
- **OS menu bar strip** — a translucent blurred bar with app menus and a clock, placed between hero and mockup as a wink that this is desktop software
- **Liquid-glass cards** — near-transparent panels whose 1.4px borders brighten at top and bottom edges via CSS mask-composite, used for features, testimonials, and the final CTA
- **Watermark pricing backdrop** — the hero headline repeated at 9rem/weight-800 behind the pricing cards, gradient-filled and noise-filtered
- **Fixed vertical hairlines** — two 1px 10%-white lines framing the content column down the entire page
- **Hover-lift glass pricing cards** — cards rise 12px with a cyan border glow; mobile swaps the grid for scroll-snap
- **Fixed video under everything** — one background video behind all nine sections, visible through the glass

## When to use
- Desktop app launches (email, notes, design, dev tools) — the menu bar and mockup are the pitch
- AI productivity tools that want to show the product working, not describe it
- Prosumer software charging premium prices to design-aware buyers
- Products with a download CTA rather than a signup form
- Brands that want one accent ramp (navy→cyan) on an otherwise monochrome dark page

## When to NOT use
- Service businesses and non-software brands — the app chrome motifs have no referent
- Mobile-first products; the whole aesthetic argues "desktop"
- Tight scopes — nine sections plus a hand-built mockup is real work (use `bookedup-deep-shadow-saas` for a leaner dark SaaS page)
- Brands without believable in-app content to populate the mockup; lorem ipsum kills it

## Build complexity
HIGH complexity. The HTML inbox mockup, noise-filtered gradient text, liquid-glass border system, watermark pricing with a separate mobile carousel, and staggered motion all stack up.

## Library cross-references
- Motif: `shiny-grained-gradient-headline`
- Motif: `html-app-window-mockup`
- Motif: `os-menu-bar-strip`
- Motif: `liquid-glass-cards-mask-border`
- Motif: `watermark-headline-pricing`
- Motif: `fixed-vertical-hairlines`
- Motif: `fixed-video-under-page`
- Typography: `inter-compressed-leading-dark`
- Color palette: `near-black-navy-cyan-ramp`
