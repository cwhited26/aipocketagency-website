---
slug: onetrack-focus-waitlist-glass-hero
name: Onetrack.ai — Waitlist Hero / Glass Email Capture
vibe: calm, focused, glassy, pre-launch, minimal
industries: pre-launch startups, productivity apps, ai tools, newsletters, online courses, coaching programs, wellness apps, consumer software
last_used: never
last_client: never
source: motionsites.ai archive (catalog title "Railroad.ai", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
---

## Hero treatment
A single-purpose WAITLIST hero: full-screen background video with a faint 5% black wash, one headline, one paragraph, one email field. The headline ("Focus in a Constantly Distracted World") is near-black on the bright footage, set huge — up to 5.5rem with -4px tracking and a very tight 0.85 line-height — and animated word by word: each word resolves from blur(10px), 50px low, and transparent, 0.35s per word on a 100ms stagger. The subheading follows the same blur-resolve at a 0.8s delay, in a muted slate gray.

The conversion element is a liquid-glass email capsule (delay 1.1s): a rounded-full container with a deep 100px backdrop blur over a 25% black fill, holding a transparent input ("Enter your email") and a solid white "Join Waitlist" pill with an ArrowUpRight icon. Above the headline floats a small glass badge — "10K+ already subscribed" — borrowing waitlist momentum as social proof.

## Page layout
One screen. The nav floats 30px from the top: wordmark left, a liquid-glass pill containing four links center (hidden on mobile), and a white "Get Started" pill right. Hero content centers vertically with extra bottom padding so the composition sits slightly high. Nothing else — no sections, no footer. Every surface uses the same glass recipe: near-zero white fill, luminosity blend, 4px blur, inset top highlight, gradient hairline border via mask-composite.

## Typography
- Display + body: system font stack (the prompt imports Instrument Serif and Barlow but renders the SF Pro system stack; substitute Inter for guaranteed consistency) — headline at text-6xl to 5.5rem, tracking -4px, leading-[0.85]
- Subheading: ~1.2rem with -0.05em tracking and tight leading, muted gray
- Nav and badge text: text-sm font-medium at 90% foreground

## Color palette
- Headline ink: near-black `#06121a` (hsl 205 52% 5%) on bright video
- Subheading: muted slate `#4d5c5c` (hsl 180 9% 33%)
- Action color: pure white `#ffffff` pills with black text
- Email capsule: `rgba(0,0,0,0.25)` fill under blur(100px)
- Fallback background: soft blue-gray `#86aed0` (hsl 213 45% 67%)

## Visual motifs
- **Glass email capsule** — rounded-full waitlist field with a heavy 100px backdrop blur, dark translucent fill, transparent input, and a white pill submit button inside
- **Word-by-word blur headline** — words resolve from blur/offset/transparent on a 100ms stagger, subhead and form trailing at 0.8s and 1.1s
- **Floating glass nav pill** — the nav links live inside their own detached liquid-glass capsule, 30px off the top edge
- **Subscriber-count badge** — small glass pill above the headline claiming waitlist momentum
- **Dark text on bright video** — near-black display type straight on footage with only a 5% wash
- **White pill action buttons** — fully-rounded white CTAs with diagonal arrow icons; the radius token is 9999px across the design

## When to use
- Pre-launch products collecting emails before there is a product to show
- Courses, newsletters, and communities where the list is the business
- Productivity and wellness apps with an aspirational one-line promise
- Any campaign page where the only metric is signups
- Brands with bright, calm footage (landscapes, slow motion, ambient scenes)

## When to NOT use
- Established products that need feature proof — one screen, zero product shots
- Phone-call or booking conversions (use `trades-phone-first-emergency` or `medspa-booking-calendar-first`)
- Dark moody footage; the near-black type needs bright video behind it
- Anything past launch — the waitlist framing expires the day you ship

## Build complexity
LOW. One screen, one form, one glass recipe, a small word-stagger animation component. The fastest direction in the library to ship.

## Library cross-references
- Motif: `liquid-glass-email-capsule`
- Motif: `word-blur-reveal-headline`
- Motif: `floating-glass-nav-pill`
- Motif: `subscriber-count-badge`
- Motif: `dark-text-on-bright-video`
- Typography: `system-stack-tight-display`
- Color palette: `near-black-white-glass-on-video`
