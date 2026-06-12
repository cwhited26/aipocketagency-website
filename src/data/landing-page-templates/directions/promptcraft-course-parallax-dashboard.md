---
slug: promptcraft-course-parallax-dashboard
name: Promptcraft — Course Hero with Parallax Dashboard
vibe: dark, layered, playful, product-demo-led, ai-native
industries: online courses, design education, bootcamps, ai tools, saas with a visual product, creator education, no-code platforms, developer education
source: motionsites.ai archive (catalog title "DesignPro Academy", free tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: starter
last_used: never
last_client: never
---

## Hero treatment
A single full-screen hero built as a depth sandwich. Back to front: a full-bleed background video (`/placeholder-hero.mp4`, no overlay, z-0), a liquid-glass DASHBOARD MOCK of the product (z-10), the centered headline + CTA copy (z-20), a foreground grass/foliage PNG strip pinned past the bottom edge (z-30), and a fixed transparent navbar (z-50). Scroll drives the layers apart: the copy translates up to -60% and fully fades by 60% of scroll progress, the dashboard parallaxes up at -25%, and the grass drifts DOWN at +20% — three speeds, real depth.

The copy stack staggers in with a shared FadeUp (opacity 0 / y24 to settled, 0.6s, ease `[0.22,1,0.36,1]`, honoring reduced-motion): a small glass badge ("Founder member sale" style), a 38-64px tight-tracked question headline aimed at the visitor ("Are you a designer or builder who wants to stay ahead of AI?"), one supporting line, and a white pill CTA.

The dashboard mock is the proof. A liquid-glass frame (16:9 desktop) holds two columns: a working chat panel on the left — course-assistant header, three seeded messages in chat bubbles, a glass textarea that actually appends a message and a canned reply on Enter — and on the right a miniature landing page rendered INSIDE the dashboard, complete with its own pill nav, an Instrument Serif headline ("Built for the curious"), an email-capture pill, a "Manifesto" glass button, social buttons, and its own background video running a fade-out/fade-in loop with no visible jump (rAF opacity tween near the loop point). The product demo is a live little website inside the hero.

## Page layout
Navbar + hero only — this is a hero-section page, not a multi-section site. Nav is fixed and transparent, max-w-[1080px], with smooth-scroll anchor links and a glass "Get started" pill; mobile gets a right-side sheet. Every button label uses a text-swap hover: the label slides up 40px while a duplicate slides in from below (0.2s easeInOut).

## Typography
- Display + body: Inter (Google Fonts, weights 400-800) — headline at 38/52/64px across breakpoints, `tracking-[-0.03em]`
- Accent: Instrument Serif (Google Fonts) — only inside the embedded mini-site headline, signaling "this is a different, designed thing"
- Google Material Symbols for UI icons throughout the dashboard

## Color palette
- Background: near-black violet `#08020e`
- Text: white `#ffffff`, with secondary copy at `rgba(255,255,255,0.8)` and muted at 60%
- Glass surfaces: `rgba(255,255,255,0.10)` fills with `rgba(255,255,255,0.10)` borders
- Primary CTA: white pill at 80% opacity, solid white on hover, black label
- Chat panel: `rgba(8,8,10,0.6)` with `blur(24px)`

## Visual motifs
- **Three-speed parallax sandwich** (the signature) — copy rises and fades at -60%, dashboard at -25%, foreground foliage sinks at +20%; the layers separate as you scroll
- **Foreground foliage strip** — a grass PNG overlapping the bottom edge IN FRONT of the dashboard, grounding the floating UI in a scene
- **Live dashboard mock** — a glass-framed two-column product demo with a chat panel that actually responds and a mini landing page with its own nav, video, and email capture
- **Website-within-the-website** — the right panel is a complete miniature landing page, serif headline and all; the product is shown by being used
- **Text-swap button hover** — every label slides up and is replaced from below on hover, on nav links and CTAs alike
- **Liquid-glass framing** — 1% white fill, luminosity blend, 4px blur, masked gradient border on the dashboard shell, badges, and pills
- **Staggered fade-up copy** — badge, headline, support line, CTA arrive 0.1s apart on one easing curve

## When to use
- Courses and bootcamps teaching design, AI, or web skills — the dashboard mock IS the curriculum preview
- AI tools and no-code platforms whose product is visual enough to demo in a frame
- Creator-led education brands selling one flagship offer with one CTA
- SaaS that wants a product screenshot section collapsed into the hero itself
- Founder-led launches running a single early-bird offer

## When to NOT use
- Businesses with no product UI to show — an empty dashboard frame kills the page
- Multi-offer sites; the layout is built around one course, one button
- Conversion pages for cold traffic that need pricing, curriculum, and FAQ sections — this is a hero-only layout
- Conservative B2B buyers — the grass-in-front-of-the-UI playfulness sets a casual tone

## Build complexity
MEDIUM — the parallax is three transforms on one scroll value, but the dashboard mock is a real interactive component (working chat, nested video fade loop, embedded mini-site) that needs careful assembly.

## Library cross-references
- Motif: `three-speed-parallax-sandwich`
- Motif: `foreground-foliage-strip`
- Motif: `live-dashboard-mock`
- Motif: `website-within-the-website`
- Motif: `text-swap-button-hover`
- Motif: `fade-loop-background-video`
- Typography: `inter-instrument-serif-accent`
- Color palette: `violet-black-white-glass`
