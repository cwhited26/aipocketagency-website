---
slug: mentora-learning-accordion-cards
name: Mentora — Learning Platform / Hover-Accordion Course Cards
vibe: warm, soft, rounded, inviting, education-coded
industries: online courses, coaching programs, tutoring, bootcamps, professional training, membership communities, skill marketplaces, mentorship platforms
source: motionsites.ai archive (catalog title "Learnly", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
last_used: never
last_client: never
---

## Hero treatment
A full-viewport, soft off-white hero on a radial gradient (`radial-gradient(circle at top right, #fdfdfd, #f4f4f2)`). Left column: a three-word stacked headline — "Study. / Train. / Rise." — at 5.5rem, weight 600, letter-spacing -2px, followed by a square-cornered search bar (white, `0 15px 45px rgba(0,0,0,0.08)` shadow) whose submit button hides a trick: its background is a two-color vertical gradient (`linear-gradient(to bottom, #8BBF77 50%, accent 50%)`) at 200% height, and on hover the background-position slides from bottom to top so the button appears to fill with green.

Right column is the signature: a hover-accordion of three full-height photo cards (550px tall, rounded 16px). The first card starts expanded at `flex: 2.5` showing its title and a big topic-count number; the others sit collapsed at `flex: 1` showing only a vertical rotated label (`writing-mode: vertical-rl`, white text on a half-dark gradient strip). Hover any card and it grows to `flex: 2.5` over 0.7s `cubic-bezier(0.23, 1, 0.32, 1)` while siblings shrink to 0.8; the vertical label fades out and the full title + count fade up in its place. Every card has a bottom darkening gradient so white text stays readable.

## Page layout
One viewport: nav (logo with an accent-colored period, four center links, "Enter" text link + dark pill "Try It Now" button), the 1fr/1.5fr two-column main grid, then a centered footer line ("Boundless passes to 100+ mentorships.") pushed down with margin-top auto. Max width 1600px, padding 60px/100px desktop shrinking to 30px/20px mobile. Under 1200px the grid stacks; under 768px the card row becomes a horizontal scroll-snap carousel (300px fixed-width cards, hidden scrollbar, edge-to-edge bleed via negative margins) and the nav collapses to a hamburger that slides an 80%-width white drawer in from the right (0.5s, same cubic-bezier).

## Typography
- Display + body: Outfit (Google Fonts, weights 300-700) — one geometric sans does everything
- Headline 5.5rem desktop / 3.5rem mobile, weight 600, letter-spacing -2px
- Card titles 2.2rem; topic counts 2rem bold with a tiny uppercase letterspaced "TOPICS" label

## Color palette
- Background: soft off-white `#f4f4f2` with radial highlight to `#fdfdfd`
- Text: deep navy-ink `#1a1e2d`, muted `#666666`
- Accent: warm peach `#fdb181` (hover `#fa9d63`) — logo period, mobile-menu link
- Hover-fill green: `#8BBF77` (the search button's slide-up color)
- Cards: photo-backed with `rgba(0,0,0,0.6)` bottom gradients; vertical label strip backed by `#1C1D2D`

## Visual motifs
- **Hover-accordion photo cards** — three flex cards where hovering one grows it to 2.5x while siblings shrink, 0.7s springy cubic-bezier, with content cross-fading between a vertical label (collapsed) and title + count (expanded)
- **Vertical rotated card labels** — collapsed cards show their category in `writing-mode: vertical-rl` rotated 180°, white on a half-height dark strip
- **Gradient-fill search button** — a 200%-height two-color gradient background that slides up on hover so the button fills with a second color, plus a 1.02 scale
- **Three-word stacked headline** — one short verb per line ("Study. / Train. / Rise."), big and tight, instead of a sentence
- **Accent-period wordmark** — the logo's final period takes the brand accent color
- **Topic-count badges** — each card carries a large number + small uppercase "TOPICS" label as instant catalog proof
- **Mobile scroll-snap carousel** — under 768px the accordion becomes an edge-bleeding horizontal carousel with snap-to-center cards
- **Slide-in mobile drawer** — hamburger morphs to an X (bars rotate ±45°) and an 80%-width white panel slides in from the right

## When to use
- Online course platforms and academies with 2-4 clear course categories
- Coaching and mentorship programs that sell through curriculum breadth
- Bootcamps and professional training where photo-led category cards beat feature lists
- Tutoring or skills marketplaces that want a search bar front and center
- Brands wanting warm and approachable rather than corporate SaaS

## When to NOT use
- Single-offer businesses — the accordion needs 3+ categories to make sense
- Dark, technical, or developer-facing brands — use `codenest-coding-education-dev-platform`
- Anyone without strong category photography; the cards are photo-dependent
- Conversion pages where the search bar would distract from one CTA

## Build complexity
MEDIUM complexity. The accordion's hover states (including the first-card default-expanded logic and content cross-fades) plus the mobile carousel conversion take careful CSS, but there is no JavaScript animation at all — everything is transitions.

## Library cross-references
- Motif: `hover-accordion-photo-cards`
- Motif: `vertical-rotated-card-labels`
- Motif: `gradient-fill-hover-button`
- Motif: `mobile-scroll-snap-carousel`
- Motif: `accent-period-wordmark`
- Typography: `outfit-single-family-tight`
- Color palette: `off-white-ink-peach-accent`
