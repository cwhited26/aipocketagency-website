---
slug: astrane-space-consultancy-slide-sections
name: Astrane — Space Engineering / Button-Driven Slide Sections
vibe: cinematic, technical, monochrome, architectural, controlled
industries: aerospace consulting, space engineering, defense tech, satellite services, engineering consultancies, r&d firms, advanced manufacturing, technical advisory
last_used: never
last_client: never
source: motionsites.ai archive (catalog title "Orbit Engineers", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
---

## Hero treatment
A single page made of THREE full-screen hero sections that the visitor moves between with buttons — no scrolling at all. Each section has its own full-screen background video; the three videos are stacked fixed behind the content and crossfade (opacity transition, 700ms) as the active section changes. Section transitions are cinematic framer-motion choreography: content enters with opacity 0→1, scale 1.05-1.08→1, and a blur that resolves from 10-14px to sharp (0.8-0.9s, ease [0.22, 1, 0.36, 1]); exits push content up 60-80px while re-blurring. The page feels like a film with three scenes, not a website.

Section 0 is the landing: a centered three-line tactical-excellence headline at restrained scale with -3px letter-spacing, framed by two thin decorative vertical lines on the page edges, plus a "Scroll to explore" button with a bouncing chevron. Section 1 is the mission statement: a left-aligned light-weight heading, a centered white pill CTA in uppercase 0.25em tracking, and a right-side vertical dot progress column — the three elements slide in from left, bottom, and right on staggered delays. Section 2 is a service detail: a monospace section number "01", a light heading, and a monospace description paragraph, with Back and "Reach Out +" controls.

## Page layout
One viewport, three states. A useState index with next/prev handlers drives everything; AnimatePresence mode="wait" sequences exit-then-enter. The nav is always visible: a stacked three-line wordmark left, three uppercase tracking-widest links center, and geographic coordinates in monospace right (51.50732 N / -0.12765 W) — the coordinates are a strong character detail. Each section has its own bottom bar of navigation controls. Mobile stacks section 1's row into a column.

## Typography
- Display + body: Inter (Google Fonts, weights 300-700) — headings at font-light or font-normal with negative letter-spacing (-2px to -3px) for an architectural feel
- Technical text (coordinates, section numbers, descriptions) in a monospace stack with wide tracking (0.15-0.3em) — the mono/sans contrast is the typographic signature
- Uppercase + tracking-widest on all nav and control text

## Color palette
- Base background: dark blue-gray `#20303f` (hsl 210 33% 19%), invisible in practice behind the videos
- Foreground: white `#ffffff` everywhere, dimmed to 60-70% for secondary text
- Accent: cyan `#3cc1f5` (hsl 199 89% 60%) available but used sparingly
- CTA pills invert: white background, dark text

## Visual motifs
- **Button-driven scene navigation** — three full-screen sections traversed by next/prev buttons instead of scroll; an animation lock prevents double-fires
- **Crossfading fixed video stack** — all three videos render fixed at -z-10; only the active one is opacity-100, swapping over 700ms
- **Blur-resolve transitions** — sections enter blurred (10-14px) and oversized (scale 1.05-1.08), resolving to sharp; exits re-blur and lift away
- **Edge rule lines** — thin vertical lines pinned near the left and right viewport edges, framing the centered content like a technical drawing
- **Monospace data layer** — coordinates, section numbers, and descriptions in mono with wide tracking, reading as instrument readouts
- **Uppercase pill CTA with wide tracking** — white rounded-full button, 0.25em letterspacing, scales to 105% on hover
- **Vertical dot progress column** — four stacked dots (first filled) marking position in the narrative
- **Bouncing chevron prompts** — animated ChevronDown icons cueing the visitor to advance

## When to use
- Aerospace, satellite, and space-sector consultancies
- Defense and advanced engineering firms that want a controlled, cinematic pitch
- Technical advisory brands with 2-4 strong statements and little body copy
- Companies with high-grade atmospheric video (launches, orbits, facilities)
- Brands that want the site to feel like a presentation, not a brochure

## When to NOT use
- Anyone with real content depth — three screens hold three ideas, nothing more
- SEO-driven strategies; button-state content is thin for crawlers
- Visitors who expect normal scrolling — the interaction model surprises people
- Conversion-heavy landing pages with forms and pricing (use `bookedup-deep-shadow-saas`)

## Build complexity
MEDIUM. The state machine and AnimatePresence choreography are clean to build, but tuning three videos plus blur transitions to feel cinematic rather than laggy takes iteration.

## Library cross-references
- Motif: `button-driven-scene-navigation`
- Motif: `crossfading-fixed-video-stack`
- Motif: `blur-resolve-section-transition`
- Motif: `edge-rule-framing-lines`
- Motif: `monospace-data-layer`
- Motif: `uppercase-tracked-pill-cta`
- Typography: `inter-light-negative-tracking-mono-contrast`
- Color palette: `dark-bluegray-white-cyan-restrained`
