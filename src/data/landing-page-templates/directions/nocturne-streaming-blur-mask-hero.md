---
slug: nocturne-streaming-blur-mask-hero
name: Nocturne — Streaming / Bottom-Blur Cinematic
vibe: dark, cinematic, glassy, immersive, restrained
industries: streaming platforms, film studios, entertainment media, video production, event cinema, music video platforms, media review sites, gaming media
source: motionsites.ai archive (catalog title "Cinematic Landing Page" (uncertain — possibly "Celestia"), premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
last_used: never
last_client: never
---

## Hero treatment
A single full-viewport movie/streaming hero — no scrolling, no second section. A full-screen background video loops behind everything, and the signature move is the BOTTOM BLUR MASK: there is no dark gradient at all. Instead, one fixed full-screen overlay applies `backdrop-blur-xl` and is masked with `mask-image: linear-gradient(to top, black 0%, transparent 45%)`, so the lower half of the video frosts over and the content sits on frosted glass while the upper half stays crystal clear.

Content is pinned to the bottom of the viewport, film-poster style: a metadata row (star rating, runtime, release date with inline icons), a big light-weight title at `-0.04em` tracking (text-7xl desktop), a gray-400 logline, then a white "Watch Now" pill next to a liquid-glass "Learn More" pill. Previous/Next glass pill arrows sit bottom-right for browsing featured titles. Every element on the page enters with the same blur-fade-up animation — `opacity 0 / blur(20px) / translateY(40px)` to clear — staggered 0ms to 900ms across logo, nav links, buttons, metadata, title, and CTAs.

The glass treatment is a reusable liquid-glass recipe: near-transparent white background with `background-blend-mode: luminosity`, `backdrop-filter: blur(4px)`, an inset top highlight, and a `::before` gradient stroke built with mask-composite so only a thin glowing border renders.

## Page layout
One viewport, period. Navbar across the top (text logo left, five category links center on desktop, glass Search pill and glass profile circle right), hero content flex-pushed to the bottom with `justify-end`. Below lg the nav links collapse into a hamburger with a slide-down `bg-gray-900/95` menu; below sm the Search/profile buttons move into that menu too. On md+ the title block and the Previous/Next arrows sit side by side at the bottom edge.

## Typography
- Display + body: Inter (Google Fonts, weights 300-700) — the title runs font-normal at text-3xl mobile up to text-7xl desktop with `-0.04em` letter-spacing
- Subtitle: text-base to text-xl in gray-400, max-w-2xl

## Color palette
- Background: pure black `#000000` behind the video
- Text: white, with `#9ca3af` (gray-400) for the logline
- Glass elements: near-transparent white `rgba(255,255,255,0.01)` with luminosity blend and blur
- The single solid element: white "Watch Now" button with black text and a filled black play icon

## Visual motifs
- **Bottom blur fade** — the only video treatment is a backdrop-blur overlay masked to fade from solid at the bottom to nothing at 45% height; no darkening gradient anywhere
- **Liquid-glass pills** — every secondary control (Search, profile, Learn More, Previous/Next) is the same glass recipe with a gradient border stroke via mask-composite
- **Blur-fade-up entrance on everything** — one keyframe (`blur(20px)/y40` to clear, 1s ease-out) staggered in 50-100ms steps across the whole page, 0ms to 900ms
- **Film metadata row** — star rating, runtime, and date with inline icons above the title, the cue that this is a title page not a product page
- **Bottom-pinned poster layout** — content sits at the bottom edge of the viewport over the clearest part of the video
- **Previous/Next browse pills** — glass chevron buttons bottom-right imply a rotating featured-title carousel
- **Animated hamburger swap** — menu and close icons cross-fade with rotate-180 and scale over 500ms

## When to use
- Streaming services, film studios, festival or premiere pages
- A featured-title or trailer page where the video itself is the product
- Music video, documentary, or episodic content launches
- Entertainment brands that want a quiet, premium browse feel instead of a busy grid
- Any single-screen teaser page where one piece of footage carries everything

## When to NOT use
- Anyone who needs scrolling content — this is one viewport with no sections below
- Service businesses or SaaS — the metadata row and Watch Now framing read as entertainment only
- Brands without strong video footage; the un-darkened upper half shows every flaw
- Conversion pages that need forms or pricing (use `bookedup-deep-shadow-saas` for SaaS conversion)

## Build complexity
LOW complexity. One viewport, one reusable glass class, one keyframe with staggered delays. The blur mask is two CSS lines. A focused half-day build.

## Library cross-references
- Motif: `bottom-blur-mask-no-gradient`
- Motif: `liquid-glass-pills-gradient-stroke`
- Motif: `blur-fade-up-staggered-entrance`
- Motif: `bottom-pinned-poster-content`
- Motif: `full-bleed-video-no-overlay`
- Typography: `inter-light-tight-display`
- Color palette: `black-white-glass-monochrome`
