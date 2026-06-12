---
slug: forma-studio-pitch-deck-slides
name: Forma Studio — Pitch Deck as a Website / Serif Italic Glass Slides
vibe: cinematic, editorial, glassy, serif-italic, presentation
industries: design studios, creative agencies, ai product studios, marketing agencies, consultancies, venture-backed startups, b2b services, sales teams
last_used: never
last_client: never
source: motionsites.ai archive (catalog title "Pro AI Deck", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
---

## Hero treatment
This is a special-purpose layout: a 7-slide PITCH DECK built as a full-screen web app, navigated by mouse wheel, arrow keys, or touch swipe — not a scrolling site. Every slide is a full-viewport scene over its own background video (a mix of MP4 and HLS streams; one runs desaturated to grayscale, one at 50% opacity over black, several with no overlay at all). Slides sweep horizontally on transition: the incoming slide arrives from 100% offscreen at scale 0.95, the outgoing one exits 30% in the opposite direction (0.65s, ease [0.4, 0, 0.2, 1]), with an 800ms navigation lock so fast scrolling can't break the choreography.

The typographic identity is Instrument Serif ITALIC for every heading — title slide at up to 6.5rem with -3px tracking and 0.85 line-height — paired with Barlow for all body text. Headlines enter through a word-by-word blur reveal: each word starts blurred 10px, 50px low, and transparent, then resolves through a midpoint keyframe to sharp (0.7s per word, staggered). Cards, badges, and CTAs all ride one liquid-glass recipe (a stronger 50px-blur variant for emphasized surfaces).

A persistent control bar is fixed at the bottom: slide counter ("01 / 07"), animated slide label, dot indicators where the active dot stretches to a 96px bar, and circular prev/next chevron buttons.

## Page layout
Seven slides in a fixed order that maps to a sales narrative: Title → Process → Capabilities → Differentiators → Traction (stats) → Social Proof (testimonials) → Next Steps (CTA + contact card). Each slide is its own composed layout — split columns with glass cards, a 2x4 card grid, oversized stat rows with hairline dividers, a 3-up testimonial grid, and a closing slide with contact info in a glass panel. Grids collapse to single column on mobile; swipe replaces wheel.

## Typography
- Display: Instrument Serif (Google Fonts), always italic — headings from text-4xl up to 10rem, tracking-tight, line-height 0.85-0.9
- Body: Barlow (Google Fonts, weights 300-600) — light weight for descriptions at 40-70% white, semibold for card titles
- Micro-labels: 10px uppercase with 0.2-0.3em tracking at 30% white ("The Process", "Traction", "Next Steps")

## Color palette
- Base: black `#000000` behind all videos
- Foreground: white `#ffffff` in opacity tiers (100% headings, 70% quotes, 40% body, 30% labels)
- Glass surfaces: `rgba(255,255,255,0.12)` fills with `rgba(255,255,255,0.25)` hairline borders
- Soft blue-gray system accent `#86aed0` (hsl 213 45% 67%) available in tokens but the rendered deck stays monochrome
- Slide 5 video runs `saturate(0)` — a full grayscale scene as a palette move

## Visual motifs
- **Horizontal slide navigation** — wheel, keyboard, and swipe all advance slides with a sweep-and-scale transition and an 800ms lock
- **Serif-italic display headings** — every headline in italic serif at poster scale, 0.85 line-height, against video
- **Word-by-word blur reveal** — words resolve from blur(10px)/+50px/transparent through a mid keyframe to sharp, staggered ~80-100ms
- **Glass card system** — one liquid-glass recipe (gradient hairline border via mask-composite) across feature cards, testimonial cards, badges, and the contact panel
- **Persistent deck controls** — bottom bar with counter, label, stretching active-dot indicator, and chevron buttons on every slide
- **Oversized stat rows** — numbers up to 9.5rem serif italic beside plain-language descriptions, separated by hairline top dividers
- **Mixed video treatments per slide** — full color, 60% black overlay, 50% opacity over black, grayscale filter, and bottom gradient scrim each used on different slides
- **Video-topped feature cards** — capability cards with a looping video strip above glass-backed text

## When to use
- A studio or agency that pitches: this IS the sales deck, hosted at a URL instead of a PDF
- AI product studios and consultancies selling a 7-step story (problem → capabilities → proof → call)
- Venture-backed startups that want an investor-facing narrative page
- Sales teams replacing slide attachments with a link
- Brands with strong video assets and short, confident copy

## When to NOT use
- A normal marketing site — there is no scroll, no deep pages, no SEO surface
- Anyone who needs visitors to skim and self-navigate; the deck forces linear order
- Content-heavy services with long explanations (use `cognitra-ai-agency-gray-panel`)
- Teams without video assets — seven slides need seven backgrounds
- Mobile-first audiences with slow connections; multiple streaming videos are heavy

## Build complexity
HIGH. Seven distinct slide layouts, HLS streaming support, wheel/keyboard/touch navigation with locking, and per-slide animation choreography — this is an app build, not a page build.

## Library cross-references
- Motif: `horizontal-slide-deck-navigation`
- Motif: `word-blur-reveal-headline`
- Motif: `liquid-glass-card-system`
- Motif: `persistent-deck-control-bar`
- Motif: `oversized-serif-stat-rows`
- Motif: `video-topped-feature-cards`
- Typography: `instrument-serif-italic-barlow`
- Color palette: `black-white-opacity-tiers-glass`
