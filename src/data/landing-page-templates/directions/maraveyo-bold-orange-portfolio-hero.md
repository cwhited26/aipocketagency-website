---
slug: maraveyo-bold-orange-portfolio-hero
name: Maraveyo — Designer Portfolio / Orange Poster Hero
vibe: loud, energetic, poster-like, personal, condensed-type
industries: freelance designers, creative portfolios, art directors, photographers, personal brands, creative agencies, illustrators, fashion creatives
last_used: never
last_client: never
source: motionsites.ai archive (catalog title "Viktor Portfolio", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
---

## Hero treatment
A poster, not a page. The whole screen is a vertical gradient from hot red-orange `#fd2601` to lighter orange `#f37e1c`, with the designer's name ("MARAVEYO"-style wordmark) ghosted across the background at 8% white opacity with a 4px blur, and two glowing orange blobs (`#F4791B`, 80px blur, mix-blend-screen at 60% opacity) breathing in the bottom corners. The headline is the statement "NEW DESIGN ERA" in Anton — massive condensed uppercase at ~12vw (capped 180px), white, one line on desktop, stacked NEW / DESIGN / ERA on mobile.

The depth trick: a portrait photo of the designer sits absolutely centered OVER the headline, masked with a rough paint-brush-stroke shape so it reads as a torn cutout rather than a rectangle. Type at z-10, portrait at z-20 — the person physically overlaps their own headline. Two floating annotation blocks anchor the composition: bottom-left an intro ("// I'm Mara — a freelance UI/UX designer..."), right-middle a right-aligned tagline ("// DESIGN THAT / SPEAKS YOUR BRAND"). Even text selection is art-directed: selecting flips to white background with orange text.

## Page layout
Single screen. Floating transparent nav (asterisk-prefixed wordmark left, four uppercase links center, "// HIRE ME" plus a circled diagonal-arrow button right — the circle fills white on hover and the arrow flips orange). Centered headline + masked portrait, two floating annotations, and a bottom brand strip of white semi-transparent client logos spread across the width. On mobile the absolute-positioned annotations re-stack below the image and the logo strip wraps centered.

## Typography
- Display: Anton (Google Fonts) — massive, uppercase, condensed; ~12vw scale capped at 180px
- Body: Inter (Google Fonts) — minimalist uppercase UI text with wide tracking
- Annotations use a "//" comment prefix as a recurring typographic device

## Color palette
- Gradient field: red-orange `#fd2601` → orange `#f37e1c`, top to bottom
- Glow blobs: `#F4791B` at blur(80px), mix-blend-screen, 60% opacity
- All type and icons: white `#ffffff`
- Selection state: white background, `#fd2601` text
- Logo strip: white at 90% opacity

## Visual motifs
- **Brush-stroke portrait cutout** — a centered portrait masked with a rough paint-stroke CSS mask, overlapping the giant headline (image above type) for instant depth
- **Poster-scale condensed headline** — Anton uppercase at ~12vw/180px, one line desktop, word-stacked mobile
- **Ghost name watermark** — the designer's name as huge centered background type at 8% white opacity with a 4px blur
- **Glowing corner blobs** — two large orange blurs blended with mix-blend-screen breathing behind the content
- **Comment-prefix annotations** — "//"-prefixed floating intro and tagline blocks placed like margin notes
- **Circled arrow hire button** — "// HIRE ME" text plus a white-bordered circle with a diagonal arrow; circle fills white on hover, arrow turns orange
- **Art-directed text selection** — ::selection flips to white-on-orange, extending the brand into a detail nobody expects
- **Client logo strip** — semi-transparent white logos in a row along the bottom edge

## When to use
- Freelance designers, art directors, and illustrators who want to be remembered
- Personal brands where the person IS the product — the portrait carries it
- Creative portfolios competing for attention against quiet minimal sites
- Young agencies and creators with strong client logos to show
- Anyone whose work justifies a loud first impression

## When to NOT use
- Corporate, B2B, or service businesses — the volume is wrong for them
- Anyone without a strong portrait photo; the cutout is the centerpiece
- Brands not built on orange/red heat — the gradient IS the identity here
- Multi-person studios; this layout speaks in the first person singular
- Quiet luxury positioning (use `velar-luxury-real-estate`)

## Build complexity
LOW-MEDIUM. Static layout with no JS animation to speak of; the work is in the brush-stroke mask asset, the blend-mode blobs, and the desktop-absolute-to-mobile-stacked responsive shift.

## Library cross-references
- Motif: `brush-stroke-portrait-cutout`
- Motif: `poster-scale-condensed-headline`
- Motif: `ghost-name-watermark`
- Motif: `glowing-blend-mode-blobs`
- Motif: `comment-prefix-annotations`
- Motif: `circled-arrow-hover-fill-cta`
- Typography: `anton-inter-uppercase`
- Color palette: `red-orange-gradient-white`
