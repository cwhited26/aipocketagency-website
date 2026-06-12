---
slug: plotwise-geo-map-saas-hero
name: Plotwise — Geo-Mapping SaaS / Selection-Box Headline
vibe: clean, friendly, product-led, blue, light
industries: mapping software, gis platforms, logistics SaaS, real estate tech, field service software, data visualization tools, analytics platforms, developer tools
last_used: never
last_client: never
source: motionsites.ai archive (catalog title "Terra Geo Map", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
---

## Hero treatment
Light, product-led SaaS hero in the modern launch-page mold. Centered column: a Product Hunt badge pill at the top (red-tinted border and wash, trophy emoji, "#1 Product of the Day"), then a two-line headline where line one ("The ultimate geo") and the word "map" are solid brand blue `#2E7DF3`, and the final word "builder" gets two treatments at once — a silver gradient text fill (135deg, `#767676` → `#D3D3D3`, clipped to the text) AND a hand-drawn dotted SELECTION BOX drawn around it in SVG. The selection box is the signature: an irregular dashed quadrilateral (the bottom-right corner drops lower than the bottom-left), rotated -0.5deg, with corner and midpoint handle dots — the word looks like it's selected inside the product's own editor.

Below: a short three-line subtext, a single solid-blue rounded-full CTA with a soft blue shadow (`shadow-primary/20`), and then the product itself — a large autoplaying demo video in a rounded-xl frame, max-w-5xl, no drop shadow. The video IS the proof; everything above it is just the setup.

## Page layout
One hero screen: slim navbar (gradient logo circle with a globe emoji + bold wordmark, five nav links with dropdown chevrons, ghost Login + solid Sign Up pills), centered hero column, demo video. Below-lg the nav collapses to a hamburger with a full dropdown. The page is min-h-screen flex; the hero column centers in the remaining space.

## Typography
- Display + body: Inter (Google Fonts, weights 400/500/700) — headline at font-medium, text-5xl to text-7xl, with aggressive negative letter-spacing
- Subtext: text-base to text-lg, muted gray, max-w-lg, centered
- Tiny uppercase label inside the badge: 10px, wide tracking

## Color palette
- Background: white / near-white
- Brand blue: `#2E7DF3` (headline words, CTA, logo gradient to blue-400)
- Gradient word fill: silver `#767676` → `#D3D3D3`
- Selection box strokes and dots: neutral gray `#B0B0B0`, dashed 6-4
- Product Hunt badge: red-400/red-500 text on a red-50 wash

## Visual motifs
- **Dotted selection box around a headline word** — an SVG dashed quadrilateral with corner + midpoint handle dots, slightly rotated and deliberately irregular, making one word look selected in a design tool; the product's interaction language leaks into the marketing type
- **Two-tone headline** — brand blue for most words, a silver gradient clip for the boxed word
- **Product Hunt badge pill** — red-tinted bordered pill with trophy emoji and "#1 Product of the Day"; swap for any launch or award proof
- **Demo video as the hero floor** — a big rounded-corner autoplay product video directly under the CTA, no chrome, no shadow
- **Gradient logo circle with emoji** — 32px circle, blue gradient, a globe emoji as the mark
- **Pill CTA with colored shadow** — solid blue rounded-full button casting a soft blue glow

## When to use
- Mapping, GIS, and location-intelligence products
- Any SaaS with a visual editor — the selection-box motif works for design, diagram, and dashboard tools
- Products with a strong screen-recorded demo to autoplay
- Launch-day pages where a Product Hunt or award badge is real
- Teams that want a friendly, light, credible look without heavy animation

## When to NOT use
- Brands without a demo video or strong product visuals — the layout points everything at the demo
- Dark, cinematic, or luxury brands (use `spd-luxury-automation-cinematic`)
- Service businesses with no product UI; the selection-box conceit only makes sense for software
- Pages that need rich storytelling sections — this is a single-screen product intro

## Build complexity
LOW. Static layout plus one custom SVG; the selection box is the only bespoke element and it's a single absolutely-positioned graphic.

## Library cross-references
- Motif: `dotted-selection-box-headline-word`
- Motif: `two-tone-gradient-headline`
- Motif: `launch-badge-pill`
- Motif: `demo-video-hero-floor`
- Motif: `pill-cta-colored-shadow`
- Typography: `inter-medium-tight-tracking`
- Color palette: `white-brand-blue-silver-gradient`
