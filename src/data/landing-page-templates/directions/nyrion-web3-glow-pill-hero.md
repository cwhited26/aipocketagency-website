---
slug: nyrion-web3-glow-pill-hero
name: Nyrion — Web3 Gradient-Fade Hero
vibe: dark, web3, sleek, glowing, futuristic
industries: blockchain infrastructure, crypto, web3 startups, fintech, developer platforms, dao tooling, nft platforms, api products
source: motionsites.ai archive (catalog title "Web3 EOS Hero", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
last_used: never
last_client: never
---

## Hero treatment
A full-screen Web3 hero on pure black: looping background video under a 50% black overlay, with a centered content stack pushed down ~280px from the top. The headline is the signature — 56px medium weight with a gradient FILL applied to the text itself (`linear-gradient ~144.5deg`, solid white at ~28% fading to transparent at ~115%, via background-clip), so the bottom-right of the words dissolves into the dark. Above it, an announcement pill: 10% white background, 1px white/20 border, a 4px white dot, and split-opacity copy ("Early access available from" at 60% white, the date at full white).

The CTA construction repeats top and center: a layered pill with a hairline 0.6px solid white outer border, an inner pill (black-on-white in the nav, white-on-black in the hero), and a blurred white glow streak hugging the top edge of the button — a light-catch effect that reads as machined glass. The nav spreads wide with 120px side padding: wordmark left, four links each with a small chevron-down, glow pill right.

## Page layout
One viewport, vertically stacked with 40px gaps, everything centered. 102px bottom padding. Mobile collapses the nav links, drops the headline to 36px, and pulls top padding to 200px. No scroll sections — this is a launch/waitlist hero.

## Typography
- Display + body: Hanken Grotesk (substitute for the prompt's General Sans, Fontshare) — headline 56px desktop / 36px mobile, medium weight, line-height 1.28
- Nav links and buttons: 14px medium; badge 13px; subtitle 15px at 70% white, max-width 680px

## Color palette
- Background: pure black `#000000` with video at 50% black overlay
- Text: white `#ffffff`; subtitle `rgba(255,255,255,0.7)`; badge label at 60% white
- Headline gradient: white fading to transparent black across the glyphs
- Pills: white/10 fills, white/20 borders, hairline 0.6px white outlines

## Visual motifs
- **Gradient-dissolve headline** — the display text itself fades from solid white to transparent across a ~144deg angle, melting into the background video
- **Glow-streak pill buttons** — layered construction: 0.6px white outer ring, inner solid pill, and a blurred white gradient blob pinned to the button's top edge like a light reflection
- **Announcement dot badge** — a rounded pill with a 4px dot and two-tone copy announcing the access date
- **Chevron nav links** — every nav item carries a small white chevron-down, signaling depth without menus
- **Wide-margin navigation** — 120px horizontal nav padding pushes the chrome to the screen edges and leaves the center to the video
- **Video under half-black wash** — full-screen loop kept legible by a flat 50% overlay, no gradients

## When to use
- Blockchain, crypto, and web3 infrastructure launches
- Developer platforms and API products opening a waitlist
- Fintech brands that want the polished-dark-tech register
- Any product announcing a dated early-access window — the badge is built for it
- Teams with abstract motion footage (particles, networks, renders) to run behind the type

## When to NOT use
- Audiences skeptical of crypto aesthetics — the visual language is unmistakably web3
- Businesses that need explanation; one headline and one subtitle is all the copy there is
- Light-brand or warm consumer products (use `loopdesk-light-saas-video-fade`)
- Anyone without video; the gradient headline needs moving darkness behind it to land

## Build complexity
LOW — one screen, CSS-only effects; the layered button and text gradient are small reusable components.

## Library cross-references
- Motif: `gradient-dissolve-headline-text`
- Motif: `glow-streak-layered-pill-button`
- Motif: `announcement-dot-badge`
- Motif: `chevron-nav-links`
- Motif: `full-bleed-video-half-black-wash`
- Typography: `hanken-grotesk-medium-stack`
- Color palette: `pure-black-white-opacity-steps`
