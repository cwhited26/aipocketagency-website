---
slug: markwell-anton-stat-corners-portfolio
name: Markwell — Brand Designer Portfolio / Anton Stat Corners
vibe: confident, editorial, static, type-led, cream-on-video
industries: brand designers, freelance creatives, design studios, marketing consultants, copywriters, photographers, personal brands, boutique agencies
source: motionsites.ai archive (catalog title "xPortfolio Hero", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
last_used: never
last_client: never
---

## Hero treatment
One viewport, no scrolling. A fullscreen background video runs behind everything (fixed, object-cover, pointer-events off) while ALL the content sits on top in black text — no overlay, no glass, the video and the type share the frame directly. The headline is a giant Anton uppercase block top-left: "BUILDING / BRANDS THAT / RESONATE" at text-5xl up to 7xl with leading crushed to 0.80 and tight tracking. A pill CTA ("Start today") pairs black background with an arrow icon inside a white circle.

The signature is the corner-stat composition: proof numbers live in the grid corners as Anton headings — "50+ BRANDS LAUNCHED" top-right (right-aligned), "5+ YEARS IN THE INDUSTRY" mid-right — each with a short description paragraph. The middle-left cell carries the designer's bio paragraph with social icons (Facebook, Instagram, YouTube). The page uses `justify-between` to push three rows apart so the layout breathes without any spacing tricks.

There are NO animations anywhere. The design holds attention with type scale, grid balance, and the moving video — nothing else.

## Page layout
Single h-screen flex column: header (logo left, five nav links center, Sign Up / Log In buttons right), then a main area split into three rows — headline row (2-col grid), bio/stat row (2-col grid), and a bottom logo bar of 6 client cards (white rounded cards, each with a small abstract icon) in a 6-column grid. Padding px-6 mobile / px-12 desktop. On mobile the center nav hides and the grids stack to one column.

## Typography
- Display: Anton (Google Fonts, weight 400) — all large uppercase headings, leading 0.80, tracking tight
- Body: Inter (Google Fonts, weights 300-700) — nav, paragraphs, buttons
- Headline ~text-5xl mobile to text-7xl desktop; body text-lg to text-xl

## Color palette
- Page base: warm cream `#F5F3EE` (visible at edges / before video loads)
- Text: black and near-black `#080808` throughout
- CTA: solid black button, white arrow circle inside
- Client cards: white `#ffffff` rounded-lg on top of the video

## Visual motifs
- **Black type straight on video** — no overlay or scrim; black headlines and body text sit directly on the fullscreen background video, which only works with a bright, low-contrast video
- **Corner-anchored proof stats** — "50+ BRANDS LAUNCHED" and "5+ YEARS IN THE INDUSTRY" set in display type at the grid corners, each with a one-line explainer
- **Crushed-leading display block** — Anton uppercase with line-height 0.80 so the three headline lines read as one solid mass
- **Pill CTA with icon circle** — black rounded-full button, text left, white circle holding an ArrowRight icon at the right edge (pl-8 pr-1.5)
- **Client logo card bar** — 6 white rounded cards across the bottom, each with a small abstract mark and name, doubling as social proof and a visual baseline
- **Bio cell with social icons** — a personal paragraph plus Facebook/Instagram/YouTube icons gives the layout a human anchor
- **Zero animation** — everything is static; the video is the only motion on the page

## When to use
- A solo brand designer or creative who needs a portfolio front door with proof numbers
- Freelancers and consultants whose pitch is "years in + brands shipped"
- Small studios that want one confident screen instead of a long scroller
- Personal brands with a good looping reel or workspace video to put behind the type
- Anyone who wants a fast build that still looks deliberate

## When to NOT use
- Anyone without a bright, calm video — black text on busy or dark footage becomes unreadable
- Businesses that need multiple sections of explanation (this is one screen, period)
- Teams wanting motion or scroll storytelling — use `mainframe-mouse-scrub-agency` instead
- Brands whose proof is portfolio images rather than numbers — use `jack-3d-creator-portfolio`

## Build complexity
LOW complexity. One static screen, no animation, standard grids — the only care point is picking a video bright enough to carry black text.

## Library cross-references
- Motif: `black-type-on-bright-video`
- Motif: `corner-anchored-proof-stats`
- Motif: `pill-cta-icon-circle`
- Motif: `client-logo-card-bar`
- Typography: `anton-inter-crushed-leading`
- Color palette: `cream-black-on-video`
