---
slug: glassmorphism-purple-pink-agency
name: Glassmorphism — Purple/Pink Tech Agency
vibe: dark, modern-tech, premium-but-approachable, gradient-led, "for founders and devs"
industries: dev agencies, design+dev shops, AI startups, premium SaaS, no-code studios, fractional CTO services, indie maker / Solo founder studios, web3 / crypto-adjacent
source: motionsites.ai (Glassmorphism Agency Hero prompt — extracted Jun 11 2026)
last_used: never
last_client: never
---

## Hero treatment
Dark `#010101` background, centered hero content with a gradient-filled main headline ("Your Vision / Our Digital Reality.") that uses a linear gradient from white to purple/pink as a `background-clip: text` fill. Above the headline, a glass announcement pill ("⚡ Used by founders. Loved by devs.") with a gradient-filled Zap icon box. Below, a soft subheading + a primary CTA pill ("Book a 15-min call") in white-with-black-text, wrapped in a glass-effect outer border. Below the hero, an HLS-streamed bottom video with `mix-blend-screen` so the video's black blends into the page background, plus a logo cloud strip (OpenAI / Nvidia / GitHub / etc.) on infinite scroll.

The signature is the gradient text-fill + glass cards + the `mix-blend-screen` video integration — three modern-tech techniques layered to create a "we know what's current" impression.

## Page layout
Centered single hero with a video that slips up behind the text via `-mt-[150px]` and `z-10` (text is `z-20`). The logo cloud below the video is a glass-style strip with `bg-black/20 backdrop-blur-sm`. On desktop, "Powering the best teams" text sits on the left with a vertical divider separating it from the infinite-scrolling logo slider; on mobile, it stacks vertically.

## Typography
- Display + body: modern sans-serif (Inter or similar — the prompt is non-prescriptive but "modern sans-serif")
- Main headline: responsive 48px mobile → 80px desktop
- Subheading: `text-white/80` — soft contrast
- Logo cloud labels: small, neutral

## Color palette
- Background: pure black `#010101`
- Primary text: white
- Body text: white at 80% opacity
- Primary gradient (for accents): diagonal `from-[#FA93FA] via-[#C967E8] to-[#983AD6]` (pink → magenta → purple)
- Headline text gradient: white → purple/pink (so the headline literally fades into the brand gradient mid-word)
- CTA primary: white background, black text — with a small gradient-filled circle-arrow icon inside
- Glass surfaces: `bg-[rgba(28,27,36,0.15)]` with subtle borders

## Visual motifs
- **Gradient text-fill on the main headline** (the signature) — `background-clip: text` with a white-to-purple gradient so the headline literally fades into brand
- **Announcement pill** with a gradient-filled Zap icon box and glow — small premium UI hovering above the headline
- **HLS video streaming background** (technical signal) with a fallback to MP4
- **`mix-blend-screen` video integration** — the video's black areas blend into the page bg, the brighter content shows through. The video slips behind the headline via negative top margin (`-mt-[150px]`).
- **Native `<video>` tag with custom hls.js useEffect** — NOT react-player (the prompt is explicit; using native + custom is the dev-credible move)
- **CTA pill with circle-arrow inside** — the arrow circle uses the brand gradient
- **Outer glass-effect border wrapper** around the CTA — premium "framed" button look
- **Infinite-scroll logo cloud** (using motion/react, react-use-measure) with logos forced to white via `brightness-0 invert`
- **Glass strip section divider** with `bg-black/20 backdrop-blur-sm` and a top border — separates logo cloud from hero cleanly

## When to use
- Dev agencies, design+dev shops, technical studios
- AI startups (the gradient palette + modern-tech techniques fit the category)
- Premium SaaS with a developer audience
- No-code studios, indie maker tools
- Fractional CTO / engineering leadership services
- Web3 / crypto-adjacent brands (the gradient palette is web3-coded)
- "For founders / for devs" positioning — the announcement pill's copy is the standard tell

## When to NOT use
- Brands whose audience finds gradient text-fill "AI-coded" (some segments now see white-to-purple gradient text as a tell of AI-generated landing pages)
- Local services / blue collar — wrong audience entirely
- Anyone whose brand color isn't purple/pink (you'd be swapping the entire signature)
- Conservative B2B (legal, financial, healthcare) — too maximalist
- Anyone without strong logo cloud names (the proof relies on the logos being recognizable)

## Build complexity
MEDIUM-HIGH complexity. The HLS streaming + custom video integration + `mix-blend-screen` + glass border-frame components + infinite scroller = real engineering. Quote as Tier 3 minimum, often Custom Build for production.

## Library cross-references
- Motif: `gradient-text-fill-headline`
- Motif: `gradient-filled-icon-box`
- Motif: `glass-announcement-pill`
- Motif: `mix-blend-screen-video`
- Motif: `hls-video-with-mp4-fallback`
- Motif: `cta-with-gradient-circle-arrow`
- Motif: `infinite-scroll-logo-cloud`
- Motif: `glass-strip-section-divider`
- Typography: `modern-sans-extra-bold-uppercase`
- Color palette: `pure-black-purple-pink-gradient`
