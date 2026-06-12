---
slug: roomora-ai-interior-serif-italic-glass
name: Roomora — AI Interior Design / Serif-Italic Glass Hero
vibe: dark, glassy, editorial, video-led, premium
industries: AI consumer products, interior design, architecture visualization, home decor, furniture, real estate staging, design SaaS, creative tools
source: motionsites.ai archive (catalog title "VertexAI Hero", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
last_used: never
last_client: never
---

## Hero treatment
Full-viewport dark hero (`100vw × 100vh`, 20px outer padding) with a looping background video of interior spaces playing at full opacity — no overlay, no tint, the footage carries the mood. Content is distributed top / middle / bottom with flexbox. The headline is the signature: three centered lines mixing typefaces mid-sentence — "Meet Roomora." in regular Inter, then "Redefine space" in italic Cormorant Garamond at 1.14em of the base size, then " with / intelligent design" back in Inter. The serif italic words sit slightly larger than the sans around them, which reads as a magazine pull-quote dropped into a product page. Headline scale `clamp(36px, 4.4vw, 72px)`, line-height 0.95, letter-spacing -0.022em. One white pill CTA below ("Start free decoration") that scales to 1.05 with a white glow shadow on hover.

The top row pairs a left logo block (a four-dot SVG mark + wordmark) with a right dark-glass nav capsule: warm dark fill `rgba(20,18,16,0.42)`, 18px backdrop blur, 1px white-8% border, 16px radius — four links plus a solid white Login button at a tighter 12px radius nested inside.

## Page layout
Single hero screen, body locked (`overflow: hidden`). Bottom row is a two-corner footer: a four-line product description bottom-left at 15px / 1.18 line-height / 80% white, and bottom-right a stacked set of outlined glass tag buttons ("Solutions for complex spaces" over a row of an arrow icon button + "Conversational & Action"). All tags use a 0.75px white border at 16px radius. Below 900px the nav links hide and the footer stacks center-aligned; below 768px padding tightens and headline tracking pulls to -1px.

## Typography
- Display: Inter (400/500/600) for the sans lines — the headline runs at regular weight, not bold
- Body: Inter, 13-15px for nav, tags, and description
- Accent: Cormorant Garamond (italic 400) — only the two serif-italic words inside the headline, at 1.14em of the surrounding sans

## Color palette
- Background: near-black `#0a0a0f` base under the video
- Primary text: pure white `#ffffff`
- Secondary text: `rgba(255,255,255,0.7)`
- Nav capsule: warm dark glass `rgba(20,18,16,0.42)` with blur(18px) and a white-8% hairline
- Glass tokens: `rgba(255,255,255,0.05)` fill, `rgba(255,255,255,0.1)` border

## Visual motifs
- **Serif-italic words inside a sans headline** (the signature) — two words swap to italic Cormorant Garamond at a slightly larger optical size, mid-sentence
- **Full-bleed video with no overlay** — the interior footage plays untinted behind everything
- **Dark glass nav capsule** — links and the white Login button share one blurred rounded-rectangle container
- **Corner-anchored footer row** — description bottom-left, outlined tag buttons bottom-right, balancing the frame like a poster
- **Rotating arrow icon button** — a 44px glass circle with a diagonal arrow that rotates 45° on hover so it points to the corner
- **White pill CTA with glow** — hover scales 1.05 and the shadow shifts from black depth to white glow
- **Quiet hover grammar** — every button shares one `0.3s ease` transition; lifts of 1px, opacity dips to 90%

## When to use
- AI products with a visual, lifestyle-adjacent output — interior design, staging, decor, rendering
- Furniture and home brands with strong video footage of finished spaces
- Architecture and visualization studios that want editorial polish over tech-bro darkness
- Creative SaaS where one looping demo video sells the product better than feature copy
- Brands that want "premium tech" without purple gradients

## When to NOT use
- Anyone without strong full-screen video — the page is one screen and the footage is most of it
- Data-heavy B2B tools that need feature grids and proof sections (use `bookedup-deep-shadow-saas`)
- Warm, playful consumer brands — the dark glass reads reserved
- Long-copy conversion pages — there is room for one sentence and one button

## Build complexity
LOW. One screen, plain CSS, no scroll choreography — the work is in the type mixing and the glass capsule details.

## Library cross-references
- Motif: `serif-italic-inline-headline`
- Motif: `full-bleed-video-no-overlay`
- Motif: `dark-glass-nav-capsule`
- Motif: `corner-anchored-footer-tags`
- Motif: `rotating-arrow-icon-button`
- Typography: `inter-cormorant-italic-mix`
- Color palette: `near-black-warm-glass-white`
