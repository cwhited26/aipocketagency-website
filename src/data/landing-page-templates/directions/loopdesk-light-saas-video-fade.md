---
slug: loopdesk-light-saas-video-fade
name: Loopdesk — Light SaaS Hero with Video-to-White Fade
vibe: light, airy, editorial, polished, saas
industries: hr software, team management saas, remote work platforms, productivity tools, scheduling software, onboarding tools, b2b saas, project management
source: motionsites.ai archive (catalog title "HR SaaS Hero", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
last_used: never
last_client: never
---

## Hero treatment
A light-mode SaaS hero where the background video dissolves into the page. The video is flipped vertically (`transform: scaleY(-1)`, object-cover) and covered by a white gradient running from fully transparent at ~26% down to solid white at ~67% — so motion lives at the top of the viewport and melts into a clean white page below. The content sits in a 1200px column with a heavy, deliberate 290px top padding: an 80px Geist medium headline ("Simple management for your remote team") where one word — "management" — jumps to 100px Instrument Serif italic, breaking the grid on purpose.

Below the headline: an 18px slate description at 80% opacity (max-width 554px), then the conversion piece — a rounded 40px email-capture bar (`#fcfcfc` background, thin border, soft wide shadow `0 10px 40px 5px rgba(194,194,194,0.25)`) holding a dark gradient "Create Free Account" button with layered inset shadows (`inset -4px -6px 25px rgba(201,201,201,0.08), inset 4px 4px 10px rgba(29,29,29,0.24)`) for a glossy, pressed-glass feel. A "1,020+ Reviews" badge with a row of star/brand icons anchors the social proof. Heading, description, and input block stagger in with a fade-and-slide-up entrance.

## Page layout
One min-h-screen hero section, centered column, 32px vertical gaps between elements. The 290px top padding is load-bearing — it creates the editorial white space that separates this from a default centered hero. Scales down cleanly: the headline drops with viewport width and the email bar goes full-width on mobile.

## Typography
- Display: Geist (Google Fonts) — medium weight, 80px desktop, `tracking -0.04em`
- Accent: Instrument Serif (Google Fonts, italic) — the single oversized keyword at 100px inside the headline
- Body: Geist, 18px at 80% opacity for the description

## Color palette
- Page: white `#ffffff`, with the video fading into it
- Text: slate `#373a46` (description at 80% opacity)
- Input bar: `#fcfcfc` with a hairline border and `rgba(194,194,194,0.25)` shadow
- CTA: near-black multi-layer gradient with dual inset shadows for gloss

## Visual motifs
- **Video melting into white** — a flipped background video under a transparent-to-white gradient; motion at the top, clean page below, no hard edge anywhere
- **One italic serif word inside a sans headline** — the keyword jumps to a larger italic serif face, 100px against 80px Geist
- **Email bar as the hero CTA** — a single rounded capture bar with input + button replaces the usual button pair; the ask is one field
- **Glossy inset-shadow button** — layered inner shadows give the dark CTA a tactile, lacquered finish
- **Review-count badge** — a small star-row plus "1,020+ Reviews" directly under the capture bar
- **Heavy editorial top padding** — 290px of air above the headline; the restraint reads as confidence

## When to use
- HR, team management, and remote-work SaaS — the copy frame is built for it
- Any B2B tool whose first conversion is an email signup or free account
- Productivity and scheduling products that want calm and trustworthy over flashy
- Brands with abstract or ambient motion footage that works upside-down and half-faded
- Light-brand companies where every competitor went dark mode

## When to NOT use
- Dark-brand or edgy products — this is resolutely soft and light (use `noctix-dark-video-waitlist` for the dark teaser version)
- Businesses where the phone call is the conversion, not an email field
- Anyone without usable motion footage; a static image under the white fade loses the effect
- Content-heavy marketing sites — this is one hero section, not a full page system

## Build complexity
LOW — one section, standard entrance animation; the gradient fade and inset-shadow button are pure CSS.

## Library cross-references
- Motif: `video-fade-to-white-gradient`
- Motif: `italic-serif-keyword-in-sans-headline`
- Motif: `email-capture-bar-hero-cta`
- Motif: `glossy-inset-shadow-button`
- Motif: `review-count-star-badge`
- Motif: `heavy-editorial-top-padding`
- Typography: `geist-instrument-serif-mix`
- Color palette: `white-slate-soft-shadow`
