---
slug: kovert-security-staggered-type
name: Kovert — Lowercase Staggered-Type Security Hero
vibe: dark, lowercase, bold, editorial, confident
industries: cybersecurity, data security saas, privacy tools, cloud infrastructure, compliance software, devtools, vpn services, backup and storage
source: motionsites.ai archive (catalog title "Securify Data Security — SaaS", free tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: starter
last_used: never
last_client: never
---

## Hero treatment
A full-screen security hero where the headline is broken into three giant lowercase words — "protect" / "your" / "data" — each absolutely positioned in a zigzag down the viewport: "protect" pinned left at 18% from the top, "your" pinned right at 38%, "data" left-of-center at 58%. Each word renders at 13-14vw with `letter-spacing -0.04em` and `line-height 0.95`, so the typography IS the layout. A looping background video runs behind everything; a 12rem black gradient fades the bottom edge.

Three stat blocks pin to the remaining corners, each paired with a thin diagonal hairline divider rotated ±20deg: "+65k startups use" top-right, "+1.5b gb data was protected" bottom-left, "+300k downloads" bottom-right. A short description paragraph (max-width 240px, 15px) tucks into the left edge at 46%. Every character on the page is lowercase — including the brand and nav — which is the attitude of the whole direction.

## Page layout
One viewport. The nav floats as three separate pills on `bg-neutral-900/90` with backdrop blur: a logo pill left (a white geometric interlocking-blocks SVG mark + lowercase brand text), a center pill of four links (platform / solutions / company / support), and a solid white "get started" pill right. Mobile hides the center links and the diagonal dividers; the vw-sized words scale themselves.

## Typography
- Display + body: Readex Pro (Google Fonts, 300-700) — headline words at 13-14vw medium, stats at text-4xl/5xl medium tracking-tight, UI at 14px
- Everything lowercase, no exceptions
- Headline class: `letter-spacing -0.04em; line-height 0.95`

## Color palette
- Background: pure black `#000000` under full video
- Nav pills: `rgba(23,23,23,0.9)` (neutral-900/90) with backdrop blur
- Text: white `#ffffff`; description at 90% white; stat sublabels at 70% white; dividers at 40% white
- CTA: solid white pill, black text, hover `#e5e5e5`
- No accent color anywhere — the palette is strictly black, white, and opacity steps

## Visual motifs
- **Staggered viewport-sized words** — the headline splits into three absolutely-placed giant lowercase words zigzagging down the screen; type as layout
- **Corner stat blocks with diagonal dividers** — big numbers pinned to screen corners, each leaning against a hairline rotated ±20deg
- **Three-piece pill navbar** — logo, links, and CTA float as separate blurred dark capsules instead of one bar
- **All-lowercase voice** — brand, nav, headline, stats; the case choice carries the brand attitude
- **Geometric block logomark** — an interlocking white SVG mark built from notched squares, reading as vault/circuit
- **Bottom black gradient fade** — a tall transparent-to-black gradient grounds the video at the fold

## When to use
- Data security, privacy, and backup products that want bold without being loud
- Cybersecurity and compliance SaaS with traction numbers worth pinning to the corners
- Devtools and infrastructure brands that like the lowercase, anti-corporate register
- Anyone with strong abstract footage and three good stats — that is the entire content budget
- Brands wanting a type-led hero with zero illustration or product screenshots

## When to NOT use
- Formal enterprise buyers (banking, government) where lowercase reads as unserious
- Companies without real numbers — fake-looking stats in the corners hurt more than help
- Multi-message homepages; this layout holds exactly one sentence and three stats
- Anyone whose brand needs color; the strict black-and-white is load-bearing (use `nyrion-web3-glow-pill-hero` if a glow accent is wanted)

## Build complexity
LOW — absolute positioning and vw type with only hover transitions; the work is in tuning word placement so it holds at every viewport.

## Library cross-references
- Motif: `staggered-vw-headline-words`
- Motif: `corner-stats-diagonal-dividers`
- Motif: `three-piece-pill-navbar`
- Motif: `all-lowercase-brand-voice`
- Motif: `bottom-black-gradient-fade`
- Typography: `readex-pro-lowercase-vw`
- Color palette: `black-white-opacity-only`
