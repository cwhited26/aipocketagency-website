---
slug: loma-boomerang-triptych-waitlist
name: Loma — Waitlist Hero / Boomerang Video Triptych
vibe: dark, premium, cinematic, pre-launch, engineered
industries: productivity saas, pre-launch startups, ai tools, crm software, email tools, project management, consumer apps, design tools
source: motionsites.ai archive (catalog title "Waitlist Hero", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
last_used: never
last_client: never
---

## Hero treatment
A single no-scroll viewport built for one job: collecting waitlist signups. The page is a near-black `#0E1114` shell with a faint dotted pattern (1px white dots at 7% opacity on a 24px grid), a slim navbar (lowercase wordmark left, Login + bordered black "Join the Waitlist" pill right), and below it one large inner card — `#030404`, 32px radius, 8px inset from the page edges — that holds everything else.

Inside the card, the signature: ONE video rendered as THREE synced panels. Three equal-width rounded canvases sit side by side, and a hidden offscreen video is sliced across them — each canvas draws its third of a cover-fitted frame, so the three panels read as one continuous cinematic image cut into a triptych. The video plays as a BOOMERANG: frames are captured into an array on first playthrough (via requestVideoFrameCallback, scaled to max 960px wide), then a 30 FPS render loop ping-pongs the index forward and back forever. The middle panel carries a pill-shaped portrait frame (130x225px, fully rounded, 1.5px white ring) floating at center, and each panel gets a soft glowing orb (radial-gradient circle, blur 20px, screen blend) for depth. A 260px bottom gradient fades the panels into the card, and the text row sits on top of it: a small left paragraph + white "Join the Waitlist" pill, and on the right a giant right-aligned headline — "Organized." at clamp(52px, 10vw, 110px) — with an italic underline line beneath it ("So you don't have to be.").

## Page layout
One viewport, no scroll: navbar, then the inner card fills all remaining height. Panels 2 and 3 hide on small screens so mobile gets a single full-bleed panel. The text row stacks vertically on mobile and splits left/right on md+. All transitions 200ms; buttons compress to scale-95 on press.

## Typography
- Display + body: Inter (one family) — wordmark font-semibold text-2xl with -0.02em tracking; headline weight 600, line-height 1.0, -0.03em tracking
- The headline is a single word plus a period; the wit lives in the italic follow-up line at text-base, white at 60%
- Supporting paragraph text-sm, white at 70%, max-width 280px

## Color palette
- Page shell: `#0E1114` with `rgba(255,255,255,0.07)` dot grid
- Inner card: near-black `#030404`
- Text: white, stepped through /70 and /60 opacities
- CTAs: white pill with `#030404` text (hero), black pill with 1px solid white border (nav)
- Orbs: white and cool blue-whites (`rgba(200,215,255,0.55)`, `rgba(185,210,235,0.55)`) at screen blend
- Bottom fade: `rgba(3,4,4,0.88)` to transparent

## Visual motifs
- **One video sliced into three panels** — three canvases each draw a third of the same cover-fitted frame, so separate rounded cards read as one continuous scene
- **Boomerang playback** — the clip plays forward then backward forever via captured frames and a 30 FPS ping-pong loop (no currentTime seeking — that lags; frames must be pre-captured to canvas)
- **Page-within-a-card** — the whole experience lives in one big rounded-32px near-black card inset 8px from the viewport edges
- **Dotted-grid backdrop** — faint 24px dot pattern on the shell, visible only in the slim margins around the card
- **Pill portrait frame** — a tall fully-rounded image capsule floating at the center of the middle panel, ringed in 10% white
- **Glowing orbs** — blurred radial-gradient circles at screen blend, one per panel, adding cinematic light bloom
- **One-word headline with italic aside** — "Organized." huge and right-aligned, answered by a small italic "So you don't have to be."
- **Single-conversion page** — every button on the page says the same thing: join the waitlist

## When to use
- Pre-launch products collecting a waitlist before shipping
- Productivity, CRM, email, or project tools whose pitch is calm and order
- Brands with one strong cinematic clip that deserves a premium frame
- Founders who want a launch page that looks engineered, not templated
- Anywhere a single email capture is the entire goal

## When to NOT use
- Anyone needing feature sections, pricing, or explanation — this page says one sentence
- Sites without a high-quality video clip; the triptych IS the design
- Low-powered mobile audiences — frame capture is memory-heavy, and mobile already degrades to one panel
- Launched products that need real conversion paths — use `bookedup-deep-shadow-saas`

## Build complexity
HIGH complexity. The frame-capture boomerang and the cover-math canvas slicing are custom JavaScript with real edge cases (resize handling, memory caps, requestVideoFrameCallback fallback). The video must be hosted locally — streaming it remotely breaks the capture loop.

## Library cross-references
- Motif: `video-sliced-across-panels`
- Motif: `boomerang-frame-capture-playback`
- Motif: `page-within-rounded-card`
- Motif: `dotted-grid-backdrop`
- Motif: `glowing-orb-light-bloom`
- Motif: `one-word-headline-italic-aside`
- Typography: `inter-single-family-tight`
- Color palette: `near-black-white-blue-bloom`
