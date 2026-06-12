---
slug: lumara-signup-split-video-steps
name: Lumara — Signup Screen / Split Video + Step List
vibe: black, minimal, app-grade, focused, onboarding
industries: saas onboarding, productivity apps, creator platforms, membership sites, fintech apps, design tools, developer platforms, subscription products
source: motionsites.ai archive (catalog title "Aurora Onboard", free tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: starter
last_used: never
last_client: never
---

## Hero treatment
This is a SIGNUP PAGE pattern, not a marketing hero — a full-screen, two-column registration screen that looks like the inside of a premium app. The whole page is black with a thin 8-16px black frame (p-2, lg:p-4). Left column (52% width, desktop only): a rounded-3xl panel filled edge-to-edge by an autoplaying background video with NO overlay or tint, content bottom-anchored (justify-end, pb-32). Over the video: a small logo row (filled circle icon + wordmark), a "Join Lumara" heading at text-4xl, a one-line description at 60% white, and the signature — a vertical list of three onboarding steps rendered as pill rows ("Register your identity" / "Configure your studio" / "Finalize your profile"), where the active step is a white pill with black text and a black number circle, and inactive steps are `#1A1A1A` pills with dimmed number circles. The visitor sees exactly where they are in a three-phase flow before typing anything.

Everything animates in with a staggered reveal: the left column staggers its children 0.15s apart, each fading up from y:10 over 0.5s; the form side fades in over 0.8s ease-out.

## Page layout
Right column (flex-1): the form, centered. Header ("Create New Profile" + a quiet subtitle at 40% white), a 2-column row of social signin buttons (Google / GitHub, black with 10% white borders), an "Or" divider line, then the fields — first/last name side by side, email, password with an eye-toggle icon and a tiny "Requires at least 8 symbols." helper — and a full-width white submit button (h-14, rounded-xl, presses to scale 0.98). Footer link: "Member of the team? Log in". On mobile the video column hides entirely and the form goes full-width with vertical scroll.

## Typography
- Display + body: Inter (Google Fonts, weights 300-700) — headings font-medium tracking-tight (text-4xl hero, text-3xl form header)
- Hierarchy is built from white opacity steps, not weights: white labels, /60 descriptions, /40 subtitles, /20 placeholders
- Divider text uppercase, text-xs, widest tracking

## Color palette
- Page and form side: pure black `#000000`
- Inputs and inactive step pills: brand gray `#1A1A1A`, borderless, rounded-xl
- Active step + submit button: solid white with black text
- Borders: white at 10%; focus rings white at 20%
- All other color comes from the left-panel video

## Visual motifs
- **Split screen, video left / form right** — a 52/48 split where the brand side is a rounded video panel and the working side is a black form; the rounded panel inside a thin black frame reads as app chrome, not a webpage
- **Numbered step pills** — three onboarding phases as stacked pill rows with number circles; active = white pill black text, inactive = dark gray dimmed — progress shown before the first keystroke
- **No-overlay video panel** — the footage runs untouched inside its rounded-3xl mask, bottom-anchored content sitting straight on it
- **Opacity-stepped hierarchy** — one font, one color; structure comes entirely from white at 100/60/40/20 percent
- **Borderless dark inputs** — `#1A1A1A` rounded-xl fields with no borders, only a soft white focus ring
- **Staggered entrance** — left-panel children cascade in 0.15s apart; the form fades in as one block
- **Social-first form order** — Google/GitHub buttons above the divider, manual fields below

## When to use
- The signup/registration screen for any dark-themed product — pairs with a separate marketing site
- Onboarding flows with named phases the step list can surface
- Creator, design, and developer tools where app-grade chrome builds trust at signup
- Brands with one good atmosphere video to own the left half
- Products pushing OAuth signin first, email second

## When to NOT use
- As a marketing or landing page — there is no pitch, no pricing, no nav; it is a form
- Light-themed brands; the design is black-dependent
- Audiences uncomfortable with minimal forms (older demographics, gov/medical intake) that expect labels, help text, and visible structure
- Single-step signups — the three-step list is the centerpiece; with one step it's noise

## Build complexity
LOW complexity. Two columns, three small reusable components (step pill, social button, input group), one stagger animation. The video is decorative and needs no logic.

## Library cross-references
- Motif: `split-video-form-screen`
- Motif: `numbered-step-pills`
- Motif: `opacity-stepped-hierarchy`
- Motif: `borderless-dark-inputs`
- Motif: `full-bleed-video-no-overlay`
- Typography: `inter-medium-tracking-tight`
- Color palette: `pure-black-white-gray-steps`
