---
slug: plannery-glass-orb-light-saas
name: Plannery — Task SaaS / Glass Orb on White
vibe: light, glassy, blue, friendly, product-led
industries: task management, project management, team collaboration, productivity saas, scheduling tools, crm software, hr software, small-business software
source: motionsites.ai archive (catalog title "Taskora SaaS Hero", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
last_used: never
last_client: never
---

## Hero treatment
A white two-column SaaS hero whose right side is a massive glass orb — a looping video of a translucent sphere, scaled to 125% so it bleeds off-frame, composited onto the white page with `mix-blend-screen` to erase its black background. A CSS filter chain (`hue-rotate(-55deg) saturate(250%) brightness(1.2) contrast(1.1)`) regrades the source asset into an electric brand blue that exactly matches the CTA, so one stock orb becomes an on-brand centerpiece. Behind the content, soft blurred ellipses in light blues (`#60B1FF`, `#319AFF`) glow from the top-left corner of the page.

The left column is a classic conversion stack with unusually finished details: a social-proof badge with five orange `#FF801E` stars ("Rated 4.9/5 by 2700+ customers"), a 75px Fustat Bold headline ("Work smarter, achieve faster") at 1.05 leading and -2px tracking, an 18px Inter subheadline, and the primary CTA — a translucent blue pill (`rgba(0,132,255,0.8)`) with its own 2px backdrop blur, an inset white top-highlight shadow, a white circular arrow icon, and a 1.02 scale lift on hover. The button itself is a piece of glass.

The navbar is the "strong liquid glass" element: sticky at 30px from the top, width-fit and centered, 50px backdrop blur over 30% white, rounded-16px, with a 1px 10%-black outer stroke plus an inset white highlight along the top edge — it reads as a physical slab of frosted glass floating over the page as you scroll.

## Page layout
Hero plus a trust footer in one composition, 1600px max width, single column on mobile with the orb scaling down behind or below the copy. Bottom of the hero carries a "Trusted by" strip of five grayscale logos at wide 100px gaps. The glow ellipses, glass nav, glass button, and orb all share the same blue family, so the page feels lit by one light source.

## Typography
- Display: Fustat (Google Fonts, Bold) — 75px headline, 1.05 leading, -2px tracking; also the wordmark
- Body: Inter (Google Fonts, Normal/Medium) — 18px subheadline with -1px tracking, nav links, badge text

## Color palette
- Background: white with blurred glow ellipses `#60B1FF` and `#319AFF` top-left
- Primary CTA: translucent electric blue `rgba(0,132,255,0.8)`
- Star rating: orange `#FF801E`
- Glass nav: `rgba(255,255,255,0.3)` at 50px blur, 1px `rgba(0,0,0,0.1)` stroke, inset white highlight
- Text: near-black headlines, gray body, grayscale partner logos

## Visual motifs
- **Color-graded glass orb** — a stock orb video regraded to brand blue with a CSS filter chain and composited via `mix-blend-screen`, scaled past the frame edge; centerpiece imagery with zero custom 3D work
- **Frosted slab navbar** — sticky width-fit pill at 50px blur over 30% white, with an outer hairline stroke and an inset top highlight that sell it as physical glass
- **Glass CTA button** — the primary button is itself translucent and blurred with an inset highlight, matching the nav material
- **Corner glow ellipses** — large blurred light-blue shapes in the top-left give the white page depth without a pattern or texture
- **Orange five-star badge** — warm `#FF801E` stars as the single non-blue accent, leading the copy stack
- **Wide-gap grayscale logo strip** — five desaturated partner marks at 100px spacing as the page's quiet footer proof

## When to use
- Task, project, and scheduling SaaS aimed at teams and small businesses
- Products that want a hero visual but have no screenshots or 3D budget — the regraded orb fills the slot
- Light, friendly B2B brands where dark mode would feel off
- Pages whose one job is the trial signup: badge, headline, one button
- Brands already blue, or flexible enough to let blue lead

## When to NOT use
- Brands locked to a non-blue palette — the orb regrade, glows, and CTA are tuned as one blue system
- Heavy enterprise sales needing proof sections and feature depth (use `gridwell-enterprise-tricolor-gradient`)
- Audiences on old browsers — `mix-blend-screen` plus heavy backdrop blur degrades without support
- Anyone who wants the orb to mean something specific; it is mood, not product

## Build complexity
MEDIUM complexity. Layout is a standard two-column hero, but the blend-mode compositing, filter color-grade, and three-layer glass treatments need tuning per display to avoid a washed-out result.

## Library cross-references
- Motif: `blend-mode-color-graded-orb`
- Motif: `frosted-slab-navbar`
- Motif: `glass-cta-button`
- Motif: `corner-glow-ellipses`
- Motif: `five-star-rating-badge`
- Typography: `fustat-inter-tight`
- Color palette: `white-electric-blue-orange-stars`
