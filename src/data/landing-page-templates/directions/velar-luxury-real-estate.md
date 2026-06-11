---
slug: velar-luxury-real-estate
name: Velar. — Luxury Real Estate
vibe: luxury, editorial, scroll-driven, architectural, sophisticated, prestige
industries: luxury real estate, architecture firms, high-end interior design, prestige hospitality, art galleries, premium property management, estate brokers
source: motionsites.ai (catalog title "Velorah" — actual brand "Velar." — extracted Jun 11 2026)
last_used: never
last_client: never
---

## Hero treatment
This is the most complex direction in the library — a multi-section scroll-orchestrated luxury site. Section 1 is a TYPEWRITER PRELOADER ("Velar." types out letter by letter on a deep teal `#213138` background with a blinking cursor, then the entire overlay slides up out of view). Section 2 is a fixed navigation with a wordmark that COLOR-CHANGES based on what section is currently at viewport top (white over dark sections, dark teal over the warm cream sections). Section 3 is the hero — a warm cream `#f5f0ea` background with a giant SYNE 800 display heading ("LIVE IN" + "IRREPLACEABLE") at architectural scale, plus a subtitle paragraph that swaps based on viewport (different subtitle text mobile vs desktop). Section 4 is a SCROLL-DRIVEN HOUSE ANIMATION — a house image that rises from below the viewport during the intro, then scales and moves with scroll progress as the visitor moves past the hero. Sections 5 and 6 stack: a sticky dark statement section with COUNT-UP STATS, then a HOVER-EXPAND VIDEO GALLERY that slides over it with negative margin-top.

## Page layout
Six choreographed sections, each with custom JavaScript controlling scroll position, transforms, and visibility. The page reads like a film unfolding rather than a website you skim. This is the apex of "editorial luxury site" — anything less complex won't read as Velar tier; anything more risks feeling overwrought.

## Typography
- Display: Syne (Google Fonts, weights 400/700/800/900) — used for the brand wordmark AND the giant display heading. Letter spacing tight (`letter-spacing: -0.02em` on the wordmark, `-0.03em` on the hero heading)
- Body: Inter (Google Fonts, weights 300/400/500/600) — for body, paragraph, stats, labels
- Mobile/desktop subtitle text differs (different line breaks, different word counts) — explicit per-viewport authoring
- The wordmark has one character at weight 900 (the period after "Velar.") while the rest is weight 700 — a tiny weight emphasis that adds quality

## Color palette
- Background: `#f5f0ea` (warm off-white / cream)
- Dark sections: `#213138` (deep teal — preloader, statement, and gallery)
- Display + body text: `#000000` on cream, `#ffffff` on dark
- Statement section text: `#e8e4df` (warm white — subtly different from pure white)
- Nav color transitions between white and dark teal based on viewport (cross-fades over 0.35s)
- Stat labels: `rgba(255,255,255,0.6)` (60% white)

## Visual motifs
- **Typewriter preloader** — letter-by-letter reveal with blinking cursor, then the entire overlay slides up out of view (`translateY(-100%) over 1.5s cubic-bezier(0.45, 0, 0.15, 1)`)
- **Scroll-driven house animation** — a fixed-position image that rises from below the viewport, then scales (`finalScale = 1.45`) and translates with scroll progress using a smoothstep-of-smoothstep easing (`t = smoothstep(smoothstep(progress))`)
- **Color-shifting navigation** — wordmark color changes based on which section is currently at viewport top (`rect.top <= 0 && rect.bottom > 0`)
- **Sticky statement section** with **CountUp stat numbers** that animate from 0 to their final values over 2000ms when IntersectionObserver triggers, with cubic ease (`1 - (1 - t)^3`)
- **Section slides over previous section** via negative `margin-top: -100vh` and higher z-index — the gallery slides up over the statement section like a film cut
- **Hover-expand video gallery** — accordion expand: hover one tile, it grows to `flex: 4` while others shrink (`flex 0.5s cubic-bezier(0.4, 0, 0.2, 1)`)
- **Background ticker** behind the gallery — repeating brand wordmark at giant scale (`clamp(100px, 14vw, 220px)`)
- **Per-viewport responsive type** — mobile, tablet, and desktop each get DIFFERENT subtitle text, line breaks, and font sizes
- **Mobile menu as fullscreen overlay** with `text-4xl` link list and uppercase letterspacing

## When to use
- Luxury real estate brokers, estate agents, building developers
- Architecture firms with strong portfolio
- High-end interior design studios
- Boutique hotels with editorial-quality photography
- Art galleries, antique dealers, auction houses
- Yacht / private aviation / high-end leisure
- Anyone whose target audience is HNW and reads The World of Interiors / Architectural Digest
- Brands whose product is so visual that scroll-driven storytelling sells better than copy

## When to NOT use
- Anyone without exceptional photography and video assets — this direction will EXPOSE weak imagery
- Local services / blue collar — wrong audience entirely
- Mobile-dominant traffic — the scroll choreography requires desktop or large tablet to read properly
- Anyone with a tight budget on initial scope — this direction is a Custom Build per `feedback_bos_sites_productized.md`, NOT Tier 1/2/3
- Conversion-driven landing pages — this direction is for browsing visitors, not action-taking visitors

## Reference source
motionsites.ai catalog title "Velorah" — actual brand inside the prompt is "Velar." (period included). This is the apex luxury real estate direction in the library. Extracted Jun 11 2026.

## Library cross-references
- Motif: `typewriter-preloader-slide-up`
- Motif: `scroll-driven-fixed-image-animation` (the rising house)
- Motif: `color-shifting-navigation-by-section`
- Motif: `sticky-statement-with-countup-stats`
- Motif: `section-slides-over-previous-section`
- Motif: `hover-expand-video-gallery`
- Motif: `background-ticker-wordmark`
- Motif: `per-viewport-distinct-subtitle-text`
- Typography: `syne-inter-luxury`
- Color palette: `warm-cream-deep-teal-luxury`

## Build complexity warning
This direction is the most complex in the library. A real production build of Velar-tier will need 2-3x the time of a typical Tier 1 site. Quote it as Custom Build, not Tier 3.
