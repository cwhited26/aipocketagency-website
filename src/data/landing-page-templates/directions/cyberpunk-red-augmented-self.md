---
slug: cyberpunk-red-augmented-self
name: Cyberpunk Red — Augmented Self
vibe: cyberpunk, technical, premium-tech, biotech, augmented, dark moody
industries: biotech, augmented reality, deep-tech, futurist consumer products, high-end technical services, gaming, performance brands
source: motionsites.ai (Cyberpunk hero prompt)
last_used: never
last_client: never
---

## Hero treatment
Full viewport hero with a RED-tinted portrait as the base image and a SECOND image revealed through a cursor-following spotlight mask. As the visitor moves their cursor, a soft circular hole opens in the base image and shows the alternate image underneath (canvas-based radial gradient mask). All hero text is bottom-anchored, left-aligned, layered over the imagery. A decorative SVG arc with three stats sweeps in from the right side along concentric arcs (stroke-draw animation on load).

## Page layout
Single viewport hero (`100dvh`). Layers in z-index order:
1. SVG grid background (z-0, 48px square pattern, parallax-shifts with cursor)
2. Base image with Ken Burns zoom-out intro (z-10)
3. Cursor spotlight reveal layer (z-30)
4. Decorative arc stats sweeping from the right (z-50)
5. Bottom-anchored hero text block + CTA (z-50)
6. Centered black pill navbar at the top (z-50)

## Typography
- Display + body: JetBrains Mono — globally applied (`* { font-family: 'JetBrains Mono', monospace; }`), weights 300/400/500/600/700/800 + italic 400/500
- Hero heading: `text-4xl sm:text-5xl md:text-6xl`, `leading-[1.05]`, `tracking-[-0.08em]`, white
- Eyebrow: `text-[11px] sm:text-xs`, font-semibold, `tracking-[0.12em]`, with one italic phrase ("Gateway to your *augmented self*")
- Tracking: globally tight at `tracking-[-0.02em]` on the root wrapper

## Color palette
- Background: red-tinted imagery provides the dominant warmth
- Primary text: white (with `text-white/90` for de-emphasized body)
- CTA: white pill (`bg-white`) with `text-gray-900`, shine sweep on hover
- Navbar: `bg-black/60 backdrop-blur-md` floating centered pill
- Stats arc: white strokes/text at varying opacity (0 → 0.5 → 0.1 → 0 across the arc)
- Accent on grid: `stroke: #64748b` at 0.1 opacity (very subtle slate)

## Visual motifs
- **Cursor spotlight reveal** (the headline mechanic) — base image is fully visible, a soft 260px-radius circular gradient mask reveals a SECOND image underneath wherever the cursor goes. Implementation uses a hidden canvas that renders a radial gradient each frame (`toDataURL` → applied as `maskImage`/`webkitMaskImage` on the reveal div). Cursor position is smoothed via rAF lerp at 0.1 factor.
- **Parallax grid background** — SVG pattern of 48px squares whose x/y offset follows the cursor (target = `(normalized cursor − 0.5) × 16px`, eased at 0.06 per frame)
- **Decorative concentric arc stats** — three SVG arcs at radii 330/395/460, centered off-canvas left, sweep across the right portion. Each arc has a per-arc `userSpaceOnUse` linearGradient (white with stop-opacities 0 → 0.5 → 0.5 → 0.1 → 0 so both ends fade). Stroke-draw animation on load (1.6s `cubic-bezier(0.65,0,0.35,1)`, delays staggered 0.4s + i × 0.22s). Each arc has a dot, ring (infinite pulse), number, and uppercase label.
- **Hanging centered nav pill** with logo + 5 links + dark CTA
- **CTA shine sweep** — pseudo-gradient span translates from `-translate-x-full` to `translate-x-full` over 700ms on group hover
- **Ken Burns intro** on base image (`scale 1.12 → 1.0` over 2.4s `cubic-bezier(0.22,1,0.36,1)`)
- **Blur-rise hero text intro** (`heroReveal` keyframe: opacity 0 + y 26px + blur 8px → clear)

## When to use
- Biotech / health-tech / deep-tech startups
- Augmented reality, VR, gaming brands
- Performance / athletic-tech brands (high-end gear)
- Futurist consumer products
- Premium technical services (security firms, intelligence consultancies)
- Anything where the visitor's first emotional response should be "this looks like the future"
- Hanes Environmental tier (technical restoration positioned as evidence-based + precise)

## When to NOT use
- Local trades — the cursor mechanic is too clever, visitors come to convert
- Family-friendly services (childcare, education, family-owned shops) — wrong emotional register
- Restoration / emergency services — too slow to load, too clever
- Health/medical that needs to feel approachable (this feels clinical-cold)
- Any business whose customer base is over 55 or non-technical

## Reference source
motionsites.ai Cyberpunk hero prompt — extracted 2026-06-11.

## Library cross-references
- Motif: `cursor-spotlight-reveal-canvas-mask` (the star mechanic)
- Motif: `parallax-grid-svg-pattern`
- Motif: `concentric-arc-stats-fading`
- Motif: `cta-shine-sweep`
- Motif: `ken-burns-intro-on-base-image`
- Typography: `jetbrains-mono-mono-everywhere`
- Color palette: `red-tinted-white-text-tech`
