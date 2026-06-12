---
slug: eonix-cinematic-typing-hero
name: Eonix — Cinematic Typing-Reveal Hero
vibe: cinematic, dark, premium, atmospheric, minimal
industries: ai platforms, tech brands, saas, innovation labs, product launches, hardware startups, media tech, agencies
source: motionsites.ai archive (catalog title "Nexora Automation — SaaS", free tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: starter
last_used: never
last_client: never
---

## Hero treatment
A full-screen cinematic hero on black: looping background video (with a JS `.play()` fallback for stubborn autoplay), centered content shifted up 50px from true center. The headline arrives character by character — each glyph fades in at a 45ms stagger (0.15s per character), words kept whole so wrapping stays natural — turning one sentence ("Innovation that reshapes the fabric of experience") into a 2.5-second reveal. Above it, an eyebrow line opens with a 1px horizontal dash then "THE FUTURE IS UNFOLDING" at 0.25-0.3em tracking. The subheading and buttons fade up on delays of 2.4s, 2.8s, and 3.0s, choreographed to land just as the typing finishes.

The primary button carries the signature `btn-glow` treatment: a near-black pill with a 1.5-2px white outline pulled inside the edge plus an inset white glow (`inset 0 0 14px rgba(255,255,255,0.7)`) — it reads as backlit glass. It pairs a "Begin Now" label with a circular bordered play icon on its right edge. The secondary "Watch the story" is a ghost pill: white/15 border, white/5 fill, backdrop blur. The nav drops in from -24px on a 0.6s ease, with a hexagon logomark that rotates 30deg on hover.

## Page layout
One viewport, fully centered column, max-width 4xl on the heading. Every element scales through five breakpoints (headline 1.75rem to 7xl); buttons stack vertically on mobile and sit in a row from sm up. All entrance animation is once-only via in-view triggers.

## Typography
- Display + body: Alegreya Sans (substitute for the prompt's Quire Sans Pro) — medium-weight headline, `tracking-tight`, line-height 1.15
- Eyebrow: 10-14px uppercase at 0.25-0.3em tracking, 60% white
- Subheading: light weight, 50% white, relaxed leading, max-width xl

## Color palette
- Background: pure black `#000000` under full-bleed video
- Primary button: slate-black `#020617` pill with white glow outline
- Text: white; eyebrow `rgba(255,255,255,0.6)`; subheading `rgba(255,255,255,0.5)`
- Ghost button: `rgba(255,255,255,0.05)` fill, 15% white border

## Visual motifs
- **Character-by-character headline reveal** — each letter fades in on a 45ms stagger; the sentence types itself onto the screen over the video
- **Backlit glow button** — an inset white glow plus a tight white outline on a near-black pill; the CTA looks lit from inside
- **Play-icon pill CTA** — the primary button ends in a circular bordered play glyph, promising a film
- **Hairline eyebrow lead-in** — a short 1px dash before widely-tracked uppercase eyebrow text
- **Choreographed entrance delays** — subhead and buttons fade up at 2.4-3.0s, timed to the typing finishing
- **Hover-rotating logomark** — the hexagon mark turns 30deg when the visitor touches the wordmark

## When to use
- AI and automation platforms that want a film-trailer first impression
- Product launches built around a brand video — the play button is the conversion
- Innovation labs and hardware startups with atmospheric footage
- SaaS brands wanting premium-dark without web3 styling
- Any one-message page where a slow, deliberate reveal fits the brand

## When to NOT use
- Visitors in a hurry — the headline takes ~2.5 seconds to finish and the CTAs land after 3
- Information-dense homepages; this holds one sentence and two buttons
- Accessibility-critical audiences sensitive to per-character animation (offer reduced-motion)
- Brands without video or with bright, friendly positioning (use `loopdesk-light-saas-video-fade`)

## Build complexity
LOW — the typing component and glow CSS are small and reusable; everything else is standard fade-up choreography.

## Library cross-references
- Motif: `character-stagger-typing-headline`
- Motif: `inset-white-glow-button`
- Motif: `play-icon-pill-cta`
- Motif: `hairline-dash-eyebrow`
- Motif: `entrance-delay-choreography`
- Typography: `alegreya-sans-cinematic`
- Color palette: `black-slate-white-glow`
