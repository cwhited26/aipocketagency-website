---
slug: jack-3d-creator-portfolio
name: Jack — 3D Creator Portfolio
vibe: bold, premium, portfolio, gradient-display, interactive
industries: 3D artists, motion designers, brand identity studios, individual creator portfolios, agencies showcasing personal craft
source: motionsites.ai (Jack — 3D Creator prompt)
last_used: never
last_client: never
---

## Hero treatment
Massive gradient-filled display heading ("Hi, I'm jack") spans nearly the full viewport width using `text-[14vw]` scaling to `text-[17.5vw]` at desktop. The display gradient runs `#646973 → #BBCCD7` (cool gunmetal to icy steel) via `-webkit-background-clip: text`. A magnetic-hover portrait sits centered absolutely below the heading — the portrait follows the cursor within a 150px radius with a strength factor of 3, smoothly easing out on cursor exit. The page background is `#0C0C0C`.

A bottom bar pairs a short ALL-CAPS tagline on the left with a colorful gradient pill CTA on the right (the CTA uses a multicolor gradient: deep purple → magenta → orange).

## Page layout
Five sections:
1. Hero (full viewport, gradient display + magnetic portrait)
2. Marquee (two horizontal rows of 21 portfolio thumbnails that scroll opposite directions based on page scroll position — parallax effect)
3. About (centered, with 4 decorative 3D icons in each corner, gradient display heading, character-reveal body text)
4. Services (WHITE background, 5 numbered service rows separated by hairline borders)
5. Projects (dark background, 3 STICKY-STACKING cards that scale down 0.97 → 1.0 as scroll moves past, creating a depth-stack effect)

## Typography
- Display + body: Kanit (Google Fonts) — weights 300/400/500/700/900
- Hero gradient: `linear-gradient(180deg, #646973 0%, #BBCCD7 100%)` clipped to text
- Sizing approach: heavy use of `clamp()` for fluid typography across viewports
- Service numbers: clamp(3rem, 10vw, 140px), font-black
- Body text color: `#D7E2EA` (cool pale blue) on the dark sections, `#0C0C0C` on the white services section

## Color palette
- Background dark: `#0C0C0C` (true near-black)
- Background light: `#FFFFFF` (services section only — strong contrast inversion)
- Primary text on dark: `#D7E2EA` (cool icy blue)
- Display gradient: `#646973 → #BBCCD7`
- Pill CTA gradient: `#18011F → #B600A8 → #7621B0 → #BE4C00` (deep purple → magenta → orange)
- Pill CTA shadow: inner shadow `0px 4px 4px rgba(181,1,167,0.25)` + `4px 4px 12px #7721B1`

## Visual motifs
- **Magnetic hover portrait** — image follows cursor within a 150px activation radius, transforms via translate3d divided by strength, smooth in/out transitions (0.3s/0.6s)
- **Parallax marquee rows** — two horizontal rows of thumbnails, one scrolls right, one scrolls left, speed = `(scrollY - sectionTop + viewportHeight) * 0.3`
- **Gradient display text** with -webkit-background-clip on a giant clamp-sized heading
- **Sticky-stacking project cards** — each card uses `position: sticky; top: 6rem`, scales as scroll progresses, creating an accordion-depth stack
- **Multi-color gradient pill CTA** with deep purple → magenta → orange and complex inner shadows
- **Character-by-character scroll-reveal** on body text (same pattern as Prisma)
- **Decorative corner 3D icons** anchoring the About section (moon, lego, 3D objects)
- **Numbered service rows** with massive numbers (clamp 3rem-140px) + name + description, separated by hairline borders

## When to use
- Individual creator portfolios (3D artists, motion designers, illustrators, photographers)
- Personal brand sites for agency principals or freelancers
- Brand identity studios where the founder IS the brand
- Anyone with a strong visual aesthetic and a real body of work to showcase
- High-end portfolio-driven verticals (architecture, interior design, industrial design)
- Studios where "the founder's craft is the product"

## When to NOT use
- Local services / blue collar — the gradient pill CTA reads as "tech startup" not "neighborhood pro"
- E-commerce — the scroll-driven page is too long for product browsing
- Anything that needs to convert in the first viewport
- B2B SaaS marketing — too portfolio-feel
- Anyone without a strong existing visual portfolio (this style is brutal to fake)

## Reference source
motionsites.ai Jack — 3D Creator prompt — extracted 2026-06-11.

## Library cross-references
- Motif: `magnetic-portrait-hover-followup`
- Motif: `parallax-marquee-scroll-rows`
- Motif: `sticky-stacking-project-cards`
- Motif: `gradient-display-text-clip`
- Typography: `kanit-gradient-display`
- Color palette: `near-black-icy-blue-multicolor-pill`
