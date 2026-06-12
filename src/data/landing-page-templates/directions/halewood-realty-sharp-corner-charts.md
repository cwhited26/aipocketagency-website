---
slug: halewood-realty-sharp-corner-charts
name: Halewood Realty — Luxury Real Estate / Sharp Corners / Investment Charts
vibe: light, sharp-cornered, editorial, gray-on-white, data-backed
industries: real estate, realty brokerages, property development, property investment, vacation rentals, architecture, property management
source: motionsites.ai archive (catalog title "Zenith Realty", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
last_used: never
last_client: never
---

## Hero treatment
Full-screen hero over a background video with only a `bg-white/10` wash — light, not dark. The page's signature is the REFUSAL of rounded corners: every button, card, and image is `rounded-none`, which against the soft `#F8F8F8` background and Lato type reads as architectural, drawn-with-a-ruler luxury. The headline ("Discover space you truly belong in" register) fades up at 4xl-7xl medium with tight tracking in near-black `#141414`, set on a 12-column grid with a quiet gray supporting paragraph pushed to columns 9-12 — headline left, whisper right, nothing centered. The CTA is a sharp black block button, uppercase, wide-tracked, with a deep shadow.

The navbar carries a stacked two-line wordmark in font-black at `leading-[0.85]`, small 13px links (one wearing a tiny black "New" badge), and a frosted white "Post a property" button with a square edge. Mobile gets a functional slide-in menu panel animating from the right with a dark CTA pinned at its bottom.

## Page layout
Four sections, all on the same grid grammar: a section headline at 3-5xl left, gray right-aligned subtext at columns 9-12. Section 2 is a 3-card property grid — white sharp-cornered cards, photos in 4:3 (square on desktop) that zoom 1.05 over 700ms on hover, with title/price rows and inline stat rows (area, floors, beds, baths) using 13px Lucide icons in gray beside 11px near-black values. Section 3 splits 4/8: a white process panel (title, description, outlined "Free consult" button, and a vertical text-button menu where the active item is near-black and inactive items are gray) beside a large photo. Section 4 is the investment block: three white chart cards, each a title in 40%-black uppercase micro-type, a big stat value, and an h-24 Recharts bar chart whose custom bar shape draws TWO rectangles — a 5%-opacity body plus a 2px solid black top cap — so the charts look like pencil-ruled survey marks, not SaaS dashboards. Cards and property tiles stagger-fade up once on scroll. No footer.

## Typography
- Display + body: Lato (Google Fonts, weights 300/400/500/700/900) — one family across wordmark (900), headlines (500), and 13px UI labels
- Headlines: tight tracking, `leading-[1.05]`; section subtext 14-18px in light gray
- Chart card titles: 12px uppercase tracking-tight at 40% black

## Color palette
- Page: `#F8F8F8`; cards: white
- Ink: `#141414` (text, buttons, chart caps)
- Muted gray: `#A5A5A5` for all secondary copy and inactive states
- Chart bars: `#141414` at 5% opacity with a solid `#141414` 2px top line
- Frosted nav button: `bg-white/80` with backdrop blur over the video

## Visual motifs
- **Sharp corners everywhere** (the signature) — buttons, cards, and images all square-edged; the discipline is the luxury cue
- **Headline left, whisper right** — every section pairs a big left-set headline with small gray text pushed to the last grid columns
- **Pencil-ruled bar charts** — custom two-rectangle bars (faint body + solid 2px top cap) that make investment data look hand-surveyed
- **Hover-zoom property photos** — images scale 1.05 over 700ms inside clipped frames
- **Inline icon stat rows** — area/floors/beds/baths as small gray icons with tiny bold values, one flex row per property
- **Vertical text-button menu** — a stacked list of process steps where only the active one is in ink
- **Slide-in mobile menu** — full panel entering from the right with the dark CTA docked at the bottom
- **Light wash over video** — `bg-white/10` keeps the hero footage bright and the dark type readable

## When to use
- Realty brokerages and property developers selling above-median homes
- Property investment brands — the chart section turns listings into a portfolio story
- Architecture-adjacent brands that want minimal and ruled, not warm and cozy
- Vacation and second-home portfolios with strong exterior photography
- Clients who find `velar-luxury-real-estate` too theatrical and want the quiet version

## When to NOT use
- Volume listing sites needing search and filters (use `real-estate-listing-grid-search`)
- Warm family-first agents — the sharp edges read formal
- Anyone without quality property photography — three big cards expose weak images
- Brands wanting scroll drama or animation set pieces; this direction's motion is hover zooms and fade-ups only

## Build complexity
MEDIUM. Four sections, a Recharts dependency with a custom bar shape, and a functional mobile menu — no scroll choreography, but more surface area than a single-hero direction.

## Library cross-references
- Motif: `sharp-corner-discipline`
- Motif: `headline-left-whisper-right-grid`
- Motif: `two-rect-pencil-bar-charts`
- Motif: `hover-zoom-clipped-photos`
- Motif: `inline-icon-stat-rows`
- Motif: `slide-in-mobile-menu-panel`
- Typography: `lato-single-family-ladder`
- Color palette: `off-white-ink-muted-gray`
