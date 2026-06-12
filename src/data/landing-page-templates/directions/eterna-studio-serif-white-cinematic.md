---
slug: eterna-studio-serif-white-cinematic
name: Eterna Studio — White Serif Cinematic Hero
vibe: light, serif, cinematic, contemplative, minimal
industries: design studios, branding agencies, creative consultancies, architecture firms, wellness brands, publishers, photography studios, boutique software studios
source: motionsites.ai archive (catalog title "Aethera Studio — Hero Section", free tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: starter
last_used: never
last_client: never
---

## Hero treatment
A white-page cinematic hero where the video does NOT fill the viewport — it sits LOW in the frame (pushed down ~300px, anchored to the bottom) with a white-to-transparent-to-white vertical gradient over it, so the footage emerges out of the page like a horizon. Above it, centered serif type: the headline "Beyond silence, we build the eternal." at `text-5xl` → `text-8xl` in Instrument Serif, line-height 0.95, letter-spacing -2.46px, with the emphasized words ("silence," and "the eternal.") set in gray `#6F6F6F` italic against the black main text. A muted description paragraph and a black rounded-full CTA ("Begin Journey", generous `px-14 py-5` padding, hover scale 1.03) follow. Headline, description, and button enter on a fade-rise ladder (opacity 0 + 20px rise, 0.8s ease-out, 0/0.2s/0.4s delays).

The video loops MANUALLY with fades: a requestAnimationFrame loop watches currentTime against duration, fades opacity in over the first 0.5s, fades out over the last 0.5s, then on end resets to zero after a 100ms beat and plays again — a smooth dissolve loop instead of the usual hard jump.

## Page layout
Single hero viewport, max-width 7xl, `px-8 py-6` nav. Nav: serif wordmark with a superscript registered mark ("Eterna®") left, five small links (active in black, the rest gray), and a black rounded-full "Begin Journey" pill right. Everything centered, generous bottom padding so the low-set video has room.

## Typography
- Display: Instrument Serif (Google Fonts) — wordmark and headline, normal weight, tight negative tracking, italic for the gray emphasized words
- Body: Inter (Google Fonts) — nav links and description in gray `#6F6F6F`
- Headline mixes black and gray words in one sentence — the two-tone serif sentence is the identity

## Color palette
- Background: white `#FFFFFF`
- Headline, wordmark, buttons: black `#000000`
- Emphasized words, descriptions, inactive nav: gray `#6F6F6F`
- Button text: white `#FFFFFF`
- No other color — the video supplies all the warmth

## Visual motifs
- **Two-tone serif headline** (the signature) — one serif sentence with the poetic words flipped to gray italic; hierarchy through color inside a single line
- **Low-horizon video** — footage anchored to the bottom of the viewport with white gradients bleeding over its top and bottom edges, like a scene appearing below the copy
- **Dissolve video loop** — the clip fades out, resets, and fades back in instead of hard-looping; built with a requestAnimationFrame watcher
- **Fade-rise entrance ladder** — headline, paragraph, button rise 20px into place at 0.2s intervals
- **Registered-mark wordmark** — the serif logo carries a superscript ® for an established-house feel
- **Oversized rounded CTA** — one black pill with wide padding; the only solid element on the page

## When to use
- Studios and agencies selling taste: branding, design, architecture, photography
- Wellness and lifestyle brands that want quiet over loud
- Publishers and writers with an editorial sensibility
- Brands with one strong cinematic clip and a single sentence worth reading slowly
- Anyone whose competitors are all shipping dark-mode sites — the white page stands out

## When to NOT use
- Conversion-heavy landing pages — there is one CTA and no urgency anywhere
- Brands without an evocative one-liner; the headline carries the entire page
- Industrial, trades, or price-led services — the contemplative tone reads wrong
- Dark-footage brands; the white gradients need bright or neutral video to blend

## Build complexity
LOW complexity. One viewport, three CSS keyframe animations, and one requestAnimationFrame fade-loop component. A focused half-day build.

## Library cross-references
- Motif: `two-tone-serif-headline`
- Motif: `low-horizon-video-gradient`
- Motif: `dissolve-video-loop`
- Motif: `fade-rise-entrance-ladder`
- Typography: `instrument-serif-inter-light-page`
- Color palette: `white-black-gray-cinematic`
