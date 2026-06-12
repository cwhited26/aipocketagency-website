---
slug: cellara-biotech-inline-pill-headline
name: Cellara — Biotech Consulting with Inline-Pill Headline
vibe: light, clean, friendly-premium, video-cards, consulting
industries: biotech consulting, life sciences advisory, venture builders, healthtech, pharma services, research organizations, science-led startups, b2b consulting
source: motionsites.ai archive (catalog title "Bionova Biotech", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
last_used: never
last_client: never
---

## Hero treatment
A white, exactly-100vh consulting hero (scrollable only on mobile) split into two columns. The left column carries the signature: a large Poppins headline with UI ELEMENTS EMBEDDED INLINE in the sentence — "World-class" sits next to a small rounded image pill (a photo cropped into a 96×48 capsule), and "empower" is followed by an inline outlined pill button with a play icon reading "How do we work", before finishing "biotech leaders". The headline reads as a sentence you can click. Under it, a soft-blue "Contact us" pill with an arrow icon and an underlined "Request a call" link. The column bottom (desktop only) holds a short paragraph and a row of client wordmarks in bold text.

The right column is a bento stack of three black rounded cards (radius 1.5rem mobile / 2.5rem desktop), each backed by an autoplaying looping video (HLS streams in the source; any three loops work): one large card on top with a white invitation heading and a circular arrow button, then two square cards below — one with a "locations" pill badge and a short claim, one with a "scientists" badge and a giant stat number (text-7xl "34"). Card content sits z-10 over the video; the two small cards scale their video 150% / 280% so the footage reads as texture.

Both columns fade up on load (20px rise + 4px blur clearing, 700ms, `cubic-bezier(0.16, 1, 0.3, 1)`), the right column 150ms behind the left.

## Page layout
One viewport on desktop: nav (wordmark left, four semibold links center, "Log in" + soft-blue "Request a call" pill right), then the two-column grid stretched to fill, px-5 → px-16. Mobile stacks: headline block, CTAs, then the three cards at min-height 180-200px; the description paragraph and logo bar hide below lg.

## Typography
- Display + body: Poppins (Google Fonts, weights 400-700) — headline at text-[2rem] → 5xl → 3.5rem → 7xl, `leading-[1.08]`, tracking-tight, font-normal (the inline pills carry the personality, not the weight)
- Badges and buttons: small rounded-full pills, semibold

## Color palette
- Background: white `#ffffff`
- Text: dark gray `#2b2b2b` (HSL 0 0% 17%)
- Accent: soft blue `#94c2fa` (HSL 213 90% 78%) with white text — buttons only
- Cards: black `#000000` base under video, white text and white/85 copy
- Badges: white pills with dark text sitting on the video cards

## Visual motifs
- **Inline-pill headline** — image capsules and a play-button pill embedded mid-sentence inside the H1; the headline doubles as UI
- **Black video bento cards** — one large + two square rounded-corner cards backed by looping video, content floating over it
- **Giant stat card** — a single oversized number (text-7xl) with a small label badge does the credibility work
- **Pill badges on video** — small white capsule labels ("locations", "scientists") pinned to card corners
- **Blur-clearing entrance** — columns fade up while a 4px blur resolves to sharp, right column trailing 150ms
- **Soft-blue single accent** — one pastel blue for every action on an otherwise black-and-white page
- **Client wordmark row** — plain bold-text logos under the description, no images needed

## When to use
- Biotech, life-sciences, and pharma consultancies
- Venture builders and accelerators recruiting founders ("let's get in touch" card)
- Healthtech and science-led startups that want premium but approachable
- B2B advisory firms with a stat worth shouting (team size, locations, exits)
- Brands with lab/facility footage that works as card texture

## When to NOT use
- Brands with no video assets at all — three loops are structural here, not decorative
- Clinical or patient-facing healthcare where playful inline pills read off-tone (use `medara-healthcare-ai-chat-input-hero`)
- Dark-brand companies; this direction is white-page-first
- Anyone who needs more than one screen of selling on desktop — the 100vh lock is the design

## Build complexity
MEDIUM — the inline headline pieces and three video cards are simple individually, but HLS playback (hls.js with a Safari fallback) and the locked 100vh grid need care.

## Library cross-references
- Motif: `inline-pill-headline`
- Motif: `black-video-bento-cards`
- Motif: `giant-stat-card`
- Motif: `pill-badges-on-video`
- Motif: `blur-clearing-entrance`
- Typography: `poppins-normal-weight-large`
- Color palette: `white-black-soft-blue-accent`
