---
slug: draftworks-content-saas-scroll-zoom
name: Draftworks — Content SaaS Scroll Zoom
vibe: light, clean, scroll-linked, product-led, dashboard-forward
industries: content management saas, publishing tools, marketing platforms, editorial teams, social media tools, analytics products, workflow software, b2b saas
source: motionsites.ai archive (catalog title "Minimal Workflow SaaS", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
last_used: never
last_client: never
---

## Hero treatment
A light, product-led SaaS landing page where ONE viewport of scrolling drives the whole show. A fixed full-viewport video sits behind everything; a custom scroll hook maps the first 100vh of scroll to a 0→1 progress value, and that value drives three things at once: the background video zooms from 1x to 1.3x, the hero fades out fast (opacity = 1 − 2.5×progress) while drifting up 60px, and a showcase section fades and scales in (0.88→1.0) between 35% and 75% progress. The page feels like a camera push-in rather than a scroll.

The hero itself is centered text on the video: a three-line headline at up to 3.75rem tracking-tighter where the opening phrase sits in zinc-400 and the rest in gray-900, a short subcopy paragraph, then a stack of four frosted "popup cards" that animate in with a 150ms stagger — each a white/80 blurred pill-card holding an icon, a feature line, and a small forever-spinning gradient progress ring. The nav is a floating white/70 blurred pill with a four-petal logo, four gray links, and a "Get started" button whose 1.5px amber-to-blue gradient border is drawn with a masked ::before.

## Page layout
200vh total: section one is the hero over the fixed video; section two is a giant rounded media card (max-w-7xl, up to 680px tall) containing its own video with a bottom-up dark gradient, a left-aligned two-line pitch in white, and a fully hand-coded product dashboard sliding in from the right — top metric ("Total Reach 498,098"), a smooth cubic-Bézier area chart that draws itself with a dash-offset animation, a highlighted data point with tooltip, and a "Top Channels" list with colored badges, change percentages, and animated progress rings. The dashboard is code, not a screenshot, so every number and label is brandable.

## Typography
- Display + body: Inter (Google Fonts, weights 300-900) — headline at 2.25-3.75rem tracking-tighter font-medium, UI text from text-xs up; gray-900 on light, white inside the dark media card
- Hierarchy via grays: zinc-400 headline lead-in, gray-500 subcopy, gray-900 emphasis

## Color palette
- Page: white and gray-900 `#111827` text; chart ink `#1F2937`
- Gradient accents: `#F59E0B` amber to `#3B82F6` blue (button border, first card ring)
- Supporting data colors: emerald `#10B981`, cyan `#06B6D4`, sky `#0EA5E9`, red `#EF4444`, green `#34D399`
- Cards: `bg-white/80` with backdrop blur over the video; showcase overlay fades from black/90 to transparent

## Visual motifs
- **Scroll-zoom background** — one viewport of scroll zooms the fixed video 1x→1.3x while the hero hands off to the showcase
- **Scroll-progress crossfade** — hero fades out and drifts up as the next section fades and scales in, all from a single 0-1 progress value
- **Popup card stack** — four frosted feature cards that pop in staggered, each with an always-spinning gradient ring suggesting live work
- **Hand-coded dashboard** — a real React dashboard with a self-drawing area chart, tooltip, and animated progress rings instead of a product screenshot
- **Gradient-border button** — a white pill whose 1.5px amber-to-blue border is drawn by a masked pseudo-element
- **Floating pill nav** — white blurred capsule nav detached from the page top
- **Giant rounded media card** — section two is one oversized rounded-3xl card holding video, pitch, and dashboard together

## When to use
- Content management, publishing, and editorial workflow SaaS
- Marketing and social media platforms that want the product visible on screen two
- Analytics products — the coded dashboard can show real metric names
- B2B SaaS wanting light, Apple-adjacent polish instead of a dark hero
- Any product team that can fill a dashboard with believable numbers

## When to NOT use
- Companies without a product UI to show — the dashboard is the proof
- Service businesses and agencies; this is shaped around software
- Dark-brand products (use `bookedup-deep-shadow-saas` for dark SaaS)
- Long sales-letter pages — the scroll choreography owns the first 200vh and fights extra sections

## Build complexity
MEDIUM-HIGH. The scroll-progress system is simple, but the hand-coded dashboard (Bézier chart, tooltip, rings, staggered keyframes) is a day of detail work on its own.

## Library cross-references
- Motif: `scroll-zoom-fixed-video`
- Motif: `scroll-progress-crossfade`
- Motif: `popup-card-stagger-stack`
- Motif: `hand-coded-dashboard-proof`
- Motif: `gradient-border-button-mask`
- Motif: `floating-pill-nav`
- Typography: `inter-tight-gray-hierarchy`
- Color palette: `white-gray-amber-blue-gradient`
