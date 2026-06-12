---
slug: backchannel-gesture-scrub-magenta
name: Backchannel — Gesture-Scrub Magenta Experience
vibe: maximal, magenta, gesture-driven, scrubbed, exclusive, techy
industries: creator communities, web3 collectives, automation agencies, membership clubs, design collectives, digital product studios, masterminds, premium newsletters
source: motionsites.ai archive (catalog title "Scroll Landing Page", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
last_used: never
last_client: never
---

## Hero treatment
A single-screen experience with NO native scrolling — body overflow is hidden and a wheel/touch gesture controller drives one `scrollProgress` number from 0 to 3.5; every animation on the page derives from that value (smoothed each frame with a 0.08 lerp). The first screen is shock-magenta `#FF005E` with a background video that doesn't play — it SCRUBS: each frame, the video's currentTime lerps toward `progress × duration`, so the visitor drags the footage forward and backward with the wheel. A GSAP mouse parallax floats the video ±40px against the cursor. The brand title ("BACKCHANNEL", Michroma at 10.4vw, pinned to the bottom edge) is split into characters; as progress climbs, the chars fall out of frame (300% y-offset plus 25vh, slight squash, 0.03s stagger) on a scrub-lagged timeline.

Past progress 0.75, three white pill tiles slide in from the left with clearing blur — membership hooks ("Private Discord & Networking", "Weekly Market Alpha Drops", "Exclusive Web3 Tooling Access"). Hovering one scales it 1.2 while its neighbors shift vertically out of the way. At progress 1.15 the SECOND SCREEN rises from the bottom like an iOS sheet: a near-black wine `#11010a` panel with a 48px rounded top and a white grab-handle pill, while the magenta screen behind blurs up to 64px.

Inside the sheet: a second scrubbed video, and the page's wildest device — a CYLINDRICAL TEXT DRUM. Thirty-two manifesto lines are mapped onto a virtual cylinder (radius 380px, 3D transforms with perspective): as progress runs 1.45 → 3.5 the drum rotates, the line at center reading full-size and full-opacity while lines above and below curve away, shrink, fade, and blur with depth. Key phrases in each line are highlighted bold-white against 60%-white body text. A masked logo marquee runs along the sheet's bottom edge.

## Page layout
Two stacked "screens" in one viewport, both addressed by the single progress value; a fixed header carries a logo + three-line tagline left and pill nav buttons right (nav clicks tween progress to section ratios over 1200ms easeInOutCubic). Mobile swaps the nav for a burger opening a full-screen overlay and quarters the tile slide distances. There is no second page — the drum IS the about/manifesto content.

## Typography
- Display: Michroma (Google Fonts) — the giant hero title and tile labels, uppercase, -0.07em tracking on the title
- Body: Manrope (Google Fonts, weights 300-800) — drum lines (18-32px semibold, -0.035em), nav, tagline
- Drum emphasis: highlighted phrases bold pure-white, the rest white at 60%

## Color palette
- First screen: hot magenta `#FF005E`
- Second screen: near-black wine `#11010a`
- Accents: raspberry `#ea1f63`, pink `#ec4899`, light pink `#ff5c93` (loaders, scrollbar)
- Text: white `#ffffff` and white at 60% for low-emphasis drum copy
- Tiles: solid white with black text

## Visual motifs
- **Wheel-scrubbed video** — the gesture controller maps wheel/touch input to video currentTime; visitors drag the footage through time instead of watching it
- **Falling-letters title** — the giant brand name splits into characters that drop out of frame with stagger and squash as the visitor advances
- **Rising sheet panel** — the second screen slides up like a mobile drawer, rounded top and grab handle included, while the first screen blurs to 64px behind it
- **Cylindrical text drum** — a 32-line manifesto wrapped around a 3D cylinder that rotates with progress; the centered line is sharp, the rest curve away and blur
- **Slide-in offer tiles** — three white pills enter from the left with clearing blur; hovering one scales it up and nudges its neighbors apart
- **Mouse-parallax footage** — both videos drift against the cursor for a constant floating feel
- **Highlight-phrase manifesto** — bold white key phrases punched into 60%-white running text

## When to use
- Invite-only creator or builder communities selling exclusivity
- Web3 collectives and alpha groups where the audience expects interaction-heavy craft
- Automation and digital-product studios using their own site as the portfolio piece
- Masterminds and paid memberships pitched on a manifesto, not a feature list
- Audiences on desktop who will play with a page rather than skim it

## When to NOT use
- Any conversion or information page — there is no native scroll, no sections to skim, and the content lives inside an animation
- Mobile-dominant or older audiences; gesture hijacking frustrates both
- Brands that can't carry hot magenta and an underground tone
- Accessibility-sensitive projects — scroll hijacking and scrubbed motion need careful reduced-motion fallbacks
- Tight budgets: this is a Custom Build conversation like `velar-luxury-real-estate`, not a template ship

## Build complexity
HIGH — a gesture controller, two rAF video scrubbers, GSAP split-text, a 3D text drum, and a rising blurred sheet all hang off one progress value; budget it as a custom interactive build.

## Library cross-references
- Motif: `wheel-scrubbed-video`
- Motif: `falling-letters-title-exit`
- Motif: `rising-sheet-second-screen`
- Motif: `cylindrical-text-drum`
- Motif: `slide-in-offer-tiles`
- Motif: `mouse-parallax-footage`
- Typography: `michroma-manrope-techno`
- Color palette: `hot-magenta-wine-black`
