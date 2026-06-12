---
slug: fieldcraft-creative-stat-uppercase
name: Fieldcraft — Creative Studio Stat-Led Uppercase
vibe: bold, uppercase, stat-led, editorial, confident
industries: creative studios, branding agencies, design agencies, venture studios, marketing agencies, production companies, digital product studios
source: motionsites.ai archive (catalog title "Creative Studio", free tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: starter
last_used: never
last_client: never
---

## Hero treatment
Full-screen hero where black uppercase type sits directly on a bright fullscreen video — no overlay, no glass, no card. Everything on the page is Inter weight 600, uppercase, with wide letter-spacing; the design is one font, one weight, one case, organized by scale alone. The single accent is a deep purple `#5E0ED7` used in exactly three places: the ring-and-dot logo, the "+" prefixes on the stats, and the "Work With Us" CTA link.

The page stacks three bands. Top: a slim nav — the purple ring logo left, four small uppercase links center (hidden on mobile), a round black hamburger right that opens a white fullscreen menu with text-3xl links. Middle: a right-aligned row of three proof stats ("+300 CRAFTED BRANDS", "+200 DIGITAL PRODUCTS", "+100 VENTURES FUNDED") where the number scales with `clamp(1.5rem, 5vw, 3.5rem)`, the plus renders separately in purple at half size, and the two-word label breaks onto two tight lines. Bottom: a small three-line tagline left against a purple CTA-with-arrow right, then the headline — three words ("FEARLESS / VISION / DELIVERED") stacked right-aligned at `clamp(2rem, 9vw, 9rem)` with line-height 0.88, each word clip-revealed by sliding up from 110% inside an overflow-hidden wrapper (0.4s base delay, 0.14s per word).

## Page layout
One viewport, flex column: nav (fixed height), stats (flex-1, vertically centered, pushed right), bottom block (pinned with padding). Load order animates top-down: nav elements fade down with 0.1s stagger, stats and bottom copy fade up with 0.12s stagger, headline words clip-reveal last. Mobile keeps every element — type scales via clamp, nav links move into the fullscreen white menu.

## Typography
- Display + body: Inter (Google Fonts) — weight 600 everywhere, all caps, tracking-widest; hierarchy comes entirely from clamp-scaled sizes (9px labels up to 9rem headline words)
- Headline line-height 0.88 so the three stacked words read as one block

## Color palette
- Text: black `#000000` on the video, no overlay
- Accent: `#5E0ED7` deep purple — logo, stat plus-marks, CTA link only
- Mobile menu and hamburger: white panel, black `#000000` round buttons
- Background: whatever the video is — it must be bright enough to carry black type

## Visual motifs
- **Three stacked giant words** — the headline is three uppercase words pinned bottom-right at up to 9rem, each clip-revealed by sliding up inside an overflow-hidden line
- **Proof stats with purple plus-marks** — three right-aligned counters where the "+" is the only colored character, half the number's size
- **One-weight typography** — Inter 600 uppercase at every size; scale is the only hierarchy tool
- **Three-touch accent discipline** — the brand purple appears in exactly three places and nowhere else
- **Black type straight on video** — no overlay or scrim; the footage must be light and low-contrast where text sits
- **Round hamburger to white takeover menu** — a black circle with three lines opening a fullscreen white menu with oversized links and a purple CTA at the bottom

## When to use
- Creative studios, branding, and design agencies leading with a track record
- Venture studios and product shops whose numbers (brands shipped, products launched) are the pitch
- Agencies that want bold without going dark
- Portfolio-light firms — the stats and three words do the talking, no case studies needed on screen one

## When to NOT use
- Anyone whose only video footage is dark or busy — black text with no overlay needs bright, calm footage
- Service businesses where a phone call converts (use `trades-phone-first-emergency`)
- Brands wanting warmth or softness; all-caps 600-weight reads assertive
- Firms without honest numbers to put in the stats row — fake counts are obvious

## Build complexity
LOW. Three framer-motion variants, clamp typography, one fullscreen menu. A focused half-day build.

## Library cross-references
- Motif: `stacked-giant-words-clip-reveal`
- Motif: `proof-stats-accent-plus`
- Motif: `single-weight-uppercase-system`
- Motif: `three-touch-accent-discipline`
- Motif: `black-type-on-bright-video`
- Motif: `round-hamburger-white-takeover`
- Typography: `inter-600-uppercase-clamp`
- Color palette: `black-on-video-deep-purple-accent`
