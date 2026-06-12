---
slug: oblique-portfolio-count-up-preloader
name: Oblique Studio — Portfolio Count-Up Preloader
vibe: dark, serif-italic, minimal, choreographed, editorial
industries: design studios, portfolios, photographers, creative agencies, architects, art directors, film-makers, fashion brands
source: motionsites.ai archive (catalog title "Loader Animation", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
last_used: never
last_client: never
---

## Hero treatment
This is a special-purpose direction: a fullscreen LOADING SCREEN that plays before a portfolio site, not a page in itself. Near-black `#0a0a0a` canvas with four choreographed elements. Top-left: a small "Portfolio" label, uppercase, letter-spaced `0.3em`, muted gray. Center: three words cycle in Instrument Serif italic at up to text-7xl — "Design" → "Create" → "Inspire" — a new word every 900ms, each entering from below and exiting upward, stopping on the last word. Bottom-right: a giant tabular-figures counter that runs 000 → 100 over exactly 2.7 seconds via requestAnimationFrame, zero-padded to three digits. Bottom edge: a 3px progress bar filling left-to-right on a steel-blue gradient (`#89AACC` → `#4E85BF`) with a soft matching glow.

When the counter hits 100 the loader waits 400ms, fades out over 0.6s, and the page content fades in over 0.5s underneath. Total ritual: about 3.7 seconds from black to site.

## Page layout
One fixed full-viewport layer at maximum z-index over the real page. The four elements pin to corners and center; spacing scales from 32px insets on mobile to 48px on desktop. The parent keeps the page at opacity 0 until the loader signals complete, then cross-fades.

## Typography
- Display: Instrument Serif (Google Fonts, italic 400) — the rotating words and the giant counter
- Body: none on this screen; the small "Portfolio" label uses the site's sans at text-xs/sm with `0.3em` tracking
- Counter at text-6xl to text-9xl with tabular-nums so digits don't shift width

## Color palette
- Background: near-black `#0a0a0a`
- Text: warm white `#f5f5f5`, rotating words at 80% opacity
- Muted label: `#888888`
- Progress track: `#1f1f1f` at 50%; fill gradient `#89AACC` → `#4E85BF` with a `rgba(137,170,204,0.35)` glow

## Visual motifs
- **Three-word manifesto cycle** — serif-italic words swap every 900ms with rise-in/rise-out motion, ending parked on the final word
- **Count-up percentage** — an oversized 000-to-100 counter in the corner, zero-padded, driven by real elapsed time not fake increments
- **Edge progress bar** — a 3px gradient line along the bottom viewport edge, scaleX-driven, with a soft glow
- **Corner-pinned composition** — label top-left, counter bottom-right, words dead center; the empty space is the design
- **Cross-fade handoff** — loader fades out as the page fades in, a 1.1s overlap that makes the site feel revealed rather than loaded

## When to use
- Portfolio and studio sites that want a deliberate, cinematic entrance
- Photographers, architects, and design-led brands where a 3-second ritual sets tone
- Sites pairing with a dark editorial homepage that the fade-in can reveal
- As an add-on layer over another direction in this library, not standing alone

## When to NOT use
- This is a loader, not a landing page — it always needs a real page behind it
- Conversion-focused or ad-traffic pages; a forced 3.7-second wait costs clicks
- Local service businesses where visitors want a phone number immediately (use `trades-phone-first-emergency`)
- Repeat-visit products like dashboards — the ritual gets old by the second visit

## Build complexity
LOW complexity. One component, one timing constant, requestAnimationFrame for the counter. The discipline is honoring the exact timing chain (900ms words, 2.7s counter, 400ms hold, 0.6s exit).

## Library cross-references
- Motif: `rotating-word-cycle-preloader`
- Motif: `count-up-percentage-corner`
- Motif: `edge-progress-bar-gradient`
- Motif: `loader-page-crossfade-handoff`
- Typography: `instrument-serif-italic-display`
- Color palette: `near-black-steel-blue-accent`
