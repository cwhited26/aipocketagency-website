---
slug: welkin-crypto-amber-glow-serif
name: Welkin — Crypto Serif Hero with Amber Glow
vibe: dark, cinematic, serif-led, glowing, minimal
industries: crypto wallets, defi platforms, fintech, digital asset management, web3 infrastructure, trading platforms, blockchain startups
source: motionsites.ai archive (catalog title "Orbit Web3", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
last_used: never
last_client: never
---

## Hero treatment
A dark cinematic crypto hero set entirely in Instrument Serif — the whole page, nav links included, runs on one serif face, which is what separates it from every sans-heavy web3 site. Background: full-screen looping video behind everything, on a deep green-black `#0a0f0d` base. Top-left nav: a stroke-drawn zigzag "W" logo mark next to four product links (Vault, Send, Receive, Trade) in warm off-white, hover to 80%.

The headline is vertically centered, max-w-3xl, huge (text-6xl → 8xl → 7rem, `leading-[0.95]`): "Own the future of your assets." The final word carries a NEON GLOW built from two absolutely-positioned duplicate spans layered on the word — both pure white, masked with directional linear gradients (top-right bias), one at blur-sm and one at blur-md/60% opacity — so the word looks lit from above-right rather than uniformly fuzzy. Containers up the tree set `overflow-visible` so the glow bleeds past the text box.

Below sits the GlowButton: an amber pill (`#ecd693` family, radius 43px, text-xl) throwing a huge soft shadow (`0 4px 95px 4px` amber at 60%) with a blurred white blob clipped inside its top edge — the button reads like a lamp. Hover scales 1.05. Bottom of the viewport: a "Trusted by top builders" logo marquee (left-aligned, half-width on desktop) of icon + name pairs at 60% white, looping left over 20s.

## Page layout
Single full-viewport hero: nav top, headline centered via flex, marquee pinned to the bottom with mt-auto. Padding px-8 mobile / px-16 desktop, pb-10. The marquee spans full width on mobile, 50% on md+.

## Typography
- Display + body: Instrument Serif (Google Fonts, regular + italic) — one serif face for everything: nav, headline, button, marquee labels
- Headline: text-6xl / md:text-8xl / lg:7rem, `leading-[0.95]`, tracking-tight

## Color palette
- Background: deep green-black `#0a0f0d` (HSL 150 20% 5%)
- Foreground: warm off-white `#ede9de` (HSL 45 30% 90%)
- Accent: warm amber-gold `#ecd693` (HSL 45 70% 75%) for the CTA, dark text on it
- Glow shadow: amber at 60% opacity, 95px spread
- Marquee: foreground at 50-60% opacity

## Visual motifs
- **Glowing last word** — the headline's final word gets a directional neon glow from two blurred white duplicates with gradient masks; lit, not fuzzy
- **Lamp button** — amber pill CTA with a 95px soft amber shadow and a blurred white blob clipped inside its top edge
- **All-serif interface** — nav, headline, button, and marquee all in Instrument Serif; the typeface IS the brand position
- **Hand-drawn zigzag logo mark** — a single stroke-based SVG path with rounded caps, no fill
- **Full-bleed video on green-black** — footage runs behind everything with no overlay panel
- **Builders marquee** — icon-plus-name trust strip at 60% opacity looping along the hero's bottom edge

## When to use
- Crypto wallets, DeFi products, and digital asset platforms that want premium calm instead of degen noise
- Fintech brands positioning on trust and permanence ("own the future")
- Web3 infrastructure selling to builders — the marquee speaks to them directly
- Any dark product hero where one glowing word can carry the promise
- Brands with abstract, slow, cinematic footage

## When to NOT use
- Information-dense fintech that needs charts, rates, or product shots up top
- Light-brand or consumer-friendly finance; this reads exclusive and nocturnal
- Teams wanting a hard-edged techno aesthetic (use `cyberpunk-red-augmented-self`)
- Anyone whose accent color is cool-toned — the amber glow is load-bearing and warm by design

## Build complexity
LOW — the glow is two masked spans and a shadow; the rest is a single-section flex layout with a CSS marquee.

## Library cross-references
- Motif: `glowing-last-word-headline`
- Motif: `lamp-glow-cta-button`
- Motif: `all-serif-interface`
- Motif: `full-bleed-video-no-overlay`
- Motif: `logo-marquee-loop`
- Typography: `instrument-serif-everything`
- Color palette: `green-black-amber-glow`
