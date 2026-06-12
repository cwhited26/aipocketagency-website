---
slug: astrel-nft-neon-space-glass
name: Astrel.Nft — Neon Space Liquid Glass
vibe: dark, cosmic, neon, collectible, textured
industries: nft projects, digital collectibles, web3 communities, digital artists, generative art, gaming assets, crypto launches, creator drops
source: motionsites.ai archive (catalog title "Orbis NFT", free tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: starter
last_used: never
last_client: never
---

## Hero treatment
Full-viewport hero for a space-themed NFT collection on a deep navy `#010828`. A full-bleed looping space video fills the section, clipped by 32px rounded bottom corners so the hero reads as a card. The header carries the "Astrel.Nft" wordmark left in Anton and a liquid-glass nav capsule center (rounded-28px pill, 52px side padding, five uppercase Anton links that go neon green on hover). The headline is giant Anton uppercase — 40px mobile up to 90px desktop at line-height 1 — reading like "BEYOND EARTH AND ( ITS ) FAMILIAR BOUNDARIES", with a cursive accent ("Nft collection") in Condiment script floating over the right side: neon green, rotated -1 degree, `mix-blend-exclusion` so it inverts against whatever video frame is behind it.

The liquid-glass treatment is its own recipe and repeats everywhere (nav, social buttons, cards): a 1% white fill with luminosity blend, 4px backdrop blur, an inset top highlight, and a 1.4px gradient border drawn by a masked ::before that brightens at the top and bottom edges — glass that catches light at the rim. On top of the whole page sits a fixed full-screen grain texture at 60% opacity with `mix-blend-mode: lighten`, giving every section a filmic surface.

## Page layout
Four sections inside a very wide 1831px max container. Section 1: hero (video, nav, giant headline, three stacked 56px glass social buttons top-right). Section 2: about — another full-bleed video, an Anton greeting headline with a cursive neon overlay, a short uppercase monospace paragraph right, and two decorative paragraph columns at 10% opacity (ghost text that's nearly invisible on purpose). Section 3: the collection grid on solid navy — a 3/2/1-column grid of liquid-glass cards, each holding a square looping video, a glass bottom bar showing "RARITY SCORE" with its number, and a purple-gradient circular arrow button with a glowing shadow. Section 4: a full-width video at native aspect ratio (not cropped) with right-aligned stacked uppercase CTA lines ("JOIN US." then three command lines) and a cursive "Go beyond" accent; a vertical glass social rail sits bottom-left.

## Typography
- Display: Anton (Google Fonts) — every heading and nav link, all uppercase, line-height 1
- Body: system monospace — uppercase descriptive paragraphs at 14-16px, the deliberate "mission log" voice
- Accent: Condiment (Google Fonts cursive) — neon script overlays at 24-68px, always rotated slightly and blend-mode inverted

## Color palette
- Background: `#010828` deep navy
- Text: `#EFF4FF` off-white cream
- Accent: `#6FFF00` neon green — cursive overlays and underline bars
- Card button gradient: `#b724ff` to `#7c3aed` purple with a purple glow shadow
- Glass: `rgba(255,255,255,0.01)` fill, 4px blur, gradient rim border

## Visual motifs
- **Liquid-glass capsules** — one CSS recipe (1% white luminosity fill, 4px blur, masked gradient rim that brightens top and bottom) reused on nav, buttons, cards, and overlay bars
- **Neon cursive overlays** — Condiment script in `#6FFF00`, slightly rotated, `mix-blend-exclusion` so it inverts over video
- **Full-page grain texture** — a fixed texture layer at 60% opacity with lighten blend over everything, including the videos
- **Rounded-bottom hero card** — the hero video clips at 32px bottom corners so the first section reads as a card edge
- **Rarity score cards** — glass cards with square looping videos and a glass bottom bar pairing a score readout with a glowing purple arrow button
- **Ghost paragraphs** — duplicated body text at 10% opacity used as pure texture in the about section
- **Stacked command CTA** — closing section of short uppercase imperative lines ("JOIN US." / "FOLLOW THE SIGNAL.") over a native-ratio video
- **Glass social rail** — vertically stacked mail/social buttons in one glass container with hairline dividers

## When to use
- NFT collections and digital collectible drops
- Web3 communities and generative art projects
- Digital artists selling editioned work
- Gaming asset and avatar collections
- Crypto-native launches where a cosmic, collectible mood is the point

## When to NOT use
- Any conventional business — the rarity scores and drop language are crypto-native and read wrong elsewhere
- Space/aerospace companies wanting credibility, not collectibles (use `cinematic-space-travel-aerospace`)
- Brands without several strong looping videos; this layout uses four-plus
- Accessibility-sensitive audiences — neon-on-blend text and 10% opacity copy trade readability for mood

## Build complexity
MEDIUM. The liquid-glass recipe and texture overlay are copy-paste CSS; the work is mostly assembling four video sections and the card grid. No scroll choreography.

## Library cross-references
- Motif: `liquid-glass-gradient-rim`
- Motif: `neon-cursive-blend-overlay`
- Motif: `full-page-grain-texture`
- Motif: `rounded-bottom-video-card`
- Motif: `rarity-score-glass-cards`
- Motif: `ghost-text-texture`
- Typography: `anton-condiment-monospace`
- Color palette: `deep-navy-cream-neon-green`
