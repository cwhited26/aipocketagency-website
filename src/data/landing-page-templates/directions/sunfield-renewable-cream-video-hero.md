---
slug: sunfield-renewable-cream-video-hero
name: Sunfield — Renewable Energy / Cream Video Hero
vibe: warm, organic, calm, green-on-cream, single-screen
industries: solar installation, renewable energy, ev charging, sustainability consulting, green construction, agriculture tech, home energy services, climate tech, landscaping
last_used: never
last_client: never
source: motionsites.ai archive (catalog title "EcoVolta", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
---

## Hero treatment
Single-screen hero (full viewport height, no scrolling, `overflow-hidden`) for a renewable energy brand. The base is a warm cream `#F5F3EE`, with a full-page background video fixed behind everything. Centered content stack: a rounded pill badge with emoji bookends (sun → earth → "Delivering power innovate" → seedling), then the headline "Renewable Power For Tomorrow, Infinite Clean Solutions" in dark forest green, revealed letter by letter — each character fades in on a 0.03s stagger, 0.3s duration, triggered once in view. Subheading and CTAs follow on fade-down delays (0.5s, 0.7s).

Two pill CTAs carry the green identity: the primary "Explore Options" is a green gradient (`#3C684D` → `#4A7144`) with a Leaf icon on the left and a small circular gradient play button riding inside the pill on the right; the secondary is white with a gray-gradient circular arrow button. The pill-with-circular-icon-inside pattern is the button signature.

The corners do the storytelling: bottom-left a small white card with a map pin and a street address; bottom-center a liquid-glass circular play button ("Clean Power System" label); bottom-right three overlapping avatar circles with "+ 37k Deployments" and a row of small utility icons. A logo marquee of gray client names scrolls infinitely along the very bottom (30s loop desktop, 15s mobile) with gradient fades on both edges matching the cream.

## Page layout
One viewport, no scroll. Everything lives on a single composed screen: navbar, centered hero stack, three corner widgets, bottom marquee. The corner widgets drop progressively on smaller screens (address hidden below md, avatars below lg), leaving a clean centered column on mobile. Headline scales text-3xl mobile up to text-6xl at lg.

## Typography
- Display + body: Inter (Google Fonts, weights 300-900) — headline at font-normal (not bold), text-3xl up to text-6xl, leading-tight
- Headline color is dark forest green `#31463B`, not black — the type carries the brand color
- Subheading: gray-600, text-sm to text-lg, max-w-3xl centered

## Color palette
- Background: warm cream `#F5F3EE`
- Headline: dark forest green `#31463B`
- Primary CTA gradient: `#3C684D` → `#4A7144`, inner icon-circle gradient `#567A5E` → `#78A873`
- Secondary CTA: white with gray icon-circle gradient `#EEEEEE` → `#CBCBCB`
- Marquee names and subtext: gray-400 / gray-600
- Glass play button: near-transparent white with 4px blur and a gradient hairline border (mask-composite trick)

## Visual motifs
- **Letter-by-letter headline reveal** — each character fades in independently on a 0.03s stagger, 0.3s per letter, fired once on viewport entry
- **Pill buttons with a circular icon button inside** — the CTA is a rounded-full pill whose right edge holds a small gradient circle containing a Play or ArrowRight icon
- **Emoji-bookended badge pill** — rounded-full bordered pill with sun/earth/seedling emojis framing the tagline; text shortens on mobile
- **Corner widget composition** — address card bottom-left, glass play button bottom-center, avatar cluster + deployments count bottom-right; the hero reads like a dashboard collage over the video
- **Liquid-glass play button** — circular glassmorphism: near-zero white fill, 4px backdrop blur, inset highlight, gradient hairline border built with mask-composite exclude
- **Infinite logo marquee** — gray client wordmarks scrolling 0 to -50% on a linear loop, duplicated for a clean seam, with cream gradient fades on both edges
- **Overlapping avatar trio** — two 40px circles flanking a 64px center circle with a 4px white border, social proof with a stat line

## When to use
- Solar installers, renewable energy companies, EV charging networks
- Sustainability consultancies and climate tech startups
- Green construction, home energy retrofitting
- Agriculture tech and land-based businesses that want a warm, natural look
- Brands whose story fits one composed screen — a single message, not a long scroll

## When to NOT use
- Anyone needing multiple content sections — this is a one-screen layout with no scroll
- Brands without a quality background video; the cream-plus-video composition is the whole mood
- Dark, technical, or industrial brands (use `targo-logistics-dark-red-clipped`)
- Solar brands that want an interactive product story — `solar-energy-day-night-toggle` covers that

## Build complexity
MEDIUM. The letter-stagger headline, marquee loop, and glass button are each simple, but the corner widget composition takes layout care across breakpoints.

## Library cross-references
- Motif: `letter-stagger-headline-reveal`
- Motif: `pill-cta-with-inner-icon-circle`
- Motif: `liquid-glass-play-button`
- Motif: `corner-widget-collage`
- Motif: `infinite-logo-marquee-gradient-fades`
- Motif: `overlapping-avatar-social-proof`
- Typography: `inter-green-display`
- Color palette: `warm-cream-forest-green-gradient`
