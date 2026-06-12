---
slug: pressline-pr-saas-gauge-dashboard
name: Pressline Software — PR SaaS / Rounded Frame / Gauge Dashboard
vibe: light, rounded, product-forward, orange-accent, calm
industries: pr agencies, marketing software, agency management, analytics tools, crm, b2b saas, media monitoring, productized services
source: motionsites.ai archive (catalog title "Convix Software — SaaS", free tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: starter
last_used: never
last_client: never
---

## Hero treatment
The whole hero lives inside one giant rounded container — the page is a light gray `#ededed` canvas with 12-16px of padding, and everything (background video, navbar, headline, dashboard preview) is clipped by a single `rounded-3xl overflow-hidden` frame that fills the viewport minus that padding. A full-bleed background video runs behind everything with a thin `bg-white/10` wash on top, so the content stays dark-on-light. Centered content stack: a small white badge pill with an orange dot, then the headline at `clamp(36px, 8vw, 72px)` — Inter at weight 500 with one word swapped into Instrument Serif italic ("Shaping *Agencies* of tomorrow" pattern) — then a one-line subtitle and a dark navy pill CTA ending in a translucent circle holding a chevron.

Below the copy sits the signature element: a cream dashboard-preview tray (`#f5f2ee`, rounded-3xl) holding three white stat cards. Because the outer frame clips everything together, the cards bleed off the bottom edge of the hero — the product is half-revealed, which pulls the eye down without any animation. There are no custom animations at all; the looping muted video is the only motion.

## Page layout
Single full-viewport hero. Navbar is a floating white pill (max 760px, shadow, hairline border) centered near the top: orange 8-petal flower logo mark on the left, four small links center, a shopping-cart icon plus an orange rounded CTA on the right. Under `md` it collapses to a hamburger that opens a white rounded dropdown panel. The dashboard grid steps 1 → 2 → 3 columns across breakpoints; headline and CTA scale with `clamp()`.

## Typography
- Display + body: Inter (Google Fonts, weights 400/500/600/700) — headline at weight 500, `letter-spacing: -0.02em`, line-height 1.05
- Accent: Instrument Serif (regular + italic) — one italic serif word inside the headline
- Dashboard cards run small: 13px headers, 28px stat numbers, 11px trend pills

## Color palette
- Page background: `#ededed`; hero container base: `#d9d9d9`
- Dashboard tray: `#f5f2ee` (warm cream)
- Primary orange: `#ef4d23` — logo, card headers, gauge fill, save button, nav CTA
- Dark CTA: `#0b0f1a` (near-black navy)
- White cards and navbar pill on top of everything

## Visual motifs
- **One rounded frame clips the whole hero** — video, nav, content, and dashboard all live inside a single `rounded-3xl overflow-hidden` container with gray page padding around it; the dashboard cards bleed off the clipped bottom edge
- **Floating pill navbar** — white rounded-full bar with shadow and hairline border; collapses to a hamburger dropdown panel on mobile
- **Petal-flower logo mark** — 8 small circles arranged around a center circle, in brand orange
- **Serif italic accent word** — one word of the sans headline set in Instrument Serif italic
- **Tick-mark gauge** — SVG half-circle gauge built from 40 radial tick lines across a 180° arc; active ticks fill in orange, inactive stay gray, percentage in the center
- **Trend + toggle pills** — red/neutral stat pills with trending arrows, and a segmented two-option toggle (active option gets a white card + shadow)
- **Dashboard tray bleed** — cream tray of three white cards (stats, a settings form, a second gauge) half-cut by the hero's bottom edge
- **White-wash video overlay** — `bg-white/10` over the video keeps the light theme readable without killing the footage

## When to use
- PR agencies, marketing agencies, and the software that serves them
- B2B SaaS where the dashboard IS the product — the half-revealed preview does the selling
- Brands that want light, calm, and rounded instead of dark and dramatic
- Analytics, reporting, or CRM tools with real screenshots to show
- Teams that want motion in the hero without building any animation — the video carries it

## When to NOT use
- Brands with no product UI to preview — the dashboard tray is the centerpiece
- Dark-brand companies (security, finance-serious) — the light wash reads too soft; see `bookedup-deep-shadow-saas`
- Local service businesses where a phone call is the conversion (use `trades-phone-first-emergency`)
- Anyone whose accent color fights orange — the orange is threaded through logo, gauges, and buttons

## Build complexity
LOW. No scroll JS and no animation framework — the only custom piece is the tick-mark gauge SVG, which is a single reusable component. The clipping frame and dashboard cards are plain Tailwind.

## Library cross-references
- Motif: `rounded-frame-clips-entire-hero`
- Motif: `dashboard-cards-bleed-off-edge`
- Motif: `tick-mark-arc-gauge`
- Motif: `floating-pill-navbar`
- Motif: `serif-italic-accent-word`
- Typography: `inter-instrument-serif-accent`
- Color palette: `light-gray-cream-orange-navy`
