---
slug: glasswing-liquid-glass-ai-agency
name: Glasswing Studio — Black Liquid-Glass AI Agency
vibe: dark, glassy, editorial, cinematic, serif-led
industries: web design agencies, AI service agencies, creative studios, branding agencies, digital product studios, marketing agencies, video production, premium freelancers
source: motionsites.ai archive (catalog title "Liquid Glass Agency", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
last_used: never
last_client: never
---

## Hero treatment
Black-page luxury editorial built on one repeated material: LIQUID GLASS. Every badge, nav pill, card, and primary button is a near-transparent panel (`rgba(255,255,255,0.01)` with luminosity blend and backdrop blur) wearing a gradient hairline border made with the mask-composite trick — bright at the top and bottom edges, fading to nothing mid-height. Two strengths exist: subtle (4px blur) for cards and badges, strong (50px blur + drop shadow) for CTAs.

The hero is a tall 1000px section over a background video positioned low in the frame, with a 300px black gradient pulling the footage into the page. Content stacks center: a glass badge pill with an inner white "New" chip, then the headline ("The Website Your Brand Deserves") in Instrument Serif ITALIC at up to 5.5rem, leading 0.8, -4px tracking — animated WORD BY WORD with a blur dissolve (each word rises 50px from blur(10px)/opacity 0 through a half-sharp midpoint to crisp, staggered ~100-200ms, triggered by IntersectionObserver). Subtext and the button pair blur in on delays. At the hero's foot, a partners bar renders five partner names as plain serif-italic TEXT instead of logos.

## Page layout
Seven sections on black: hero → "How It Works" statement over a streamed video with top/bottom black fades → alternating feature rows (copy one side, a glass-framed product GIF the other) → a 4-card "Why Us" glass grid with icon circles → a stats band (4 oversized serif-italic numbers in a glass card) floating over a DESATURATED background video → three glass testimonial cards → a final CTA + footer over one more streamed video. Every section repeats the same grammar: glass badge, serif-italic heading at leading-0.9, muted light body, glass-strong primary button with an arrow icon.

## Typography
- Display: Instrument Serif (Google Fonts, italic) — ALL headings italic, tracking tight, leading 0.8-0.9; also used for partner names and stat numbers
- Body: Barlow (Google Fonts, weights 300-600) — light-weight body at white/60-70
- The serif-italic-everywhere is the editorial voice; the sans stays small and quiet

## Color palette
- Background: black `#000000`
- Text: white `#ffffff`; body at 60-70% white
- Glass surface: `rgba(255,255,255,0.01-0.12)`; borders `rgba(255,255,255,0.25)`
- Hairline gradient borders: white 45-50% at edges fading to 0 mid-panel
- No accent color — light and glass do all the work

## Visual motifs
- **Liquid-glass panel system** (the signature) — one glass recipe at two strengths applied to every badge, card, nav, and button; gradient hairline borders via the mask-composite trick
- **Word-by-word blur dissolve headline** — each word rises and sharpens from a gaussian blur in sequence as it scrolls into view
- **Serif-italic everything** — headings, stat numbers, and even partner names in italic serif; logos replaced by typeset names
- **Streamed video sections with black fades** — four different background videos, each dissolving into the page through 200px black gradients
- **Desaturated video under stats** — the stats band runs its footage in black-and-white so the numbers stay loudest
- **Glass badge + heading grammar** — every section opens with a small glass pill label above its serif heading; relentless consistency
- **Floating glass navbar** — detached from the top edge, links in a glass capsule, solid white button docked at its end

## When to use
- Design, AI, and creative agencies selling premium work — the site demonstrates the craft
- Studios that want a luxury editorial feel without color experiments
- Brands with strong reel footage to run behind multiple sections
- Service businesses that close on a strategy call and need one clear booking CTA
- Pitching against template-built competitors; the glass system reads custom

## When to NOT use
- Budget engagements — four streamed videos plus custom text animation is real build weight
- Brands without footage; the page leans on video in four of seven sections
- Colorful, playful brands (use `glassmorphism-purple-pink-agency` for color-forward glass)
- Text-dense or SEO-content sites — this is a showcase, not a library

## Build complexity
MEDIUM complexity. The glass CSS is two reusable classes and the blur-text component is one IntersectionObserver wrapper, but four streamed-video sections need fallbacks and performance care.

## Library cross-references
- Motif: `liquid-glass-panel-system`
- Motif: `word-blur-dissolve-headline`
- Motif: `serif-italic-stat-numbers`
- Motif: `typeset-partner-names`
- Motif: `desaturated-video-stats-band`
- Motif: `glass-badge-section-grammar`
- Typography: `instrument-serif-italic-barlow`
- Color palette: `black-white-glass-monochrome`
