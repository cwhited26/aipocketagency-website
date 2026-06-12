---
slug: solar-energy-day-night-toggle
name: Solar Energy — Day/Night Toggle Hero
vibe: photorealistic, premium-residential, energy-tech, demo-as-design, value-prop-as-interaction
industries: solar energy, residential energy storage, smart home tech, HVAC with smart-home tie-in, sustainability brands, energy efficiency consulting, EV chargers (residential), water filtration (whole-home), home automation, premium home services with a year-round value angle
source: motionsites.ai (Solar Energy Hero — verified Jun 11 2026 by direct observation of the live preview, NOT extracted from prompt text)
last_used: never
last_client: never
---

## Hero treatment
A single photorealistic photo of a beautiful modern house (with solar panels visible on the roof) anchored at the bottom-center of the viewport. A confident two-line value-prop headline reads "$0 Electricity Bills / for the next 7 years" with the dollar figure and the timeframe both emphasized at display scale. Below the headline, anchored to the photo itself, sit TWO TOGGLE PILLS labeled **Morning** and **Night** — each with a "$0 for Electricity" sub-label. Below the pills, a single supporting line: "Forget the energy market, weather conditions and seasons; our Smart Controller guarantees you get no electricity bill for seven years."

**The signature mechanic — toggle the time of day on the same photo.** When the visitor clicks (or hovers) Morning, the house photo crossfades to its morning version (golden warm light, soft sky). Click Night and it crossfades to the night version (dark sky, warm interior lights glowing through the windows, deep blue / black atmospheric tone). The SAME house, same composition, same headline — just lit differently. The toggle BECOMES the demo of the product: the solar system works in BOTH states.

The interaction isn't decorative — it's the value prop made visual. The visitor SEES that this works at night without needing to read about batteries or storage.

## Page layout
Single full-viewport hero designed around the toggle interaction. The photo + toggle + value prop are the whole composition — no portfolio, no testimonials, no second section above the fold. The visitor's first move IS the demo.

A small "reposit" brand wordmark + top nav sit in the corners but don't compete with the hero photo.

## Typography
- Display: a clean modern sans (Inter or similar — restrained, not editorial)
- Headline weight: SEMI-BOLD, not display-bold (the photo carries the visual weight; the headline supports)
- Number emphasis (`$0`, `7 years`) gets the heaviest weight + slightly larger size
- Body / pill labels: light, low-emphasis — they're functional UI, not decorative

## Color palette
- Background: photographic (whichever time-of-day is currently shown)
- Headline text on photo: white with subtle drop-shadow for legibility
- Toggle pill ACTIVE state: solid warm cream (`#F5E9CC` or similar warm white) with dark text
- Toggle pill INACTIVE state: translucent white with white text + thin border
- The palette IS the photo — the toggle changes the entire scene, including the mood color

## Visual motifs
- **Day/Night toggle as inline hero UI** — two pills directly on the hero photo, the visitor's first interaction
- **Crossfade between time-of-day states** on the SAME composition — `opacity` cross-fade between two pre-rendered photo files (`/hero-morning.webp`, `/hero-night.webp`), or a CSS variable swap with `transition: opacity 0.6s`. Don't animate filter / hue-rotate — pre-rendered photos read MUCH cleaner.
- **Photorealistic hero photo, NOT illustration** — the entire direction depends on the photo being convincing. Stock house illustration kills the impression.
- **Bottom-anchored composition** — the house sits at the BOTTOM of the viewport, with the sky/atmosphere taking the top half. Different from most hero treatments where the photo is centered.
- **Value-prop as the headline** with NUMBERS doing the visual lifting (`$0`, `7 years`) — not "save money on bills" but "$0 electricity bills"
- **Same-headline rule** — the headline DOES NOT change when the toggle flips. The point is the value prop is universal; the photo just shows you it works around the clock.

## When to use
- **Residential solar / energy storage brands** — the original use case
- **Smart home tech** with a "works while you sleep" pitch (security, HVAC with smart-home, water filtration whole-home, EV chargers)
- **Sustainability / energy efficiency consulting**
- **Premium residential services** with a year-round / all-conditions value angle (gutters with leaf guards, irrigation, generator install)
- **Demo-led product categories** where the visitor needs to SEE the product in action, not read about it
- **Brands selling to homeowners over 40** — the photorealistic house + clear value prop reads as trustworthy, not gimmicky

## When to NOT use
- **Anyone whose product doesn't have a day/night (or hot/cold, indoor/outdoor, before/after) demonstrable state** — the toggle is a value prop made visual. If your product doesn't have two states to show, the toggle is decorative and the whole direction collapses
- **B2B SaaS** — wrong audience entirely
- **Local trades where the call IS the conversion** — too slow, too clever
- **Anyone without photorealistic house photography** — stock illustration kills it
- **Anyone whose value prop is COMPLEX and needs a paragraph to explain** — this direction works ONLY for value props that can be made visual in a single side-by-side toggle

## Build complexity
LOW-MEDIUM complexity. The toggle + crossfade is straightforward (two photos, opacity transition). The expense is the PHOTOGRAPHY — getting matching shots of the same house at morning + night requires either a real photoshoot or AI-generated photo pairs that maintain composition consistency.

## Adapting the mechanic to other products

The "two states demonstrated by a toggle that visually proves the value prop" mechanic generalizes to:

- **Smart HVAC** — Summer / Winter toggle showing the same room at different seasons with the unit handling both
- **Whole-home water filtration** — Before / After toggle showing the same glass of water
- **Generator install** — Storm / Clear toggle showing the same house in both conditions, both with power on
- **EV charger** — Day / Night toggle showing the car charged regardless of time
- **Leaf guards / gutter protection** — Fall / Winter toggle showing the same gutter clear in both seasons
- **Lawn / irrigation** — Drought / Wet toggle showing the same lawn green in both
- **Security system** — Empty / Occupied toggle showing the same home protected in both states

The mechanic is REUSABLE for any product whose value prop is "works in all conditions" or "demonstrates a binary improvement."

## Library cross-references
- Motif: `time-of-day-toggle-crossfade` (the signature)
- Motif: `value-prop-as-headline-with-numbers`
- Motif: `inline-hero-ui-toggle-pills`
- Motif: `photorealistic-hero-photo-bottom-anchored`
- Typography: `clean-modern-sans-restrained-display`
- Color palette: `photo-driven-warm-cream-translucent-toggle`
