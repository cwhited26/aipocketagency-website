---
slug: calder-ventures-liquid-glass-video
name: Calder Ventures — Liquid Glass Video Hero
vibe: dark, cinematic, confident, glassy, understated
industries: venture capital, private equity, investment firms, holding companies, corporate advisory, management consulting, family offices, B2B strategy firms
source: motionsites.ai archive (catalog title "VEX Ventures — Hero Section", free tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: starter
last_used: never
last_client: never
---

## Hero treatment
Full-screen background video at 100% opacity — no dark overlay, no gradient, the footage carries the whole mood. Content is pushed to the BOTTOM of the viewport: on large screens a two-column grid sits at the bottom edge, headline and buttons in the left column, a single glass tag card ("Investing. Building. Advisory.") bottom-right. The headline ("Shaping tomorrow / with vision and action.") enters CHARACTER BY CHARACTER — each character starts at opacity 0 and `translateX(-18px)`, then slides into place with a 30ms-per-character stagger (500ms transition each, 200ms initial delay). Subheading fades in at 800ms, buttons at 1200ms, the glass tag at 1400ms, so the hero assembles itself in a choreographed sequence.

The navbar is a floating liquid-glass pill (`rgba(0,0,0,0.4)` with luminosity blend, 4px backdrop blur, inset top highlight, and a gradient hairline border built with the mask-composite trick — bright at top and bottom edges, fading to nothing in the middle). Logo left, four links center, solid white "Start a Chat" button right.

## Page layout
Single full-viewport hero. Horizontal padding steps `px-6 md:px-12 lg:px-16`, bottom padding `pb-12 lg:pb-16`. Headline scales `text-4xl` → `text-7xl` across breakpoints with `-0.04em` letter-spacing. Mobile collapses to a single column with the nav links hidden; everything still bottom-anchored.

## Typography
- Display + body: Inter (Google Fonts, weights 300-600) — headline at font-normal, letter-spacing `-0.04em`
- Antialiased font smoothing applied globally
- Secondary text in gray-300, glass tag line at `text-lg` → `text-2xl` font-light

## Color palette
- Background: black `#000000` (behind the video)
- Primary text: white `#ffffff`
- Secondary text: gray-300 `#d1d5db`
- Borders and glass edges: white at 20% opacity
- Glass surface: `rgba(0,0,0,0.4)` with `backdrop-filter: blur(4px)`
- No accent color anywhere — strictly monochrome over video

## Visual motifs
- **Character-stagger headline** (the signature) — each character animates in individually from the left with a 30ms stagger; the headline writes itself across the screen
- **Liquid-glass navbar pill** — dark glass bar with a gradient hairline border (mask-composite trick: bright top/bottom edges fading mid-height) and inset top highlight
- **Bottom-anchored hero content** — copy sits at the viewport floor, leaving the upper two-thirds to the video
- **Full-bleed video, no overlay** — the footage plays raw at 100% opacity; copy legibility depends on choosing footage with calm lower thirds
- **Glass tag card** — a one-line positioning statement ("Investing. Building. Advisory.") in its own glass pill, bottom-right, the last element to fade in
- **Timed entrance sequence** — headline, subhead, buttons, tag each arrive on a fixed delay ladder (200/800/1200/1400ms)

## When to use
- Investment firms, venture funds, holding companies that want gravity without decoration
- Corporate advisory and strategy consultancies pitching to executives
- Any brand with strong cinematic footage and a three-word positioning line
- Companies that want a dark, serious first impression with one clear action
- Brands whose story is momentum — the self-writing headline reinforces it

## When to NOT use
- Local service businesses where the phone call is the conversion (use `trades-phone-first-emergency`)
- Brands without quality video footage — the raw, no-overlay video IS the design
- Playful or consumer-warm brands; this reads boardroom, not living room
- Content-heavy sites — this is a single-viewport statement, not a browsing layout
- If you want colorful glass instead of monochrome, use `glassmorphism-purple-pink-agency`

## Build complexity
LOW complexity. One viewport, one glass CSS class, one character-stagger component. The animation ladder is fixed delays, no scroll logic.

## Library cross-references
- Motif: `character-stagger-headline`
- Motif: `liquid-glass-navbar-pill`
- Motif: `full-bleed-video-no-overlay`
- Motif: `bottom-anchored-hero-content`
- Motif: `timed-entrance-sequence`
- Typography: `inter-tight-monochrome`
- Color palette: `black-white-gray-over-video`
