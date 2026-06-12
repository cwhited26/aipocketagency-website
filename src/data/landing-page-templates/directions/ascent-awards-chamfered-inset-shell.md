---
slug: ascent-awards-chamfered-inset-shell
name: Ascent Awards — Chamfered Light Venture Prize
vibe: light, geometric, institutional, precise, airy
industries: awards programs, accelerators, venture funds, startup competitions, conferences, grant programs, innovation hubs, pitch events
source: motionsites.ai archive (catalog title "Stellar Launch", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
last_used: never
last_client: never
---

## Hero treatment
The whole page lives inside a white frame: a full-viewport white container with 20px padding (12px mobile) wraps a large rounded card (28px corners mobile, 36px desktop), and all scrolling happens inside that card with the scrollbar hidden. The hero fills the card with an autoplaying background video under a soft top-and-bottom gradient (`black/10` to `black/20`). Headline content is centered and set in deep blue `#154359`: a wide-tracked eyebrow ("Prize for ventures", 0.3em letter-spacing, uppercase), then the brand name in the display face at 48px mobile up to 120px desktop, lowercase, tracking -0.04em, line-height 0.9, then an uppercase subline at 0.22em tracking.

The signature geometry is the chamfer. The header CTA ("Send in your entry form") is a teal `#066377` button with `clip-path: polygon()` corner cuts — diagonal 10px chamfers on opposite corners — plus an ArrowUpRight icon that nudges up-right on hover. The same angled-cut language repeats on every interactive element down the page.

## Page layout
Three sections inside the shell: hero (video), submissions (nominations grid on `#F0F0F0`), and an about-the-founders block on `#F0F5F7` with a 3-card stats grid. The submissions section is 3-column on desktop — three outlined nomination cards left, a square autoplay video center under a big uppercase "submissions" heading, three cards right, with the side columns pushed down 9rem so the center leads. Persistent overlays sit inside the shell but outside the scroll area: a white docked nav pill top-center (desktop only) whose ends curve outward via radial-gradient masks, a "01 — 05" page counter bottom-right, and "Scroll to discover" bottom-left, both in mix-blend-difference. Sections end with a fade gradient into the next section's background color.

## Typography
- Display: Archivo (substitute for the prompt's TT Firs Neue) — lowercase brand headline at 48-120px, tracking -0.04em; section headings 44-54px uppercase semibold
- Body: Inter (Google Fonts, weights 300-700) — labels run small (10-12px), uppercase, wide-tracked (0.14-0.3em)
- Stat numbers: display face, 36-52px, uppercase, filled with a blue gradient via background-clip

## Color palette
- Primary dark blue: `#154359` (all headline and body text)
- Teal accent: `#066377` (CTA buttons), with nomination card strokes at `rgba(6, 99, 119, 0.25)`
- Section backgrounds: white shell, `#F0F0F0` (submissions), `#F0F5F7` (about)
- Gradient text: `linear-gradient(294deg, #185B7B 20%, #4BBDF0)` on stat numbers

## Visual motifs
- **Inset card shell** — the page renders inside a white frame with large rounded corners; scrolling happens inside the card with hidden scrollbars, so the site reads as one floating object
- **Chamfered corners on everything** — buttons, link boxes, and photo cards all carry `clip-path: polygon()` diagonal corner cuts; the stat cards use multi-notch polygons with 64px cuts on one corner
- **Outlined nomination cards** — award categories sit in thin chamfered SVG rectangles (non-scaling stroke, 25% teal), lifting 2px on hover
- **Blend-mode photo stat cards** — stat card images render with `mix-blend-mode: plus-darker` over an 80% white base, with gradient-filled numbers on top; cards stagger vertically on desktop
- **Docked nav pill with scooped corners** — the top-center white nav uses radial-gradient masked spans to curve its ends outward into the frame
- **Page counter and scroll cue** — "01 — 05" bottom-right and "Scroll to discover" bottom-left, both 10px uppercase in mix-blend-difference so they stay legible over video and light sections
- **Section fade hand-offs** — each section ends in a gradient that dissolves into the next section's background color

## When to use
- Award programs, pitch competitions, and demo days that need a formal but modern face
- Accelerators and venture funds announcing a cohort or prize
- Conferences and summits with a nominations or submissions flow
- Grant programs and innovation challenges run by institutions
- Brands that want light, airy, and precise instead of dark and loud

## When to NOT use
- Local service businesses — the institutional tone is wrong for "call us today" conversion (use `trades-phone-first-emergency`)
- Dark-mode tech brands — this direction is light-theme to the bone; `cognitra-ai-agency-gray-panel` covers that lane
- Content-heavy sites — the inset shell and overlay furniture suit a short three-section story, not a deep page tree
- Anyone without a real video asset for the hero; the light gradient gives no cover for weak footage

## Build complexity
MEDIUM. The clip-path chamfers are reusable CSS, but the inset scroll shell, blend-mode stat cards, and masked nav corners each need careful assembly and cross-browser checks.

## Library cross-references
- Motif: `inset-card-shell-hidden-scroll`
- Motif: `chamfered-clip-path-geometry`
- Motif: `outlined-svg-category-cards`
- Motif: `blend-mode-photo-stat-cards`
- Motif: `docked-nav-scooped-corners`
- Motif: `mix-blend-page-counter`
- Typography: `archivo-inter-widetrack-labels`
- Color palette: `deep-blue-teal-light-grays`
