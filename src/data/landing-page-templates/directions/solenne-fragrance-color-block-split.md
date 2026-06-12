---
slug: solenne-fragrance-color-block-split
name: Solenne — Color-Block Fragrance Split
vibe: playful, editorial, color-block, feminine, slow-motion
industries: fragrance, beauty, skincare, candles, boutique cosmetics, lifestyle d2c, gift brands, fashion accessories
source: motionsites.ai archive (catalog title "Daisy Shop", premium tier — export titles misaligned, identified by content; prompt apes a major designer fragrance line — placeholder brand and product names swapped; extracted Jun 12 2026)
tier_required: studio_plus
last_used: never
last_client: never
---

## Hero treatment
The aesthetic is playful designer-perfume: a full-screen hero video (soft, daisy-field-feeling product footage) with the brand name stacked in tiny black uppercase top-left ("Solenne / Fragrances") and underline-wipe nav links ("Shop Now", "Cart") top-right. The headline sits bottom-left in medium-weight uppercase at `clamp(2.2rem, 8vw, 4rem)` — first line in the warm near-black `#332023`, the following lines in a dusty mauve `#B0A2A1` (on mobile the lines flip to white with soft text shadows over the video). Desktop adds two pieces of editorial furniture: a giant italic Playfair Display "01" slide index on the left edge at up to 6rem, and a small italic Georgia "Scroll" cue on the right edge. A white floating product card sits bottom-right — small product photo, name, size, and an "Add to Cart" text button whose underline wipes out and re-draws on hover (two stacked origin-flipping spans). Every entrance is a long, soft rise: 1.4-1.8s durations on `cubic-bezier(0.22, 1, 0.36, 1)` with 100-1300ms stagger.

## Page layout
Three full sections. After the hero, two mirror-image product spreads: each is a 50/50 desktop grid pairing a solid color-block product panel with a full-bleed looping video — sky blue `#4BB3ED` panel with video right, then video left with a lime `#BDE84F` panel (mobile stacks panel above a 75vw-tall video strip). Each panel is a self-contained product page: mood words in the top corners ("Daisy love" / "Sweet"), a centered product photo at fixed 220/340 aspect on a gray placeholder block, name and size caption, then a bottom row with a scent-note ledger (three label + UPPERCASE INGREDIENT pairs) and an outlined SHOP NOW button whose white fill wipes in from the left on hover. Reveals fire once via IntersectionObserver at 0.15 threshold with the same long-ease stagger.

## Typography
- Display + body: system sans stack (the prompt loads no Google Fonts) — uppercase medium headlines, 12px bold wide-tracked buttons and labels
- Accent: Playfair Display italic for the giant "01" slide index; Georgia italic for the small "Scroll" cue — two serif moments on an otherwise sans page

## Color palette
- Page: white `#ffffff`; panel text pure black `#000000`
- Hero text: warm near-black `#332023` with dusty mauve `#B0A2A1` secondary lines
- Color blocks: sky blue `#4BB3ED` and lime `#BDE84F`
- Product photo placeholder: `#D9D9D9`; card shadows at `rgba(51,32,35,0.08)`

## Visual motifs
- **Color-block product spreads** — each product gets a solid saturated panel (blue, then lime) butted against a full-bleed video half; the mirror-flip between sections keeps the rhythm
- **Floating add-to-cart card** — a small white shadowed card pinned bottom-right of the hero with photo, size, and an underline-wipe Add to Cart
- **Giant italic slide index** — an oversized serif "01" on the hero's left edge, framing the page as a numbered editorial sequence
- **Underline-wipe links** — nav and buttons animate a 1px underline scaling from one origin out and back in from the other
- **Fill-wipe outlined button** — SHOP NOW in a thin black outline; a white fill slides in from the left and the label flips dark
- **Scent-note ledger** — three label/ingredient pairs ("Fruity top — WHITE RASPBERRIES" style) set as a tight uppercase list
- **Long-ease slow reveals** — 1.4-1.8s rises on a soft quintic-out curve make the whole page feel unhurried and expensive

## When to use
- Fragrance, beauty, and skincare brands with strong product photography and lifestyle video
- D2C gift and lifestyle products sold one hero SKU at a time
- Candle, bath, and boutique cosmetics lines that want playful color without clutter
- Young, feminine-leaning brands where a designer-counter feel sells the price point
- Two-or-three-product launches where each product can own a full spread

## When to NOT use
- Catalogs with many SKUs — the one-spread-per-product structure caps out around three products (use `real-estate-listing-grid-search` patterns for grid-and-filter needs)
- B2B or service businesses — the color-block candy palette reads retail
- Brands without product photos AND video per product; every spread needs both
- Dark, moody luxury — this is daylight luxury; `velar-luxury-real-estate` owns the shadowed end

## Build complexity
LOW. Three sections, CSS-transition animations only, one reusable ProductPanel component, IntersectionObserver triggers. The craft is in timing and spacing, not engineering.

## Library cross-references
- Motif: `color-block-video-split-spreads`
- Motif: `floating-product-card-hero`
- Motif: `giant-italic-slide-index`
- Motif: `underline-wipe-links`
- Motif: `fill-wipe-outlined-button`
- Motif: `scent-note-ledger-list`
- Typography: `system-sans-serif-accent-moments`
- Color palette: `white-sky-blue-lime-warm-black`
