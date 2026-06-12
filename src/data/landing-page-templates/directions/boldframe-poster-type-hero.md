---
slug: boldframe-poster-type-hero
name: Boldframe — Poster-Type Hero with Shaped CTA
vibe: bold, loud, poster, kinetic, declarative
industries: design studios, creative agencies, marketing firms, event brands, media production, streetwear, music labels, launch campaigns
source: motionsites.ai archive (catalog title "New Era Bold Hero", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
last_used: never
last_client: never
---

## Hero treatment
A poster, not a webpage: a full-screen background video over a deep navy fallback (`#21346e`), with a three-line all-caps Rubik headline stacked top-left of the content column — "NEW ERA" / "OF DESIGN" / "STARTS NOW" — at 100px on desktop (text-6xl mobile, text-8xl tablet), crushed to `line-height 0.98` with -2px to -4px letter-spacing so the lines lock into a single typographic block. Content is top-aligned, not centered: heavy top padding (pt-32 mobile / pt-48 desktop) drops the block into the upper third and lets the video own the rest.

The single CTA is the detail that sells the direction: a fixed 184x65px button whose background is not a CSS rectangle but an SVG path filled white — a custom shape (slanted or notched edges) that reads as a sticker slapped on the poster. The label "GET STARTED" sits centered in 20px Rubik bold uppercase, dark `#161a20`. Hover scales to 1.05, press compresses to 0.95.

## Page layout
One viewport, one statement, one button. A standard container with horizontal padding holds the headline and CTA; everything else is video. Responsive behavior is pure type-scale: the three lines never rewrap, they just shrink.

## Typography
- Display + body: Rubik (Google Fonts) — bold uppercase headline, three stacked lines, `line-height 0.98`, letter-spacing -2px to -4px
- Headline sizes: text-6xl mobile, text-8xl tablet, 100px desktop
- CTA label: Rubik bold uppercase 20px

## Color palette
- Fallback background: deep navy `#21346e` (shows before the video loads and behind any letterboxing)
- Headline: solid white `#ffffff`
- CTA: white SVG shape with near-black `#161a20` label
- No other colors — the video supplies everything else

## Visual motifs
- **Three-line stacked headline block** — all-caps lines crushed together with sub-1.0 line-height and negative tracking, reading as one poster lockup
- **SVG-shaped button** — the CTA background is a custom white SVG path, not a rounded rectangle; the irregular shape is the brand moment
- **Top-aligned composition** — content pinned to the upper third with heavy top padding, leaving the lower two-thirds to the motion
- **Scale-press interaction** — hover grows the button 5%, click compresses it 5%; tactile without any other animation
- **Navy fallback under video** — a deliberate brand color behind the video instead of default black

## When to use
- Design studios and agencies announcing themselves or a rebrand
- Campaign and event launch pages where one line of copy is the whole message
- Media, music, and streetwear brands that want poster energy
- Any page whose video footage is strong enough to be the entire argument
- Brands that want maximum impact from a one-day build

## When to NOT use
- Anyone needing features, pricing, or proof on screen — there is room for one sentence
- Conservative B2B and professional services; the shout is the wrong register (use `targo-logistics-dark-red-clipped`)
- Brands without video; on a still image this is just big text
- Sites that need navigation — this layout has no nav at all

## Build complexity
LOW — one section, one custom SVG shape, two CSS transforms; the craft is in the headline lockup and the button path.

## Library cross-references
- Motif: `stacked-allcaps-headline-block`
- Motif: `svg-shaped-cta-button`
- Motif: `top-aligned-poster-composition`
- Motif: `scale-press-button-interaction`
- Typography: `rubik-bold-uppercase-tight`
- Color palette: `navy-white-video-led`
