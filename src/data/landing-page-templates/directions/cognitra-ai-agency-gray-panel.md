---
slug: cognitra-ai-agency-gray-panel
name: COGNITRA — AI Agency / Gray Panel Editorial
vibe: editorial, modern, AI-confident, restrained, magazine-counter, video-as-context
industries: AI agencies, automation consultancies, fractional CTO services, AI implementation firms, premium product studios, modern dev shops, B2B AI SaaS, AI strategy consultancies
source: motionsites.ai (catalog title "Reveal Hero" — actual brand: COGNITRA AI agency — extracted Jun 11 2026)
last_used: never
last_client: never
---

## Hero treatment
Three vertically-scrolling sections layered over a SINGLE fixed full-viewport background video. Section 1 is the hero with a TOP-THIRD gray overlay panel (`#C5C5C5`) carrying the hero copy in a two-column layout — the video shows through in the bottom 52%. Section 2 is a transparent statement section showing only the video with a heading + paragraph overlaid in white. Section 3 is a gray `#C5C5C5` services section with 3 video-preview cards in a 3-column grid. The whole scroll experience reads like a magazine spread that the visitor flips through, with the video providing the ambient "this is what we do" context throughout.

The signature is the **gray-panel + transparent-section + gray-panel sandwich** over a single fixed video — a sophisticated layout pattern that creates a sense of curated transitions.

## Page layout
- Section 1 (Hero, 100vh): top-third gray panel + bottom 52% revealing the video
- Section 2 (Statement, 100vh, transparent): word-by-word fadeup heading over the video
- Section 3 (Services, auto height, gray): editorial 3-card grid with video previews
- Fixed scroll-bounce indicator (bottom center)
- Fixed "REPOST" share button (bottom right) — a quiet magazine-style sharing affordance

## Typography
- Display + body: Helvetica Now Var (from `db.onlinewebfonts.com`) — Swiss editorial standard, modern + restrained
- All headlines uppercase, fontWeight 700, `letter-spacing: -0.01em`, `line-height: 1.05-1.08`
- Body: 18px lead, 14px supporting
- Small captions / counters: 11px, `letter-spacing: 0.08em`
- Display sizing: `clamp(26px, 3vw, 42px)` — deliberately mid-scale (NOT the giant hero text most agency sites use)

## Color palette
- Background video: provides ambient context
- Section 1 + 3 overlay: `#C5C5C5` (mid-warm gray — feels like quality paper)
- Body text on gray: `#1a1a1a` (warm near-black)
- Body text on video: white at 90% opacity
- Secondary text: `#5a5a5a` and `#3a3a3a` (mid grays)
- Captions: `#666`
- CTA primary: `bg-[#1a1a1a]` solid pill with white text; secondary is transparent with `border-[#1a1a1a]`

## Visual motifs
- **Top-third gray overlay panel** over a fixed video — the video shows through only in the bottom 52% of the hero. This creates a magazine-cover composition (top "title" panel + bottom "image" panel)
- **Single fixed background video** for the entire page — the video doesn't change as you scroll; the sections layer over it. Creates a "the brand is what you're seeing in motion behind everything" effect
- **Magazine slide counter** (`001 / 005`, `003 / 005`) — a small editorial pattern that tells the visitor "you're on chapter X of Y." Quiet but signals "designed"
- **Word-by-word FadeUp animation** on statement headings (Framer Motion, each word delayed by 0.08s, `y: 32 → 0`)
- **3-column service cards** with VIDEO PREVIEWS inside each card (4:3 aspect ratio). Each card has a clean 1px border at 18% opacity + 20px border radius
- **Fixed scroll-bounce indicator** (22×36px pill with bouncing dot inside) — a classic, modest cue
- **Fixed "REPOST" share button** with a small share icon — a subtle social affordance that doesn't beg
- **Transparent statement section** between two gray panels — the visitor scrolls from gray → video → gray, creating an intentional pacing
- **Two-tier CTA pair** (solid black + outlined) — standard but executed cleanly with `border-radius: 9999px` and `uppercase tracking-0.08em` button text
- **Custom Helvetica Now Var** (NOT Inter) — a small typography choice that signals "we chose a real font, not the default"

## When to use
- AI agencies, automation consultancies
- Fractional CTO services, AI implementation firms
- Premium product studios with an AI / technical focus
- Modern dev shops with a thoughtful brand
- B2B AI SaaS with an editorial brand sensibility
- AI strategy / advisory consultancies
- Brands wanting "Apple-level restrained" rather than "AI startup maximalism"
- Anyone whose differentiator is "we don't shout — we're confident"

## When to NOT use
- AI brands trying to feel scrappy / indie / playful (this reads as established)
- Conversion-led landing pages where the call IS the conversion
- Mobile-dominant traffic where the layered panel composition collapses
- Anyone without a strong background video that matches their actual product
- Local services / blue collar — wrong audience entirely

## Build complexity
MEDIUM complexity. The layered fixed-video + gray-panel composition is straightforward but requires careful z-index work. The word-by-word FadeUp pattern is one component used three times. Tier 2-3 build can ship this in a focused day or two.

## Library cross-references
- Motif: `gray-panel-over-fixed-video-sandwich`
- Motif: `single-fixed-background-video-multi-section`
- Motif: `magazine-slide-counter`
- Motif: `word-by-word-fadeup-statement`
- Motif: `3-card-service-grid-with-video-previews`
- Motif: `fixed-scroll-bounce-indicator`
- Motif: `fixed-repost-share-bottom-right`
- Typography: `helvetica-now-var-editorial-restrained`
- Color palette: `mid-warm-gray-panel-warm-near-black`
