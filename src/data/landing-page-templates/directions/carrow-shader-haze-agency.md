---
slug: carrow-shader-haze-agency
name: Carrow Studio — Shader-Haze Agency / Orange Accent
vibe: light, polished, animated-texture, agency-grade, orange-led
industries: design agencies, branding studios, digital product studios, marketing agencies, web studios, creative consultancies, motion studios, b2b creative services
source: motionsites.ai archive (catalog title "Creative Agency (best guess, not confidently identified)", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
last_used: never
last_client: never
---

## Hero treatment
A pale gray full-viewport hero whose entire background is a living shader composition: a soft white swirl, a chroma-flow layer pushing warm orange (`#ff5f03`) in from the edges with momentum, a fluted-glass refraction pass (ribbed-glass distortion with chromatic aberration at a 31° angle), and a film-grain finish at 5% strength. The effect reads as light moving behind reeded glass — texture without imagery. Hero content anchors to the BOTTOM of the viewport: a small studio label, then a three-line headline at clamp up to 4.2rem ("We craft digital experiences / for brands ready to dominate / their category online."), then a CTA row — an orange pill button and a white "Certified Partner" badge with a starburst mark and a small dark "Featured" tag.

The micro-interactions carry the agency polish: every button label is duplicated in a clipped column and ROLLS vertically on hover (translate -50% over 500ms), while the arrow inside its white circle rotates from -45° to 0°. The nav is a white pill bar holding a dark circle monogram, four links, a "Taking on projects for Q1" availability note, a LIVE LONDON CLOCK updating every second, and the rolling-label CTA. Mobile gets a bottom-sheet menu that slides up with an iOS-style spring curve.

## Page layout
Three sections, max width 1440px. Section 2 (white): a numbered-circle badge ("1 — Introducing Carrow"), a two-line heading, then an asymmetric desktop grid — small photo bottom-left (26%), nowrap paragraph and orange button center, large 3:2 photo right (48%) — that stacks cleanly on mobile. Section 3 (light gray `#F5F5F5`): badge "2 — Featured client work", an oversize "Our projects" heading, and a two-column case-study grid of autoplaying video cards; hovering a card expands a small circle button into a labeled pill ("Learn more" / "View case study") while its icon un-rotates. Descriptions and titles sit under each card in quiet gray.

## Typography
- Display + body: system UI sans in the prompt — Inter (Google Fonts) is the honest substitute; font-medium headlines at tracking `-0.03em`, leading 1.08
- UI runs small and tight: 13–14px labels, 13px buttons; scale contrast comes from the clamp-sized headings

## Color palette
- Hero base: pale gray `#EFEFEF`; section alternates white and `#F5F5F5`
- Shader bloom: orange `#ff5f03`
- Primary buttons: orange `#F26522`, hover `#e05a1a`
- Ink: gray-900 `#111827`-range neutrals; secondary text gray-600
- Partner badge mark: terracotta `#E8704E`

## Visual motifs
- **Animated frosted-shader backdrop** (the signature) — swirl + edge-fed orange bloom + ribbed-glass refraction + film grain, all in motion behind the hero
- **Rolling-label buttons** — hover slides the label up and an identical copy in from below; the arrow circle un-rotates 45°
- **Live London clock in the nav** — real time plus an availability note ("Taking on projects for Q1"), signaling a working studio
- **Numbered section badges** — dark numbered circle + outlined pill label opening each section
- **Expanding circle case-study buttons** — a 36px circle grows into a labeled pill on card hover
- **Autoplay video work cards** — case studies as looping film tiles, not static thumbnails
- **Certified-partner proof badge** — white pill with starburst mark and a tiny dark "Featured" tag next to the main CTA

## When to use
- Design, branding, and digital product agencies that want premium texture without dark-mode drama
- Studios with strong motion work — the video case cards do the selling
- Creative consultancies pitching enterprise clients who distrust flashiness but notice polish
- Any agency whose accent color can carry the page (swap the orange, keep the haze)
- Portfolio refreshes where micro-interaction quality IS the portfolio

## When to NOT use
- Brands needing instant load on weak devices — the shader stack is GPU work; budget a static-gradient fallback
- Trades and local services; agency polish reads as expensive overhead there (use `contractor-photo-first-trust`)
- Dark, edgy creative collectives (use `vanguard-fierce-creative-collective`)
- Teams without case-study video; static screenshots flatten section 3

## Build complexity
MEDIUM complexity. The shader background is a dependency (`shaders` package) configured rather than written, but hover-roll buttons, the live clock, the bottom-sheet menu, and the expanding card buttons add up to a detail-heavy two-day build.

## Library cross-references
- Motif: `animated-shader-haze-backdrop`
- Motif: `rolling-label-hover-buttons`
- Motif: `live-clock-availability-nav`
- Motif: `numbered-section-badges`
- Motif: `expanding-circle-card-button`
- Motif: `autoplay-video-work-cards`
- Typography: `inter-tight-agency-medium`
- Color palette: `pale-gray-orange-bloom`
