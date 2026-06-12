---
slug: northcircle-investor-club-glass-stats
name: Northcircle — Private Investor Club / Glass Stats Bar
vibe: exclusive, light-on-video, confident, minimal, members-only
industries: investor clubs, private communities, venture syndicates, wealth management, mastermind groups, member networks, founders clubs, financial advisory
last_used: never
last_client: never
source: motionsites.ai archive (catalog title "ClubX Investors", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
---

## Hero treatment
Single full-screen hero for a private members club. A looping background video fills the viewport; unusually, the foreground type is DARK — near-black gray-900 headline and gray-800 subtext sitting directly on the footage — which only works over bright, washed-out video and instantly separates this from the white-text-on-dark-video crowd. The headline is a three-word cadence ("Finance. Freedom. Fellows.") in bold Inter at up to 4.9rem, 0.95 line-height, -1.5px tracking.

Above it, a social-proof pill: five overlapping avatar circles in a frosted capsule (white at 20% with backdrop blur and a faint dark border) plus "400+ tech investors join the club." The CTA is a black pill ("Begin Journey") that scales to 103% on hover and 97% on press. Pinned at the bottom center is the second signature: a frosted stats bar — a rounded-3xl glass strip with four columns of large light-weight white numbers (410+, €11M, 14, 2.5) over small 70%-white labels. Entrance is a simple staggered fade-rise: 24px up over 0.8s, with the description and button trailing at 0.2s and 0.4s.

## Page layout
One screen, three zones: centered max-w-7xl nav (circular logo mark left, five links center, black pill CTA right), centered hero stack (badge, headline, subtext, CTA), and the absolutely-positioned bottom stats bar. min-h-screen with overflow hidden; a deep navy fallback color sits behind the video. Mobile hides the nav links and lets the stats bar columns tighten.

## Typography
- Display + body: Inter (Google Fonts, weights 400/500) — bold for the headline, regular elsewhere
- Headline: text-5xl to ~4.9rem, leading-[0.95], tracking -1.5px
- Stat numbers: text-3xl/4xl at font-light — the weight contrast against the bold headline reads as quiet confidence

## Color palette
- Headline ink: gray-900 `#111827` directly over video
- Subtext: gray-800; stats labels white at 70%
- CTA: black pill `#111827` with white text
- Glass surfaces: white at 10-20% opacity with backdrop blur and `rgba(17,24,39,0.1)` borders
- Fallback background: deep navy `#003042` (hsl 201 100% 13%)

## Visual motifs
- **Dark text on bright video** — near-black headline straight on the footage, no scrim; demands light, airy video and signals editorial confidence
- **Avatar-cluster social proof pill** — five overlapping member photos with -10px spacing inside a frosted capsule, one line of member-count copy
- **Frosted bottom stats bar** — a rounded-3xl backdrop-blur strip pinned bottom-center with four big light-weight numbers and small labels
- **Three-word period headline** — short punctuated cadence instead of a sentence
- **Scale-on-press pill buttons** — black pills that grow 3% on hover and compress 3% on click
- **Staggered fade-rise entrance** — badge/headline first, description +0.2s, button +0.4s, all rising 24px

## When to use
- Private investor clubs, venture syndicates, and angel networks
- Membership communities and masterminds selling exclusivity with proof
- Wealth-management brands that want modern restraint instead of mahogany
- Any "join us" page where member count and track-record numbers are the pitch
- Brands with bright, premium lifestyle footage (events, cityscapes, offices)

## When to NOT use
- Dark or moody video assets — the dark-on-video text becomes unreadable
- Content-rich sites; this is one screen with one action
- Mass-market consumer products — the exclusivity framing reads wrong
- Anyone who can't show real numbers; an empty stats bar undercuts the whole pitch

## Build complexity
LOW. One screen, CSS keyframe entrances, two frosted surfaces; the only assets that matter are the video and five avatar photos.

## Library cross-references
- Motif: `dark-text-on-bright-video`
- Motif: `avatar-cluster-proof-pill`
- Motif: `frosted-bottom-stats-bar`
- Motif: `scale-on-press-pill-cta`
- Motif: `staggered-fade-rise-entrance`
- Typography: `inter-bold-tight-light-stats`
- Color palette: `gray-900-on-video-frosted-white`
