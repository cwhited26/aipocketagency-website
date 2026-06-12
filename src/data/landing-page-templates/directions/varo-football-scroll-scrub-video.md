---
slug: varo-football-scroll-scrub-video
name: VARO — Football Organization / Scroll-Scrubbed Video
vibe: dark, cinematic, athletic, mono-detailed, scroll-driven
industries: sports organizations, athletic clubs, training academies, stadiums and venues, fitness brands, esports teams, sports tech, event series
source: motionsites.ai archive (catalog title "Scroll Landing Page", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
last_used: never
last_client: never
---

## Hero treatment
The page's engine is a fixed full-screen background video whose playhead is OWNED BY THE SCROLLBAR. The video never autoplays — scroll position maps to `video.currentTime` (scroll fraction 0 at page top, 1 when the footer nears the viewport), so the visitor literally scrubs a cinematic sequence by reading the page. The critical implementation detail: every scroll handler checks `video.seeking` and skips the frame if a seek is still in flight — without that guard, competing `currentTime` writes cause tearing and dropped frames. A black loading screen (tiny mono "LOADING" + pulsing 1px progress bar) holds until `canplaythrough` fires.

The hero itself is a 12-column grid over the video: a clamp-sized headline (2.5-5rem) bottom-left ("Championing / The Pitch Of Legends"), a right-aligned description paragraph at 64% white with one bold white sentence, and a two-part CTA bottom-right — a frosted text block ("EXPLORE OUR STADIUMS" in 12px mono) plus a separate arrow tile with a 1px gap between them; on hover both flip to solid white and the arrow flies out right while a clone flies in from the left. The fixed header (logo left, frosted mono nav right with a white "BUY MATCH PASS" block) slides up and off between 500-800px of scroll.

## Page layout
Three content screens float over the fixed video on a 90%-width container, separated by 200px spacers that give the scrub room to breathe. Screen two is a GSAP word-by-word scroll reveal — a clamp 2-4rem statement whose words fade from 10% opacity and 4px blur to sharp with a 0.05 stagger while the whole block un-rotates from 3 degrees — followed by a three-column grid (wireframe globe + logo + mono tagline, then two heading-paragraph columns). Screen three is the footer: a big glass card (`#1A1A1A` at 60%, 80px blur, 1px white/10 border) holding a "Ready To Score / Your Winning Season?" CTA row, an auto-fit link grid (Company / Services / Connect), and a mono copyright bar. Everything reveals with an ease-out-expo fade-up.

## Typography
- Display + body: Manrope (Google Fonts, weights 300-700) — clamp-sized medium-weight headlines, 64%-white body
- Mono detail: JetBrains Mono (Google Fonts, 400-700) — every label, nav link, button, and copyright line at 10-12px with tight tracking; the mono layer gives the page its technical, broadcast-graphics feel

## Color palette
- Base: pure black `#000000`
- Glass surfaces: `#1A1A1A` at 40-60% opacity, 80px backdrop blur, `rgba(255,255,255,0.1)` borders
- Text: white stepped at 100/64/60/40/25% opacity
- Buttons: white/8 frosted flipping to solid white with black text on hover
- No accent color — contrast and motion do the work

## Visual motifs
- **Scroll-scrubbed video playhead** (the signature) — page scroll drives `video.currentTime` over the full clip, with a `video.seeking` guard for tear-free frames
- **Two-part split CTA** — text block and arrow tile as separate frosted pieces with a 1px gap, both flipping white on hover
- **Fly-out / fly-in icon swap** — on hover the arrow exits one side while a duplicate enters from the other; nav links do the same vertically
- **Word-by-word scroll reveal** — GSAP-staggered words clearing from low opacity and blur as the block un-rotates from 3 degrees
- **Header that leaves** — the fixed nav slides up and out once the visitor commits to scrolling, returning the frame to the footage
- **Mono detail layer** — all small text in 10-12px JetBrains Mono, reading like stadium broadcast graphics
- **Glass footer card** — the whole footer in one big blurred dark pane: CTA row, link grid, copyright bar
- **Loading gate** — a black screen with mono label and pulsing hairline bar until the video can play through

## When to use
- Sports clubs, academies, and stadium or venue brands with cinematic footage
- Fitness and athletic-performance brands selling intensity
- Esports teams and event series wanting a broadcast-quality page
- Launch or campaign pages where one hero film tells the whole story
- Brands willing to let footage lead and keep copy to three screens

## When to NOT use
- Anyone without a single strong continuous video clip — the scrub IS the site
- Content-heavy sites; the fixed-video architecture fights long pages
- Mobile-dominant audiences on weak connections — full-video scrubbing is bandwidth- and decode-heavy
- Conversion-form-first businesses (use `northform-agency-contact-video-card`)
- Light, friendly consumer brands; this direction is dark and intense by design

## Build complexity
HIGH. Scroll-to-currentTime scrubbing with the seeking guard, the GSAP word reveal, the fly-in/out hover system, and the loading gate are each real engineering; together they need careful testing across browsers and devices.

## Library cross-references
- Motif: `scroll-scrubbed-video-playhead`
- Motif: `two-part-split-cta`
- Motif: `fly-out-fly-in-icon-swap`
- Motif: `word-by-word-scroll-reveal`
- Motif: `header-slides-away-on-scroll`
- Motif: `glass-footer-card`
- Motif: `video-loading-gate`
- Typography: `manrope-jetbrains-mono-broadcast`
- Color palette: `pure-black-white-opacity-ladder`
