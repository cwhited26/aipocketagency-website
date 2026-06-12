---
slug: murmur-calm-phone-typing-hero
name: Murmur — Calm Messaging / Phone-Screen Typing Hero
vibe: calm, soft, serif-led, nostalgic, minimal
industries: wellness apps, journaling apps, meditation, mental health, slow-tech consumer products, newsletters, community apps, digital minimalism brands
source: motionsites.ai archive (catalog title "Dot — Hero Section", free tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: starter
last_used: never
last_client: never
---

## Hero treatment
Full-screen hero on a warm paper background `#F3F4ED` with a centered background video showing an old candybar phone. The trick that makes the page: a live TYPING ANIMATION positioned to land exactly on the phone screen inside the video. Three short messages cycle ("Are you here?" / "Yes, I am." / "Speak soon.") in a pixel-LCD font with a blinking block cursor — typed at 100ms per character, deleted at 50ms, with a 2s pause before deleting. The overlay is absolutely positioned by percentage (`left ~48.5%, bottom ~32%`) so it tracks the phone screen across breakpoints.

Over the video, a centered serif headline ("Short notes. Daily calm.") fades in with a slight scale-up (opacity 0 / scale 0.95 → 1 over 1.5s, ease `[0.16, 1, 0.3, 1]`), followed 0.3s later by a one-sentence sub-headline rising 20px into place. A faint `bg-white/5` tint sits over the video so the type stays readable without killing the warmth.

## Page layout
Single full-viewport hero plus a floating pill navbar. The nav is fixed 24px from the top, centered, 95% width capped at a 5xl container — a transparent pill with a thin black-10% border and backdrop blur, wordmark left in the serif face, four links center, one blue CTA right. The CTA has an inset bottom highlight shadow and a small gradient "glint" bar across its top edge that widens on hover. Everything else is the video and the type.

## Typography
- Display: Instrument Serif (Google Fonts, 400 + italic) — headline at 38px mobile / 56px tablet / 72px desktop, line-height 0.85, tight tracking
- Body: Inter — 16-18px sub-headline at 70% black, nav links at 14px
- Accent: VT323 (substitute for the prompt's Nokia Cellphone FC pixel face) — the typed messages on the phone screen, 10-14px in dark olive `#2A3616`

## Color palette
- Background: warm paper `#F3F4ED`
- Text: near-black `#1a1a1a`
- CTA blue: `#0871E7` with an inset white-39% bottom shadow and a `#DEF0FC`-to-transparent glint bar
- Phone-screen text: dark LCD olive `#2A3616`
- Video tint: white at 5%

## Visual motifs
- **Typing messages on the phone screen** (the signature) — a type-and-delete loop absolutely positioned over the video so the words appear on the physical phone's display, pixel font, blinking block cursor (opacity 0→1→0 over 0.8s, infinite)
- **Floating pill navbar** — fixed, centered, transparent with backdrop blur and a hairline border; wordmark in the serif face, lowercase with a period
- **Glint CTA button** — solid blue pill with an inset bottom-light shadow and a thin gradient highlight bar across the top edge that scales wider on hover
- **Serif headline over video** — two short lines, line-height 0.85, fading in with a gentle scale
- **Warm paper canvas** — the page reads soft and analog, not white-SaaS sterile
- **Staggered entrance** — headline first, sub-headline 0.3s later, both on the same long ease curve

## When to use
- Apps and products selling calm: journaling, meditation, daily check-ins, slow messaging
- Mental health and wellness brands that want quiet confidence instead of clinical polish
- Newsletters or communities built around one small daily ritual
- Consumer products with a nostalgia angle — the retro phone framing does the storytelling
- Any brand whose pitch is "less noise" — the page itself demonstrates the promise

## When to NOT use
- B2B or enterprise software — the tone is too soft and personal
- Brands without a custom hero video featuring a device or object the typing can land on — the positioned overlay is the whole point
- High-urgency local services where the call is the conversion (use `trades-phone-first-emergency`)
- Feature-heavy products that need sections of proof — this is a single-mood page

## Build complexity
MEDIUM. The typing loop is simple state code, but pinning the overlay to the phone screen in the video takes per-breakpoint position tuning, and the design collapses if it drifts.

## Library cross-references
- Motif: `typing-overlay-on-video-object`
- Motif: `floating-pill-navbar-blur`
- Motif: `glint-highlight-cta-button`
- Motif: `serif-headline-scale-fade`
- Typography: `instrument-serif-inter-calm`
- Typography: `pixel-lcd-accent-face`
- Color palette: `warm-paper-blue-olive`
