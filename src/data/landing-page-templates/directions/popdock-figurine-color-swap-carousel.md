---
slug: popdock-figurine-color-swap-carousel
name: Popdock — 3D Figurine Color-Swap Carousel
vibe: playful, toy-bright, bold, tactile, collectible
industries: toy brands, collectibles, character merch, ecommerce drops, game studios, kids brands, gift shops, digital collectibles
source: motionsites.ai archive (catalog title "3D Collectible Hero — 3D Website", free tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: starter
last_used: never
last_client: never
---

## Hero treatment
A full-viewport product carousel for character figurines where the ENTIRE page changes color with the product. Four 3D character renders rotate through four roles — center (1.68x scale, sharp, feet at the bottom edge), left and right wings (small, 2px blur), and back (smallest, 4px blur, hidden behind the center figure) — and every click of the arrow buttons rotates the roles while the page background cross-fades to the active character's color (coral `#F4845F`, green `#6BBF7A`, pink `#E882B4`, blue `#6EB5FF`). Everything — transforms, blurs, opacities, positions, background — animates together over one 650ms `cubic-bezier(0.4,0,0.2,1)` beat.

Behind the figures, giant white ghost text ("3D SHAPE") in Anton at `clamp(90px, 28vw, 380px)` spans the screen at 18% from the top; the characters overlap it, sitting in front. An SVG fractal-noise grain overlay (0.4 opacity, 200px tile) sits over the whole composition, giving the flat toy colors a print-poster texture. Brand label top-left in tracked-out uppercase; product name, a short quote, and two big circular outlined arrow buttons bottom-left; an oversized Anton "DISCOVER IT" link with arrow bottom-right.

## Page layout
One 100vh screen, no scrolling. Images preload on mount so the role swap never pops. Mobile shrinks the center figure to 1.25x at 60% height, narrows the wings to 16% height, and hides the quote paragraph — the layout keeps its corners (brand top-left, controls bottom-left, link bottom-right) at every size.

## Typography
- Display: Anton (Google Fonts) — the giant ghost text and the "DISCOVER IT" link (`clamp(20px, 4vw, 56px)`), uppercase, `-0.02em` tracking
- Body: Inter (Google Fonts, 400-700) — product label in bold uppercase tracking-widest, quote at 13-14px, brand label at 12px with 0.18em tracking
- All white type over the saturated background colors

## Color palette
- Coral `#F4845F`, green `#6BBF7A`, pink `#E882B4`, blue `#6EB5FF` — one full-page background per product, cross-fading 650ms on navigation
- Type and controls: white at 0.85-1.0 opacity throughout
- Grain overlay knocks roughly 8% texture into every color
- No dark mode, no neutrals — the product colors are the palette

## Visual motifs
- **Whole-page color swap** — the background color belongs to the active product and cross-fades with every navigation click
- **Role-rotation carousel** — four items cycle through center/left/right/back positions with synchronized scale, blur, and position changes; depth comes from blur, not 3D
- **Giant ghost text behind the product** — a viewport-wide condensed headline sits behind the figures, half-hidden by them
- **Film-grain overlay** — an SVG noise texture over everything, turning flat color into poster stock
- **Big outlined arrow buttons** — 64px circular white-bordered prev/next controls, transparent until hover
- **Oversized display link** — the corner "DISCOVER IT" link set at display size with an arrow, acting as the page's CTA

## When to use
- Toy and collectible brands with clean cut-out product renders
- Character merch, plush, and figure drops — one screen per product line
- Game studios selling physical or digital collectibles
- Kids and gift brands that want loud color and zero corporate polish
- Any four-product showcase where each product owns a brand color

## When to NOT use
- Brands without isolated product images on transparent backgrounds — the cut-outs are mandatory
- Serious or premium-dark positioning; this is sugar-bright by design (use `noctix-dark-video-waitlist` for the opposite register)
- Catalogs beyond a handful of items — the role math is built for about four
- Pages needing copy, specs, or pricing on screen; there is room for one quote

## Build complexity
MEDIUM — the role-position math, synchronized 650ms transitions, animation locking, and image preloading need care, but it is one component with no scroll logic.

## Library cross-references
- Motif: `whole-page-product-color-swap`
- Motif: `role-rotation-blur-carousel`
- Motif: `giant-ghost-text-behind-product`
- Motif: `film-grain-svg-overlay`
- Motif: `outlined-circle-arrow-controls`
- Motif: `oversized-display-corner-link`
- Typography: `anton-inter-toy-poster`
- Color palette: `coral-green-pink-blue-rotation`
