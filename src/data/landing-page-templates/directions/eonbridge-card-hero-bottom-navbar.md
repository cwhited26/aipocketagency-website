---
slug: eonbridge-card-hero-bottom-navbar
name: Eonbridge — Card-Framed Hero / Bottom Navbar / Logo Marquee
vibe: light, soft, card-framed, corporate-calm, minimal
industries: web3 infrastructure, blockchain platforms, fintech, enterprise software, developer platforms, digital consultancies, b2b saas
source: motionsites.ai archive (catalog title "Digital Epoch — Hero Section", free tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: starter
last_used: never
last_client: never
---

## Hero treatment
Light page (`#f9fafb`) whose hero is one enormous white CARD: max-w-1400px, `rounded-[48px]`, hairline slate border, and a very soft long-throw shadow (`0 40px 100px` at 3% black), 600px tall. A background video fills the card edge to edge with NO overlay — the card's rounded frame and the page's white margin do the composition work. Top-left inside the card, the text layer fades up: a two-line Outfit headline ("Foundation of the new digital epoch" pattern) at 42-56px medium in deep navy `#0a1b33`, a small slate subheadline, and a dark navy rounded-full "Contact Us" button with hover scale.

The structural surprise: the navbar lives at the BOTTOM of the hero card, centered — a floating white glass pill (`bg-white/90`, heavy backdrop blur, soft shadow) holding a small circular logo chip with a "✦" glyph, two tiny text buttons, and a "Get in touch" pill with a chevron. It fades up after the text, like a dock.

## Page layout
Hero card, then 40px below it a full-width logo marquee: a row of pill-shaped logo cards scrolling infinitely via a pure CSS keyframe (`translateX(0)` → `translateX(-50%)`, list rendered twice so the loop has no visible restart), pausing on hover, with mask-image gradients fading both edges to transparent. Each logo card copies the navbar button's styling exactly (white, hairline border, soft shadow, rounded-full, 96×160px). On hover, a brand-colored gradient field scales up from nothing inside the card while the logo flips to solid black — every partner gets a private color moment.

## Typography
- Display: Outfit (Google Fonts, 400-600) — headline at 42-56px medium, tight tracking
- Body: Inter (400-700) — 14-15px slate supporting copy and 12px semibold UI labels

## Color palette
- Page: `#f9fafb`; card and pills: white
- Headline + dark elements: deep navy `#0a1b33`; button fill `#0a152d`
- Secondary text: slate `#64748b`; borders `slate-200` at 40-60% opacity
- Per-logo hover gradients: one hex pair per partner (blues, purples, yellows, teals)

## Visual motifs
- **Hero as one giant rounded card** (the signature) — 48px-radius white frame with a feather-soft shadow holding the video, headline, and nav
- **Bottom-docked navbar** — the nav is a glass pill floating at the bottom center of the hero, arriving after the text like a dock
- **Raw video, no overlay** — the footage runs untreated; the card frame and white page margins keep it composed
- **CSS-only logo marquee** — keyframe-driven infinite scroll with edge fade masks and pause-on-hover; the logo list renders twice so the loop never visibly restarts
- **Gradient-flood hover cards** — each marquee pill hides a brand-color gradient that scales from 0 to full on hover while the logo inverts to black
- **Matched component styling** — marquee cards, nav buttons, and the CTA all share one pill recipe, so the page reads as a single system

## When to use
- Web3 infrastructure, blockchain, and platform companies that want institutional calm instead of neon
- Fintech and enterprise software where soft light surfaces signal stability
- Developer platforms with a partner/client logo row worth showing off
- Brands with atmospheric footage that can run untreated inside a frame
- Companies that want one memorable structural quirk (the bottom dock) on an otherwise quiet page

## When to NOT use
- Brands that need a conventional top nav for deep site structures — the bottom dock holds three items, not eight
- Dark-brand tech companies; see `framecraft-ai-builder-gradient-headline` for the dark mega-headline equivalent
- Anyone without real partner logos — the marquee is half the page's proof
- Mobile-dominant audiences with long menus — the dock pattern gets cramped below 400px

## Build complexity
LOW. The marquee is pure CSS, the card is Tailwind, and Motion handles two fade-ups. The only finesse is matching the pill recipe across nav, CTA, and marquee cards.

## Library cross-references
- Motif: `hero-as-giant-rounded-card`
- Motif: `bottom-docked-glass-navbar`
- Motif: `css-keyframe-logo-marquee`
- Motif: `gradient-flood-hover-cards`
- Motif: `untreated-video-in-frame`
- Typography: `outfit-display-inter-body`
- Color palette: `near-white-deep-navy-slate`
