---
slug: niko-friendly-404-floating-icons
name: Niko — Friendly 404 with Floating Icons
vibe: light, soft, playful, friendly, single-screen
industries: agencies, design studios, saas, software companies, startups, creative services, consultancies, marketing firms
source: motionsites.ai archive (catalog title "Nexto 404", free tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: starter
last_used: never
last_client: never
---

## Hero treatment
A single-screen 404 page, exactly 100vh with scrolling disabled everywhere (html, body, and root all `overflow: hidden`). The background layers a centered illustration (a cartoon alien spaceship works; any light, whimsical "lost" image at `center 40%`, `background-size: contain`) under a soft `linear-gradient(to top left, #F5F5F5, #F7F7F7)` wash, both fixed. Centered content: a quiet lead-in line ("Seems you've wandered off…", 15px gray), then the title "Whoops — nothing here yet" at `clamp(34px, 5vw, 52px)`, weight 500, tight -1.5px tracking. Two Material Symbols icons — a cloud perched top-left of the title and a heart bottom-right — get a pink-to-violet-to-blue gradient text fill (`#F7B2FB` → `#786EF1` → `#5588FB` via background-clip) with a white drop-shadow outline, and float gently on offset 4.5-5s loops (translateY -10px, 3deg rotate). The subtext invites a 30-minute chat, with the words "chat" and "define" set inside small gray highlight tags (`#E0E2E7` background, rounded 6px, semibold).

The nav is a 1100px-centered bar with a DASHED bottom border (built from a repeating 6px linear-gradient on an `::after`), a lowercase wordmark left ("niko." — logo SVG rendered black plus 20px bold text), four quiet 14px links center at 65% opacity, and a dark gradient pill CTA right ("Let's Connect", `#2c2c2c` → `#111111`, radius 40px) with a white circular chevron icon sitting on its LEFT side. Hover lifts it 1px and brightens.

## Page layout
One viewport, three vertical zones: navbar, centered message block (max-width 700px), and two navigation cards pinned to the bottom via `margin-top: auto` (max-width 460px). Card 1 "Main Page" (house icon, "Back where it all begins…"), Card 2 "Showcase" (circle-dot icon, "Where we walk the walk") — white cards, radius 18px, 48px gray icon circles, right chevron; hover lifts the card 3px, deepens the shadow, scales the icon 1.05, and slides the chevron right. Mobile swaps the nav links for a hamburger that opens a full-screen panel sliding in from the right with 38px weight-800 links.

## Typography
- Display + body: DM Sans (Google Fonts, variable weights 100-1000) — title weight 500 with -1.5px tracking, links 14px regular
- Icons: Google Material Symbols Rounded (filled)
- Highlight tags: 12.5px weight 600 inside rounded gray chips

## Color palette
- Page: warm light gray `#F5F5F5` to `#F7F7F7` gradient
- Text main: near-black `#1a1a1a`; secondary gray `#888888`
- Card background: white `#ffffff` with rgba(0,0,0,0.05) borders and soft shadows
- Icon gradient: pink `#F7B2FB` → violet `#786EF1` → blue `#5588FB`
- CTA: dark gradient `#2c2c2c` → `#111111`, white text

## Visual motifs
- **Floating gradient icons** — a cloud and a heart hugging the title corners, filled with a pink-violet-blue gradient and bobbing on slow offset loops
- **Highlight-tag words** — key words in the subtext sit inside small rounded gray chips, like UI labels in prose
- **Bottom navigation cards** — two white recovery cards (home, showcase) with icon circles and chevrons, doing the 404's actual job
- **Dashed hairline nav border** — the navbar's bottom edge is a 6px-step dashed line built in CSS, softer than a solid rule
- **Icon-first gradient pill CTA** — dark gradient button with a white circular chevron on the left side of the label
- **No-scroll single screen** — the whole page locks to 100vh; everything earns its place or gets cut

## When to use
- The 404 / error page for any site built on a light, friendly direction
- Agencies and studios that want a lost page to land a meeting ("grab a 30-minute chat")
- SaaS and startups whose brand can carry a wink without losing polish
- Brands using soft gradient accents elsewhere — the icon gradient slots right in

## When to NOT use
- As a homepage or landing page — this is a special-purpose 404 layout with no selling sections
- Dark-themed sites; the warm light-gray wash will clash with the rest of the visit
- Formal verticals (legal, finance, medical) where a playful "whoops" tone undercuts trust
- Sites with no secondary pages worth promoting — the recovery cards are the point

## Build complexity
LOW — one static screen, two keyframe animations, and a mobile slide-in panel; an afternoon add-on to any build.

## Library cross-references
- Motif: `floating-gradient-corner-icons`
- Motif: `highlight-tag-words-in-prose`
- Motif: `bottom-recovery-cards`
- Motif: `dashed-hairline-nav-border`
- Motif: `icon-first-gradient-pill-cta`
- Typography: `dm-sans-soft-utility`
- Color palette: `warm-gray-pink-violet-accent`
