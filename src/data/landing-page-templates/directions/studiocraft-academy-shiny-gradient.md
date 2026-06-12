---
slug: studiocraft-academy-shiny-gradient
name: Studiocraft — Design Academy Shiny Gradient Hero
vibe: dark, aspirational, education, polished, type-led
industries: design education, bootcamps, online courses, cohort programs, career accelerators, creator academies, training providers, certification programs
source: motionsites.ai archive (catalog title "DesignPro Academy", free tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: starter
last_used: never
last_client: never
---

## Hero treatment
Full-screen hero for a product design education brand on black with a looping background video. The centerpiece is a two-line headline at text-5xl up to text-9xl, line-height 0.85, tracking-tighter: line one ("Become") in plain white medium weight, line two ("Product Leader.") carrying an animated SHINY GRADIENT — the text fills with a light blue base `#64CEFB` while a white shine band sweeps across it left to right on a 3-second loop (a 100-degree CSS gradient with `background-clip: text` and transparent fill, animated with framer-motion). The shimmer makes the promise line feel like the prize.

Above the headline sits a small uppercase kicker about the next cohort opening. Below it, one CTA: "Apply for Next Enrollment" as a black rounded-full button with an arrow that slides right on hover — black-on-dark works because the video provides the contrast. The nav is a circle-in-ring logo plus wordmark left and a pill-contained link row (six links plus a contact-with-arrow) bordered in gray-700, links at 80% white brightening to full white on hover.

## Page layout
One viewport. Nav at top inside a max-w-7xl container; a two-column intro row under it (a mission sentence left, a right-aligned proof line counting 8000+ designers launched on the right, both at 80% white, stacking on mobile); the headline block centered in the remaining space with the CTA under it. Mobile collapses the nav to a hamburger and stacks the intro columns.

## Typography
- Display + body: Inter (Google Fonts) — headline at text-5xl→text-9xl, line-height 0.85, tracking-tighter, font-medium; body and kicker at text-sm/base
- Hierarchy is white vs 80%-white plus the single gradient line

## Color palette
- Background: black `#000000` under the video
- Headline base + body: white and white at 80% opacity
- Shiny gradient: `#64CEFB` light blue base with a white `#ffffff` shine sweep
- CTA: black fill, hover gray-900, white text
- Nav pill border: gray-700

## Visual motifs
- **Shiny gradient promise line** — the payoff words fill light blue while a white shine band sweeps across them every 3 seconds via background-clip text
- **Two-voice headline** — plain white setup line over the animated prize line, at line-height 0.85 so they read as one mark
- **Pill-contained nav links** — the whole link row lives inside one bordered rounded-full capsule
- **Proof line in the corners** — mission sentence left, a big graduate count right, framing the hero before the headline
- **Scarcity kicker** — a small uppercase line about the next cohort directly above the headline
- **Arrow-slide CTA** — rounded-full button whose arrow icon translates right on group hover

## When to use
- Design schools, bootcamps, and cohort-based courses
- Career accelerators and certification programs selling a transformation ("become X")
- Creator academies with an application or enrollment funnel
- Education brands with a strong count of alumni to show as proof
- Any offer where one aspirational headline plus one apply button is the page

## When to NOT use
- Schools without a real graduate number — the proof line is load-bearing
- Corporate training and compliance education; the shimmer reads consumer-aspirational
- Light-brand or institutional brands — this is dark-mode by design
- Multi-program catalogs needing navigation depth on screen one (use `codenest-coding-education-dev-platform` for a fuller education platform layout)

## Build complexity
LOW. One ShinyText component with a looping gradient, otherwise static layout over a video. Half-day build.

## Library cross-references
- Motif: `shiny-gradient-text-sweep`
- Motif: `two-voice-promise-headline`
- Motif: `pill-contained-nav`
- Motif: `corner-proof-lines`
- Motif: `scarcity-kicker-line`
- Motif: `arrow-slide-cta`
- Typography: `inter-tight-085-line-height`
- Color palette: `black-white-light-blue-shine`
