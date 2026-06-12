---
slug: noctura-shader-cinematic-dark-hero
name: Noctura — AI Platform / Live WebGL Shader Cinematic
vibe: dark, cinematic, atmospheric, futuristic, generative
industries: ai platforms, deep tech, cybersecurity, research labs, web3 infrastructure, premium saas, venture studios, stealth-mode startups
source: motionsites.ai archive (catalog title "Futuristic Cinematic", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
last_used: never
last_client: never
---

## Hero treatment
A single full-viewport dark hero with NO video file — the entire background is a real-time WebGL shader composition rendered in the browser. The stack layers a studio-lighting backdrop (deep violet `#1a0f2e` back wall, curved-wall vignette, white key/fill lights), a spherized swirl of near-black blues in oklab color space, a drifting lens flare with halo and ghost artifacts, slow-falling lavender particles (`#c5b7ed`, twinkling, 49% opacity), cursor-reactive ripples with chromatic splitting, and a 5% film grain over everything. The background breathes, drifts, and answers the mouse — footage cannot do that.

Centered copy floats over it at z-20: a white Inter headline at restrained `clamp(1.75rem, 5vw, 2.6rem)` reading like poetry across two lines, then the contrast move — a monospace (Courier New) subtitle at 60% white, lowercase, reading like terminal output under the display line. A single white pill CTA ("See it in motion") with an arrow that nudges right on hover.

The nav is the third texture: a pill-shaped "liquid glass" container for the center links — 1% white fill with luminosity blending, 4px backdrop blur, an inset top highlight, and a gradient border (bright at top and bottom edges, transparent at the middle) painted via mask-composite so it reads as light catching a glass rim. Brand wordmark left in lowercase, white pill CTA right.

## Page layout
One viewport, locked (`h-screen overflow-hidden`). Mobile drops the center pill nav and right CTA into an animated slide-down menu on near-black (`rgba(8,8,8,0.97)`) with 50ms staggered item reveals on a `cubic-bezier(0.23, 1, 0.32, 1)` ease and Escape-to-close. Nothing scrolls; the shader is the experience.

## Typography
- Display: Inter (Google Fonts, 400/500/600/700) — headline at normal weight, tight tracking, 1.12 leading; deliberately small for a hero (max 2.6rem)
- Body: Courier New monospace for the subtitle — the machine-voice counterpoint to the human headline

## Color palette
- Base: pure black `#000000` page under the shader
- Shader back wall: deep violet `#1a0f2e`; swirl tones `#0a0a0d` / `#0f0f1a`
- Particles: pale lavender `#c5b7ed`; sphere rim light `#a9cbe8`
- Type: white, with `rgba(255,255,255,0.6)` for the mono subtitle
- CTAs: white pills with black text

## Visual motifs
- **Generative shader background** — layered real-time WebGL (studio lighting, spherized swirl, lens flare, particles, film grain) instead of a video file; it never loops because it never repeats
- **Cursor ripples** — the background reacts to pointer movement with chromatic-split ripples; visitors discover the page is alive
- **Liquid-glass nav pill** — near-transparent blurred container whose 1.4px gradient border brightens at the top and bottom edges via CSS mask-composite, reading as a lit glass rim
- **Mono subtitle under a display headline** — Courier New terminal-voice copy beneath the Inter headline; human statement, machine whisper
- **Restrained headline scale** — max 2.6rem in a category that shouts; the atmosphere does the talking
- **Staggered mobile menu** — slide-down panel with 50ms-per-item reveals on a long ease-out curve

## When to use
- AI, deep-tech, and security companies that want "from the future" without stock sci-fi footage
- Stealth startups and waitlist pages where mood matters more than information
- Web3 infrastructure and research brands selling sophistication to technical buyers
- Products with nothing to screenshot yet — the shader fills the void credibly
- Brands that want an interactive detail (cursor ripples) people mention afterward

## When to NOT use
- Anyone needing sections, proof, or pricing — this is a one-screen statement (use `cognitra-ai-agency-gray-panel` for a fuller AI site)
- Low-end devices and battery-sensitive mobile audiences; real-time WebGL costs GPU
- Brands that read warm or human-first — the aesthetic is cold by design (`modern-agency-mental-wellness` covers the opposite pole)
- Teams without comfort maintaining a shader dependency; if it breaks there is no fallback imagery

## Build complexity
HIGH complexity. The shader composition has a dozen tuned parameters per layer, the liquid-glass border needs exact mask-composite CSS, and performance testing across devices is mandatory.

## Library cross-references
- Motif: `webgl-shader-background`
- Motif: `cursor-reactive-ripples`
- Motif: `liquid-glass-nav-pill`
- Motif: `mono-subtitle-display-headline`
- Motif: `restrained-headline-scale`
- Typography: `inter-plus-courier-terminal`
- Color palette: `black-violet-lavender-shader`
