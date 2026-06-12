---
slug: axion-it-light-notched-corners
name: Axion — IT Consulting Light with Notched Corners
vibe: light, corporate, condensed-type, gradient-heading, squared
industries: it consulting, managed services, enterprise software, digital transformation, systems integrators, b2b technology, logistics tech, custom development shops
source: motionsites.ai archive (catalog title "Nexus IT Solutions", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
last_used: never
last_client: never
---

## Hero treatment
A LIGHT-THEME full-viewport hero — rare in the video-hero family, which skews black. White background tokens with a background video stretched `object-fill` to the full viewport (deliberately stretched, no cropping, no overlay), and dark navy text over it. The headline ("We drive companies beyond their biggest obstacles", text-4xl → 6xl, -0.06em tracking) is filled with a vertical GRADIENT — deep navy `#0d2c4f` at the top dissolving to a brighter steel blue `#2b88ca` — via background-clip, so the heading itself carries the brand color. Subheading in muted gray below, max-w-xl.

The CTA is a NOTCHED BUTTON: a square-cornered button decorated with eight tiny tick marks — short 10px × 1px spans inset 4px from each corner, horizontal and vertical — reading like a CAD viewport or a focus bracket. The angle-bracket wordmark "<AXION>" and squared-off everything (rounded-none on all buttons) carry the same engineering tone. Nav links and CTA run Akshar, a condensed sans, in uppercase with `0.05em` tracking; the "GET IN TOUCH" nav button is a hairline-bordered rectangle that fills solid on hover.

Bottom of the viewport: a "Trusted by leading innovators worldwide" strip — an uppercase tracked label over a row of recognizable-weight client wordmarks in plain bold text at 40% opacity.

## Page layout
One 100vh screen: navbar (max-w-7xl), hero copy vertically centered (left-aligned, max-w-3xl), trust strip at the bottom. The whole page is the hero — sections below would extend the same tokens.

## Typography
- Display: Akshar (Google Fonts, weights 400-700) — condensed sans for logo, nav, subheading, and buttons, uppercase with `0.05em` tracking
- Body: Inter (Google Fonts, weights 400-700)
- H1: text-4xl / md:5xl / lg:6xl, font-normal, -0.06em tracking, gradient-filled

## Color palette
- Background: white `#ffffff`
- Foreground: dark slate-navy `#29303d` (HSL 220 20% 20%)
- Heading gradient: deep navy `#0d2c4f` → steel blue `#2b88ca`, top to bottom, clipped to text
- Muted text: gray `#737d8c` (HSL 220 10% 50%)
- Buttons: transparent with 10% borders, hover inverts to muted fill with white text

## Visual motifs
- **Notched corner-tick button** — eight tiny tick marks inset at the button corners, like a viewfinder bracket around the label
- **Gradient-filled headline** — navy-to-steel-blue vertical gradient clipped to the heading text; the type carries the color
- **Angle-bracket wordmark** — the brand set inside < > like a code tag
- **Stretched full-fill video** — background video forced to `object-fill` so the full frame always shows, light footage under dark text
- **Squared-off buttons** — rounded-none everywhere; no pills on this page
- **Text-only trust strip** — client names as bold text at 40% opacity under an uppercase tracked label

## When to use
- IT consulting, managed services, and systems integrators
- Digital transformation and custom-platform shops selling to enterprise buyers
- B2B tech brands that want a light, daylight-corporate feel instead of dark-mode drama
- Companies with blue-family branding — the gradient heading adapts to any two blues
- Logistics and operations tech with enterprise client names to show

## When to NOT use
- Brands wanting warmth or consumer friendliness — the squared geometry reads strictly corporate
- Dark-brand companies; this is the light counterpart to `korvant-security-vivid-green-dark`
- Footage that distorts badly when stretched — `object-fill` ignores aspect ratio by design
- Startups with no recognizable client names; the text-only trust strip depends on them

## Build complexity
LOW — one screen, one gradient-clip class, and a corner-tick button component; the simplest light-theme hero in the library.

## Library cross-references
- Motif: `notched-corner-tick-button`
- Motif: `gradient-filled-headline`
- Motif: `angle-bracket-wordmark`
- Motif: `text-only-trust-strip`
- Typography: `akshar-condensed-uppercase`
- Color palette: `white-navy-steel-gradient`
