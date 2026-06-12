---
slug: imagra-pastel-radial-feature-cards
name: Imagra — AI Image Tool / Pastel Radial Feature Cards
vibe: light, pastel, soft, friendly, product-illustrative
industries: ai image tools, creative software, design tools, photo apps, content creation saas, prompt tools, developer apis, consumer ai apps
source: motionsites.ai archive (catalog title "AI Image Generator UI", free tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: starter
last_used: never
last_client: never
---

## Hero treatment
This is a FEATURES SECTION pattern, not a full hero — a single centered block (max-width 1100px) on white that other directions can borrow or a features-led page can be built around. Header stack: a small uppercase badge ("CORE FEATURES") in gradient-clipped text (`linear-gradient(90deg, #F5C344, #F28482, #B567C2)`), a 2.75rem medium-weight title ("Built for Speed & Quality"), and a two-line gray subtitle.

Below it, the signature: three 340px-tall rounded cards, each glowing with a top-centered radial gradient that melts into the same neutral base (`#F4F8F9`) — card 1 amber-to-lemon, card 2 lilac-to-coral, card 3 lemon-to-lilac. Each card stages a tiny faked product moment in pure CSS: card 1 shows a white prompt box where key phrases are gradient-highlighted, plus a floating "✦ Add more details" pill with a hand-drawn-style cursor arrow SVG hovering mid-click; card 2 centers a network/connections illustration for API access; card 3 layers a white 16px mesh grid (two 1px linear-gradients, radially masked so it fades outward), a floating folder icon, and a "Search in library" pill with a search glyph. Everything is static — no animation, no hover states, no JavaScript.

## Page layout
One centered container: header block, then a 3-column grid with 24px gaps. Cards are flex-column justify-end so the feature name (1.05rem, weight 600) anchors the bottom-left at 24px padding while the visual fills the upper area. Drops to 2 columns under 900px and 1 column under 600px (title scales to 2.25rem). 80px vertical page padding.

## Typography
- Display + body: Inter (Google Fonts, weights 400/500/600) — title at 2.75rem weight 500 with -0.02em tracking; deliberately NOT bold, the pastel palette does the talking
- Badge: 0.75rem, weight 600, uppercase, 1px letterspacing, gradient-clipped
- Card UI text at 0.75-0.8rem — small enough to read as miniature product chrome

## Color palette
- Page: white `#ffffff`; card base `#F4F8F9` (cool near-white)
- Ink: slate `#0f172a` titles, `#1e293b` card headings, `#64748b` / `#475569` muted
- Card glows: amber `#FFB347`, lemon `#F9ED96`, lilac `#E5A1F5`, coral `#F8ACA0`
- Badge/highlight gradient: gold `#F5C344` → coral `#F28482` → purple `#B567C2`
- Accent sparkle: purple `#a855f7`

## Visual motifs
- **Top-glow radial cards** — each card's background is a radial gradient bursting from top-center in two pastels, fading to the neutral base by 60%; three cards, three different pastel pairings
- **Gradient-highlighted prompt text** — a mock prompt where the important phrases are gradient-clipped and bolded, showing the product "understanding" the prompt
- **Floating pill with cursor** — a small white bordered pill button with a sparkle glyph, plus a cursor-arrow SVG with drop shadow frozen mid-click beside it — a faked interaction moment in pure CSS
- **Masked mesh grid** — a fine white 16px grid overlay, radially masked so it's strongest at top-center and dissolves outward
- **Bottom-left card captions** — feature names sit quietly at the card's bottom-left while the visual owns the upper two-thirds
- **Gradient-clipped section badge** — the uppercase kicker rendered in a three-color gradient instead of a solid
- **Miniature product chrome** — search pills, prompt boxes, and folder icons at small scale stand in for screenshots

## When to use
- AI image, content, or creative tools that need a features section with personality
- Products whose features (prompting, API, library) are better staged than screenshotted
- Light, friendly consumer-facing SaaS where pastels fit the brand
- As the features block inside a larger light-themed build — it composes cleanly
- Teams with no product screenshots yet; everything here is fake-able in CSS

## When to NOT use
- As a standalone landing page — it has no hero, no CTA, no nav; it is one section
- Dark or serious enterprise brands — the pastel glow reads playful
- Feature sets that need real screenshots or data to convince
- Brands already using a strong saturated palette that would clash with the pastels

## Build complexity
LOW complexity. Static HTML/CSS — radial gradients, one masked grid, absolute-positioned pills. No JavaScript, no animation. The only care point is tuning the pastel stops so the glows match across cards.

## Library cross-references
- Motif: `top-glow-radial-cards`
- Motif: `gradient-highlighted-prompt-text`
- Motif: `faked-cursor-interaction`
- Motif: `masked-mesh-grid-overlay`
- Motif: `gradient-clipped-section-badge`
- Typography: `inter-medium-weight-restraint`
- Color palette: `pastel-glow-on-cool-white`
