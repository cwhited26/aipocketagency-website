---
slug: kestrel-space-monochrome-hairline-grid
name: Kestrel — Space Systems Monochrome Hairline Grid
vibe: brutal, monochrome, technical, oversized-type, gridded
industries: aerospace, defense tech, space launch, satellite services, advanced manufacturing, robotics, deep tech, engineering firms
source: motionsites.ai archive (catalog title "NOVA Space Systems", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
last_used: never
last_client: never
---

## Hero treatment
A brutally minimal aerospace page: pure black, pure white, ZERO border-radius anywhere (`--radius: 0rem`), one font (Space Grotesk) for everything. The hero fills 100vh including the navbar. Background: a full-bleed launch video, no overlay, focal point shifting right on smaller screens (85% mobile / 75% tablet / center desktop). The H1 is a single word — "ROCKETS" — at text-[4.5rem] → 10rem → 12rem, font-black, `leading-[0.85]`, tracking-tighter. Below it, a right-aligned description block (the asymmetry against the left-set giant word is the composition), and a rectangular CTA: white fill, black text, with a square black icon box holding an arrow — a button built from two rectangles, no rounding, no border.

The navbar is drafting-table furniture: a three-column bar where links, the centered "KESTREL" wordmark, and the search/menu cluster are separated by 1px vertical divider lines with small insets, and underlined by segmented horizontal hairlines — the chrome looks ruled, not decorated.

## Page layout
Three sections in one scroll. After the hero, a title block sets "ROCKET / SCIENCE" across two lines at up to 7rem font-extralight (the weight flip from the font-black hero word is deliberate), the second line indented by em-offsets. Then a hairline-ruled grid: segmented 1px border lines on top, between rows, and down the left/center/right edges frame a staggered 2×3 desktop grid where text cards (heading + muted paragraph, p-12) alternate with inset videos spanning two rows each. Mobile stacks the cards vertically with hairline dividers between them.

## Typography
- Display + body: Space Grotesk (Google Fonts, weights 400-700) — one face at two extremes: font-black for the hero word, font-extralight for the section title, regular for body
- Hero word: up to 12rem, `leading-[0.85]`, tracking-tighter
- Section title: up to 7rem, extralight, uppercase

## Color palette
- Background: pure black `#000000`
- Foreground: pure white `#ffffff`
- Body text: gray `#a6a6a6` (HSL 0 0% 65%)
- Hairlines: gray `#595959` (nav) and `#404040` (grid borders)
- No accent color anywhere — the discipline is the brand

## Visual motifs
- **One-word headline** — a single uppercase word at 10-12rem font-black does the entire hero's talking
- **Segmented hairline rules** — 1px divider lines, broken into segments with gaps and insets, frame the nav and the content grid like a drafting sheet
- **Two-rectangle button** — square white CTA with a square black arrow box docked inside it; no radius, no border
- **Weight-flip section titles** — the same typeface swings from font-black (hero) to font-extralight (section) at display scale
- **Staggered text/video grid** — text cards and two-row video panels alternate corners across a ruled 2×3 grid
- **Right-aligned counterweight copy** — the description block sets right against the left-set giant word
- **Zero radius everywhere** — `--radius: 0rem` as a global token; nothing on the page is rounded

## When to use
- Aerospace, launch, satellite, and defense-tech companies
- Advanced manufacturing and robotics firms with dramatic process footage
- Deep-tech and engineering brands that want authority through restraint
- Any company whose product photographs monumentally — the layout frames footage like exhibits
- Brands ready to commit to strict monochrome

## When to NOT use
- Brands needing warmth, color, or consumer appeal — there is no accent to soften it
- Story-driven cinematic space brands wanting scroll choreography (use `cinematic-space-travel-aerospace`)
- Companies without strong video; three video slots carry the page
- Service businesses where a one-word headline can't explain the offer

## Build complexity
MEDIUM — the layouts are static but the segmented hairline framework and the staggered five-column grid take patience to rule correctly at every breakpoint.

## Library cross-references
- Motif: `one-word-giant-headline`
- Motif: `segmented-hairline-rules`
- Motif: `two-rectangle-square-button`
- Motif: `weight-flip-display-titles`
- Motif: `staggered-text-video-grid`
- Typography: `space-grotesk-black-to-extralight`
- Color palette: `pure-monochrome-no-accent`
