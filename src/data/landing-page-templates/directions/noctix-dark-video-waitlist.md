---
slug: noctix-dark-video-waitlist
name: Noctix — Dark Video Waitlist Hero
vibe: dark, minimal, mysterious, restrained, tech
industries: ai startups, deep tech, robotics, defense tech, machine learning platforms, security software, crypto infrastructure, stealth-mode launches
source: motionsites.ai archive (catalog title "Velorix IIC", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
last_used: never
last_client: never
---

## Hero treatment
A single full-viewport hero on pure black: a looping background video with NO overlay, a lowercase wordmark top-left, and a centered content stack pushed toward the top of the screen (90-120px below the nav, not vertically centered). The headline is deliberately small for the genre — `clamp(1.75rem, 5vw, 2.6rem)`, normal weight, tight tracking — two lines of abstract positioning copy. Under it sits the quiet signature: a subline set in monospace (Courier New) at 60% white, reading like terminal output against the cinematic video. One white pill CTA ("Watch it unfold") with an arrow that nudges right on hover closes the stack.

The desktop nav is a dark capsule — links grouped in a single `#0C0C0C` rounded-full container floating center-screen, each link getting its own pill hover. A white "Join the wait" pill sits right. All motion is CSS-only: no scroll choreography, no parallax.

## Page layout
One screen, no scrolling sections — this is a waitlist/teaser page, not a full site. Mobile gets the most engineered moment: the hamburger crossfades to an X (icons counter-rotate 90deg and scale through 0.5 over 0.3s), the backdrop blurs from 0 to 12px over a 60% black wash, and a panel expands from `max-height: 0` to 420px with links staggering in at 50ms intervals (translateY(-8px) to 0), capped by a full-width white CTA at a 360ms delay.

## Typography
- Display + body: Inter (Google Fonts) — normal-weight headline at `clamp(1.75rem, 5vw, 2.6rem)`, tight tracking, line-height 1.12
- Mono accent: Courier New (system) — the subline only, 14-16px at 60% white, `letter-spacing 0.01em`
- Wordmark lowercase, semibold, tracking-tight

## Color palette
- Background: pure black `#000000` under full-opacity video
- Nav capsule: `#0C0C0C`
- Text: white; subline `rgba(255,255,255,0.6)`; nav links at 80% white
- CTA pills: solid white `#ffffff` with black text, hover drops to 80% opacity
- Mobile panel: `rgba(8,8,8,0.97)` with a 1px hairline at 8% white

## Visual motifs
- **Dark capsule navigation** — desktop links grouped inside one near-black rounded-full container, each link a pill with its own white/10 hover wash
- **Monospace subline** — the supporting copy switches to a typewriter face at 60% white, reading like machine output under a human headline
- **Full-bleed video, no overlay** — the video runs at full opacity; the restrained type sizes keep it legible
- **Hamburger-to-X crossfade** — open/close icons counter-rotate and scale through each other on a 0.3s cubic-bezier
- **Staggered drop-down mobile menu** — a max-height panel with links cascading in at 50ms steps over a 12px blurred backdrop
- **Restrained headline scale** — a 2.6rem max headline where the category screams 6rem; the page whispers

## When to use
- Pre-launch waitlist pages for AI, deep tech, or robotics products
- Stealth startups that want intrigue over explanation
- Brands whose product footage or generative video IS the pitch
- Security and infrastructure companies that read as precise and quiet
- Any single-CTA teaser where the only job is "join the wait"

## When to NOT use
- Anyone who needs to explain what the product does — this page says almost nothing on purpose
- Local or service businesses; the abstraction reads as evasive there (use `contractor-photo-first-trust`)
- Full marketing sites — there is one screen and one CTA, nothing else
- Brands without strong video; on a static image the minimalism turns into emptiness

## Build complexity
LOW — one screen, CSS-only transitions; the mobile menu choreography is the only piece needing care.

## Library cross-references
- Motif: `dark-capsule-navigation`
- Motif: `monospace-subline-accent`
- Motif: `full-bleed-video-no-overlay`
- Motif: `hamburger-x-crossfade`
- Motif: `staggered-dropdown-mobile-menu`
- Motif: `restrained-headline-scale`
- Typography: `inter-courier-mono-mix`
- Color palette: `pure-black-white-pill`
