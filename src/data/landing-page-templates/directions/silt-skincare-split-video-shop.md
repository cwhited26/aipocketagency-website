---
slug: silt-skincare-split-video-shop
name: SILT — Split Video Hero / Hairline Product Shop
vibe: minimal, editorial, lowercase, monochrome, retail-ready
industries: skincare and beauty, cosmetics, wellness products, candles and home fragrance, premium grocery and supplements, fashion accessories, d2c retail, sustainable consumer brands
source: motionsites.ai archive (catalog title "Luxury Ecommerce Design", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
last_used: never
last_client: never
---

## Hero treatment
A storefront, not a stage. The full-height hero splits 50/50: left half is a full-bleed brand photo carrying the message — an all-lowercase light headline ("ethical beauty, / sustainable impact.") at clamp up to 6rem, with three hand-drawn wavy gold lines tucked under the last word like a pen flourish, a one-line commitment paragraph, and a white rounded-full "about us" button. Right half is a VIDEO SLIDESHOW — three product films cross-fading every 5 seconds (700ms opacity transitions) with dot indicators and a small circled pause/play toggle bottom-right. Above everything: a soft-cream announcement bar ("free shipping for orders over 50€") flanked by chevrons, then a transparent nav — tracked uppercase wordmark left, lowercase links center with grow-from-left underline hovers, currency selector + user/search/bag icons right.

Buttons across the site share a lift-and-sheen hover: rise 2px, gain a shadow, and a light streak sweeps across via a translating gradient pseudo-element.

## Page layout
Three sections alternating cream / white / black. Section 2 (best sellers, `#F9F4F0`): an oversize lowercase TAB TOGGLE ("best sellers" ←→ "sets") where the active tab carries a filled dot that bounces in with spring easing; below it a horizontal product carousel of hairline-bordered cards — borders collapse between neighbors (-1px margins) so the row reads as one ruled sheet. Each card: tracked uppercase category label, 3:4 product photo that zooms 105% on hover, centered lowercase name, and a price row with optional strikethrough. Mouse-wheel vertical scroll is hijacked into horizontal movement, and a minimal 2px progress bar tracks position. Section 3 (black): three full-bleed video panels with no gaps, each carrying its category name ("face", "beauty tools", "body") as GIANT VERTICAL TEXT rotated 180° in vertical writing mode at up to text-8xl, a soft dark overlay deepening on hover, and a white pill "shop [name]" button at the bottom. Every section fades up on first scroll into view via IntersectionObserver, products staggering 80ms apart.

## Typography
- Display + body: system UI sans in the prompt — Figtree (Google Fonts) is the honest substitute; hero set font-light, headings all-lowercase, wordmark bold uppercase with 0.2em letter-spacing
- Product labels: tiny tracked uppercase; prices and names small and centered — type stays quiet so product photography leads

## Color palette
- Cream surfaces: `#F9F4F0` (announcement bar, best sellers, card image wells)
- Ink: near-black `#1a1a1a` on cream; categories section pure black with white text
- Gold flourish: `#C8A45C` wavy underline strokes
- Muted gray-400 for inactive tabs and struck-through prices; white pills for every CTA

## Visual motifs
- **Split photo/video hero** — message on a still photo left, product films cross-fading right with dots and a pause control
- **Hand-drawn gold flourish** — three wavy gold strokes under the key headline word, the one ornament on the page
- **Hairline product grid** (the signature) — cards share collapsed 1px borders so the carousel reads as one ruled sheet of products
- **Oversize tab toggle with bouncing dot** — display-size lowercase tabs; the active one carries a spring-animated filled dot
- **Giant vertical category type** — rotated full-height category names over looping video panels
- **Lift-and-sheen buttons** — white pills rise 2px with a light streak sweeping across on hover
- **Wheel-to-horizontal carousel** — vertical scrolling glides the product row sideways, tracked by a thin progress bar

## When to use
- Skincare, beauty, and cosmetics brands with clean product photography and short product films
- Sustainable and ethical consumer brands — the quiet lowercase voice matches the positioning
- D2C shops that want editorial restraint but real retail furniture (prices, sets, categories, bag)
- Candles, supplements, and home fragrance lines with small catalogs worth browsing as one sheet
- Any brand whose products photograph well on pale neutral backgrounds

## When to NOT use
- Catalogs past a few dozen SKUs — the single ruled carousel and three-category footer don't scale to deep inventory
- Brands without product video; the right hero half and category panels go dead with stills alone
- Loud promotional retail (sale banners, urgency timers) — the restraint is the brand here
- Services and SaaS; this is retail furniture through and through (use `bookedup-deep-shadow-saas`)

## Build complexity
MEDIUM complexity. No animation libraries — IntersectionObserver fades, a slideshow timer, wheel hijacking, and border-collapse card math — but six videos and seven product shots make the asset list the long pole.

## Library cross-references
- Motif: `split-photo-video-hero`
- Motif: `hairline-collapsed-product-grid`
- Motif: `oversize-tab-toggle-bounce-dot`
- Motif: `vertical-rotated-category-type`
- Motif: `lift-and-sheen-buttons`
- Motif: `wheel-hijacked-horizontal-carousel`
- Typography: `figtree-light-lowercase-retail`
- Color palette: `cream-ink-gold-flourish`
