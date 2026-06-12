---
slug: nyxen-dark-ai-poetic-monospace
name: Nyxen — AI Platform / Poetic Monospace Waitlist
vibe: dark, cinematic, poetic, pre-launch, minimal
industries: ai platforms, cybersecurity, defense tech, deep tech startups, ml infrastructure, stealth startups, research labs, enterprise ai
source: motionsites.ai archive (catalog title "Cybersecurity Hero v2", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
last_used: never
last_client: never
---

## Hero treatment
A dark, cinematic single-viewport hero for a pre-launch AI platform. Full-screen looping video on black; content sits BOTTOM-LEFT, not centered. The headline is two lines of near-poetry ("When strategy meets its spark / and thought reshapes what lies ahead") at a deliberately modest `clamp(1.75rem, 5vw, 2.6rem)`, font-normal, tight tracking — it reads like a film title card, not a sales pitch. Under it, the signature: the subtext switches to MONOSPACE (Courier) at 60% white — two more lines of abstract copy that read like terminal output from something thinking. One white pill CTA ("See it in motion") with an arrow that nudges right on hover.

The desktop nav links live inside a liquid-glass pill: near-transparent white with luminosity blend, 4px backdrop blur, an inset top highlight, and a gradient border stroke drawn by a mask-composite `::before`. Links include capability words ("Platform", "AI Defense", "Insights") and the nav CTA is "Join the wait" — this direction is built for waitlist-stage products.

## Page layout
One viewport. Lowercase wordmark top-left, glass nav pill center, white CTA right. On mobile the nav collapses to an animated hamburger (menu/X swap with rotation and scale on a `cubic-bezier(0.23,1,0.32,1)` curve); the menu is a slide-down panel from `rgba(8,8,8,0.97)` animating max-height 0 to 420px over 0.5s, links staggering in 50ms apart with arrow icons that appear on hover, a full-width white CTA at the bottom, blurred black backdrop behind it, Escape key closes it.

## Typography
- Display + body: Inter (Google Fonts, 400-700) — headline font-normal, lowercase wordmark at text-xl font-semibold
- Subtext: Courier monospace at text-sm/base, `rgba(255,255,255,0.6)`, slight positive letter-spacing — the machine-voice counterpoint to the human headline

## Color palette
- Background: pure black `#000000` behind the video
- Text: white; monospace subtext at 60% white
- CTA: solid white `#ffffff` pill with black text, hover at 80% opacity
- Mobile panel: `rgba(8,8,8,0.97)` with a `rgba(255,255,255,0.08)` hairline bottom border

## Visual motifs
- **Poetic title-card headline** — two abstract lines at restrained scale, bottom-left, reading as cinema rather than marketing
- **Monospace machine subtext** — supporting copy in Courier at 60% white, the typographic cue for "an intelligence speaks here"
- **Liquid-glass nav pill** — desktop links wrapped in a frosted capsule with a gradient border stroke built from mask-composite
- **Bottom-left composition** — all content pinned to the lower-left corner, leaving the video frame open
- **Waitlist-first CTAs** — "Join the wait" in the nav, one demo-style button in the hero; no pricing, no signup form
- **Choreographed slide-down menu** — mobile panel animating max-height on a sharp easing curve with staggered link entrances and Escape-to-close

## When to use
- Pre-launch AI, security, or deep-tech products collecting a waitlist
- Stealth-ish startups that want intrigue ahead of explanation
- Defense, threat-intel, or research brands with moody footage
- Products whose demo video says more than any feature list would
- Founders who want one page live tonight that still feels expensive

## When to NOT use
- Post-launch products that need features, proof, and pricing on the page
- Brands without dark, atmospheric footage — the restraint depends on the film
- Audiences that distrust vagueness (procurement, regulated industries); the abstract copy gives them nothing to evaluate
- Lead-gen for services — there is no form, only a waitlist button (use `bookedup-deep-shadow-saas` for a converting SaaS page)

## Build complexity
LOW complexity. One viewport, one glass recipe, one animated mobile panel. The craft is in copy restraint, not code.

## Library cross-references
- Motif: `poetic-title-card-headline`
- Motif: `monospace-machine-subtext`
- Motif: `liquid-glass-pills-gradient-stroke`
- Motif: `bottom-left-composition`
- Motif: `slide-down-mobile-panel`
- Typography: `inter-courier-human-machine`
- Color palette: `pure-black-white-60pct`
