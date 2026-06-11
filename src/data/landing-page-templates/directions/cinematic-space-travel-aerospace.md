---
slug: cinematic-space-travel-aerospace
name: Cinematic Space Travel — Aerospace / Premium Tech
vibe: cinematic, premium-tech, aerospace, expansive, liquid-glass, italic-serif accent
industries: aerospace, premium tech, biotech with premium framing, futurist consumer products, premium experiences, luxury travel, futurist hospitality, premium AI brands
source: motionsites.ai (Cinematic Brand prompt — actual brand: "Vela/Apex/Orbit aerospace collective" — extracted Jun 11 2026)
last_used: never
last_client: never
---

## Hero treatment
Two full-viewport sections with looping background videos, custom-JavaScript crossfade transitions (NOT CSS transitions — every fade is rAF-driven), and a shared LIQUID-GLASS design system. Section 1 is the hero with a Mars / aerospace background video; section 2 is "Capabilities" with three feature cards. The signature visual element is the **liquid-glass chrome** — translucent surfaces with subtle inset gradient borders that look like polished glass over the video.

The brand is an aerospace collective ("Aeon · Vela · Apex · Orbit · Zeno") with a tagline about "Maiden Crewed Voyage to Mars Arrives 2026." Every italic serif element uses Instrument Serif; body text uses Barlow.

## Page layout
Two black-background sections, each min-h-screen. Section 1 holds the navbar, hero content (badge → headline → subheading → CTA pair → stats row), and a partners row at the bottom. Section 2 holds a kicker label, a two-line italic headline, and a three-card capabilities grid. All overlaid on full-bleed video without dark overlay — the contrast comes entirely from the liquid-glass chrome.

## Typography
- Display: Instrument Serif (Google Fonts, ital@0;1) — ALWAYS italic in use. Used for hero headline, large numbers, brand wordmarks, and section headings.
- Body + nav: Barlow (weights 300/400/500/600)
- Headline sizing: `text-6xl md:text-7xl lg:text-[5.5rem]` with `tracking-[-4px]` (very tight)
- Tracking: heavy negative letter-spacing on display (`tracking-[-4px]`, `tracking-[-3px]`, `tracking-[-1px]`)

## Color palette
- Background: pure black (`#000`)
- Primary text: white throughout (no gradient, no green, no other accent colors)
- De-emphasized body: `text-white/90`, `text-white/80`
- Liquid-glass surfaces: `background: rgba(255,255,255,0.01); background-blend-mode: luminosity; backdrop-filter: blur(4px)` (light) or `blur(50px)` (strong)
- Liquid-glass border: 1.4px linear-gradient mask (top/bottom highlights at 0.45 opacity, fading to 0 in the middle)
- CTA primary uses `liquid-glass-strong` (heavier blur + box-shadow)
- CTA solid button: `bg-white text-black` for the small "Claim a Spot" navbar action

## Visual motifs
- **Liquid-glass utility system** (the signature) — two variants (`.liquid-glass` and `.liquid-glass-strong`) with inset gradient borders that mimic polished glass. Used on navbar pill, badge, stat cards, CTA, and feature cards.
- **Custom rAF-driven video crossfade** — videos do NOT loop natively. Custom `FadingVideo` component reads current opacity from `video.style.opacity` so each new fade resumes from wherever the last one left off. On `timeupdate`, when `duration - currentTime <= 0.55s`, triggers `fadeTo(0)`. On `ended`, resets `currentTime = 0` and fades back to 1. Result: smooth crossfade loop with NO visible cut.
- **Word-by-word BlurText animation** (the headline reveal) — IntersectionObserver at 10% visibility. Each word splits into a `motion.span` with three-step keyframes: `blur(10px) opacity 0 y 50 → blur(5px) opacity 0.5 y -5 → blur(0px) opacity 1 y 0`. Stagger: `delay = (i * 100) / 1000s`. Letter-spacing `-4px` eats the natural space, so explicit `marginRight: 0.28em` is used between words.
- **Italic serif as DESIGN, not accent** — the entire headline is italic serif. Italic isn't a small flourish here; it's the primary display register.
- **Liquid-glass badge pill** with embedded white "New" chip — pill-within-a-pill announcement
- **Liquid-glass stat cards** with italic-serif numbers (`text-4xl`, `tracking-[-1px]`) and Material Icons SVG icons
- **Material Icons (not Lucide)** for the feature card icons — different visual register from the rest of the library
- **Partners row** as a flat list of italic serif wordmarks ("Aeon · Vela · Apex · Orbit · Zeno") — feels like the credits at the end of a film
- **No CSS transitions on the videos** — every animation is JavaScript-driven (rAF for fade, motion components for entrance)

## When to use
- Aerospace, space-tech, premium science brands
- Premium tech with a cinematic story (the brand is selling experience, not features)
- High-end consumer products with luxury aspirations (premium audio, watches, automotive)
- Futurist hospitality (space hotels, Antarctic expeditions, luxury cruise, eco-tourism)
- Premium AI brands wanting to feel like Apollo program, not OpenAI
- Brands that benefit from the "Hollywood movie credits" vibe (italic serif wordmarks)
- Hanes Environmental tier if rebranded around the discovery/exploration angle

## When to NOT use
- Anyone without exceptional video assets — the entire direction depends on great background footage
- Local services / blue collar — wrong audience, wrong register
- Conversion-driven landing pages — too slow to take in
- E-commerce — the liquid-glass chrome competes with product photography
- Anyone whose brand is allergic to italic serif (some clients see it as "fancy" in a bad way)
- Anyone with strict performance budgets — the custom rAF crossfade + Framer Motion + liquid-glass blurs are expensive

## Reference source
motionsites.ai "Cinematic Brand" prompt — builds a space-travel aerospace collective. Extracted Jun 11 2026. Uses CDN-only React 18 + Tailwind via CDN + Framer Motion via CDN (not a standard Vite build), so a real production version would migrate to a normal Vite + npm install.

## Library cross-references
- Motif: `liquid-glass-utility-system`
- Motif: `raf-driven-video-crossfade`
- Motif: `word-by-word-blur-text-reveal`
- Motif: `italic-serif-as-display-register`
- Motif: `partners-as-film-credits`
- Typography: `instrument-serif-italic-barlow`
- Color palette: `pure-black-white-liquid-glass-chrome`
