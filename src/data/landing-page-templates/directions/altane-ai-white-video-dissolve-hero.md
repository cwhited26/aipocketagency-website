---
slug: altane-ai-white-video-dissolve-hero
name: Altane.ai — Monochrome SaaS / Video Dissolving into White
vibe: clean, monochrome, airy, staged, saas
industries: ai saas, productivity software, automation tools, team collaboration, aerospace tech, b2b software, workflow platforms, analytics tools
source: motionsites.ai archive (catalog title "Stellar AI — Hero Section", free tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: starter
last_used: never
last_client: never
---

## Hero treatment
A single-viewport, no-scroll white hero where the background video occupies only the lower half of the screen and dissolves upward into clean white. The video is pushed down with 120-200px of top padding, then three stacked white-to-transparent gradient overlays (one general, one desktop-only, one mobile-only, all pointer-events-none) melt its top edge into the page background. The result: crisp black-on-white marketing copy up top, cinematic motion below, no scrim compromise on either.

Copy is centered: a rating badge first (a small bordered square holding a filled star, next to "4.9 rating from 18.3K+ users"), then the headline at up to 80px normal weight with tight tracking — and the final line ("AI Powers You Up.") rendered as gradient text running black through gray-500 to gray-400. Mobile gets a three-line headline break, desktop two; the lines are authored per viewport. A gray-600 subheading and one black pill CTA ("Begin Free Trial") finish the stack. Every element enters with a staggered fade-up — delays stepping 0.1s through 0.6s, 30px rise, 0.6s ease-out.

Pinned to the bottom over the video: a frosted glass pill (`backdrop-blur` on 15% white with a 20% white border) carrying a one-line positioning claim, above five partner "logos" set as italic Georgia text in white — type masquerading as logo marks.

## Page layout
Strictly one screen, `h-screen overflow-hidden`, no scrolling. Navbar (max-w-7xl): star icon + wordmark left, four center links with dropdown chevrons, Login text + black pill CTA right; mobile collapses to a hamburger opening a white/95 blurred panel under the bar. Hero block in the upper-center, partner bar pinned absolute to the bottom edge. The palette is strictly monochrome — black, white, grays, zero color anywhere.

## Typography
- Display + body: Inter (Google Fonts, 400/500/600/700) — headline at normal (400) weight despite the 80px size, which keeps it light and modern
- Partner names in italic Georgia serif — intentional contrast against the Inter chrome

## Color palette
- Background: white `#ffffff`
- Text: black `#000000`, gray-700 `#374151` nav, gray-600 `#4b5563` subhead
- Headline gradient: black → gray-500 `#6b7280` → gray-400 `#9ca3af`, clipped to text
- Glass pill: `rgba(255,255,255,0.15)` with blur and 20%-white border
- No accent color — monochrome is the rule

## Visual motifs
- **Video dissolving into white** — stacked white gradient overlays melt the top of the background video into the page, splitting the screen into paper above and motion below
- **Monochrome gradient headline** — the punch line is gradient text from black to mid-gray; emphasis without introducing a color
- **Staggered fade-up entrance** — navbar, badge, headline, subhead, CTA, and partner bar rise in sequence at 0.1s steps; the page assembles itself once
- **Rating badge with boxed star** — a tiny bordered square holding a filled star next to a live-sounding rating line, leading the copy stack
- **Frosted pill over footage** — a blurred 15%-white pill floats on the video carrying the positioning one-liner
- **Serif-italic partner row** — partner names as italic Georgia text standing in for logo assets
- **Per-viewport headline breaks** — mobile gets three authored lines, desktop two; no awkward auto-wrap

## When to use
- AI and automation SaaS that wants clean credibility over dark-mode drama
- Productivity and collaboration tools aimed at mainstream business buyers
- Products with a strong abstract or aerial video to feature below the fold line
- Launch pages where one headline, one CTA, and social proof are the whole job
- Brands that photograph badly in dark themes — this is the light-mode counterpart

## When to NOT use
- Sites needing scroll content — the layout is locked to one viewport by design
- Brands whose identity needs color; the monochrome rule is load-bearing
- Footage with bright top edges — the white dissolve needs the video to cooperate where it fades
- Heavy-proof enterprise sales (case studies, feature grids) — use `gridwell-enterprise-tricolor-gradient`

## Build complexity
LOW complexity. One section, CSS keyframes only, no libraries beyond icons; the only finesse is tuning the three gradient overlays against the chosen footage.

## Library cross-references
- Motif: `video-dissolve-into-white`
- Motif: `monochrome-gradient-headline`
- Motif: `staggered-fade-up-entrance`
- Motif: `frosted-pill-over-footage`
- Motif: `serif-italic-partner-row`
- Typography: `inter-light-headline-georgia-accent`
- Color palette: `strict-monochrome-white-base`
