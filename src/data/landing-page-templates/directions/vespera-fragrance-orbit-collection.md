---
slug: vespera-fragrance-orbit-collection
name: Vespera — Scroll-Orbit Fragrance Collection
vibe: luxury, editorial, scroll-driven, serif, product-led, cinematic
industries: fragrance, luxury skincare, jewelry, watches, premium spirits, candle and home scent brands, fashion accessories, limited-edition product drops
source: motionsites.ai archive (catalog title "Luxury Ecommerce Design", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
last_used: never
last_client: never
---

## Hero treatment
A 600vh scroll container holds one sticky full-screen scene. The page opens on a full-bleed background video (`/placeholder-hero.mp4`) with a giant Instrument Serif wordmark anchored bottom-left and a small animated scroll arrow. As the visitor scrolls, a WHITE PANEL rotated -15 degrees opens from the center of the screen via an animated ellipse `clip-path` (radius 0% to 55% over the first 8% of scroll progress) — the video world gives way to a clean white product world.

Inside the white panel lives the signature: an ORBIT GALLERY. Six product photos travel an elliptical path built with CSS `offset-path` / `offsetDistance` over an SVG path string. The orbit itself is animated by scroll — radius grows from a flat 330x140 ellipse to a 650px circle, item size from 80px to 360px, the panel's rotation settles from -15 to 0 degrees, and the whole orbit translates left so the focal product sits center-right. A cosine falloff scales the item nearest the focal point to full size while the rest shrink to 0.4. The orbit advances with scroll in the middle band (scroll delta x200) and auto-spins slowly when idle, so it never sits still. The focal product shows a centered serif title (clamp 26-40px) and a short description.

Overlay text elements (a centered serif title with one italic word, a "2K26 / JOIN AN EXCLUSIVE COMMUNITY" block top-right, a "0651 COLLECTION" block bottom-left, and a paragraph + pill button bottom-right) blur in and out on a shared timeline: `blur(15px)` + 20px y-offset at the edges of the scroll range, sharp in the middle and at the very end. The header (logo + wordmark and a black ellipse menu button rotated -15 degrees) fades on the same timeline.

## Page layout
Three zones: the 600vh sticky orbit scene, then a full-height white "Stay in the collection" section (giant serif "Stay *in*" at clamp(60px, 11vw, 160px) with a sans second line at 64px, a product photo anchored to the bottom edge, and an underline email form), then a warm cream footer with four columns (Discover / Studio / Contact / Newsletter), uppercase micro-labels at 0.3em letter-spacing, and a bottom row of copyright, social links, and a locale marker. Section content reveals with a blur-up (opacity 0 + y40 + blur(20px) to sharp over 1s).

## Typography
- Display: Instrument Serif (Google Fonts) — wordmark, overlay titles, focal product names; italics used for single emphasized words
- Body: Manrope (Google Fonts, weights 300-600) — descriptions, labels, footer; micro-labels at 11px with 0.25-0.3em letter-spacing, uppercase
- Great Vibes (Google Fonts) loaded as a script accent face

## Color palette
- Page base: black `#000000` (video world)
- Product panel and stay section: white `#ffffff`
- Footer: warm cream `#f4ecdc`
- Text on white: black, with secondary copy at `rgba(0,0,0,0.72)` to `rgba(0,0,0,0.78)`
- Buttons: solid black pills with white text, rounded 40px

## Visual motifs
- **Orbiting product gallery** (the signature) — six product photos ride an elliptical CSS `offset-path`; scroll drives orbit radius, item size, rotation, and horizontal position; a cosine falloff enlarges whichever item is at the focal point
- **Ellipse clip-path scene change** — a rotated white panel opens from the screen center over the video, swapping the dark cinematic world for a white product world in the first 8% of scroll
- **Blur-up text choreography** — every overlay element shares one timeline of `blur(15px)`/opacity/y-offset keyed to scroll progress, so copy condenses into focus rather than sliding in
- **Scroll-coupled spin with idle drift** — the orbit advances with scroll in the middle of the scene and keeps a slow automatic rotation when the visitor stops
- **Focal product caption** — the centered item shows its name in serif plus a one-line scent description; the gallery doubles as the product browser
- **Editorial corner annotations** — small uppercase serif blocks ("2K26", "0651 COLLECTION") pinned to screen corners like a lookbook spread
- **Underline email capture** — a bare input with a bottom border and an uppercase letterspaced "Subscribe" button, used twice (stay section and footer)
- **Ellipse menu button** — the hamburger sits inside a black ellipse rotated -15 degrees, matching the panel's tilt

## When to use
- Fragrance, skincare, candle, or spirits brands with a small hero collection (4-8 products) and strong bottle photography
- Jewelry and watch lines where each piece deserves a name and a sentence
- Limited-edition drops where browsing the collection IS the page's one job
- Premium consumer brands that want a film-like opening but still need products front and center
- Brands with a good atmospheric video to open on

## When to NOT use
- Catalogs with more than ~8 products — the orbit is a showcase, not a store; it has no grid, filters, or cart
- Service businesses with nothing physical to photograph
- Conversion-driven landing pages — the only actions are an email field and one buy button at the end of a long scroll
- Luxury property or architecture work — use `velar-luxury-real-estate`, which is built for places, not products
- Mobile-dominant traffic — the orbit choreography needs screen width to read

## Build complexity
HIGH — the orbit component is real math (SVG path generation, offset-distance animation, cosine focal scaling) and the whole scene is a hand-tuned scroll timeline; budget it like a custom build, not a template day.

## Library cross-references
- Motif: `orbiting-product-gallery`
- Motif: `ellipse-clip-path-scene-change`
- Motif: `blur-up-text-choreography`
- Motif: `editorial-corner-annotations`
- Motif: `underline-email-capture`
- Typography: `instrument-serif-manrope-luxury`
- Color palette: `black-white-warm-cream-product`
