---
slug: keyhaven-password-icon-headline
name: Keyhaven — Security App with Icon-Studded Headline
vibe: light, friendly-security, purple-accented, app-forward, crisp
industries: password managers, security apps, consumer fintech, privacy tools, identity protection, vpn services, insurance tech, utility apps
source: motionsites.ai archive (catalog title "VaultShield", free tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: starter
last_used: never
last_client: never
---

## Hero treatment
A light hero over a full-viewport looping background video (`/placeholder-hero.mp4`, soft enough to carry dark text). The signature is the headline itself: small Lucide icons EMBEDDED MID-SENTENCE, inline with the words — a lightning bolt between "Lock" and "Down", a keyhole padlock before "Passwords", a fingerprint closing the second line — each 24px, baseline-nudged -2px, in the same ink color as the type. The headline reads like an app interface speaking, not a poster. Size is `clamp(1.65rem, 5vw, 3rem)`, line-height 1.05, centered, in a heavy display cut.

Below: a calm support line at 80% opacity ("Zero stress, total control" register, max 560px), then one purple pill CTA — "Get It Free" with an arrow-circle icon pushed to the far edge by `justify-between` and a 32px gap, glowing with `0 4px 24px rgba(115,66,226,0.28)`. All three elements share one fadeUp variant (y28 to 0, 0.6s, ease `[0.22,1,0.36,1]`) at 0.15s stagger steps.

## Page layout
Single hero viewport, 1280px max width. Navbar: a geometric interlocking SVG logo mark left (32px, single ink color), five short links center, and a pill pair right — purple "Start For Free" and putty-gray "Sign In". Mobile gets a slide-in sheet done properly: a blurred dark backdrop, a warm gray `#CFC8C5` panel sliding from the right (min(88vw, 360px)) on a `[0.22,1,0.36,1]` curve, links staggering in from the right at 0.07s steps, and the same two CTAs full-width at the bottom.

## Typography
- Display: Archivo Black (substitute for the prompt's Helvetica Now Display Bold) — the icon-studded headline
- Body: Inter (Google Fonts, weights 300-900) — support copy, nav, buttons
- Headline letter-spacing -0.01em; support line 1.65 line-height

## Color palette
- Ink: deep slate-navy `#192837` (text, logo, inline icons)
- Accent: violet-purple `#7342E2` (primary CTAs, button glow)
- Secondary button surface: warm off-white `#F2F2EE`
- Mobile sheet: warm gray `#CFC8C5`
- Backdrop: `rgba(25,40,55,0.35)` with 4px blur

## Visual motifs
- **Icons inside the headline** (the signature) — small line icons sit inline mid-sentence, baseline-aligned with the display type, turning the headline into an interface-flavored rebus
- **Purple glow CTA** — the primary pill carries a soft colored shadow of its own fill (`rgba(115,66,226,0.28)`), with the arrow icon pushed to the opposite edge
- **Geometric interlock logo** — a single-color SVG mark built from interlocking angular shapes, used at 32px in nav and sheet
- **Warm-gray slide sheet** — the mobile menu is a tactile `#CFC8C5` panel with staggered link entrances and spring-tap close button, not a generic overlay
- **Two-pill button system** — every CTA pair is purple-solid plus putty-neutral, identical radius and sizing, desktop and mobile alike
- **Shared fadeUp cadence** — headline, support, CTA arrive on one variant at 0.15s steps

## When to use
- Password managers, privacy tools, and consumer security apps that want to feel friendly, not fear-driven
- Freemium apps where "Get It Free" is the one honest CTA
- Consumer fintech and identity products needing trust plus approachability
- Brands with one accent color and the discipline to use it only on buttons
- Quick single-viewport launches with a strong app icon and download motion

## When to NOT use
- Enterprise security buyers — the playful inline icons read consumer
- Brands without calm, light footage; dark or busy video kills the ink-on-video text
- Long sales pages needing threat education and feature depth — this is one screen
- Anyone wanting a dark cyber aesthetic (use `cyberpunk-red-augmented-self` for that register)

## Build complexity
LOW — static hero with framer-motion variants; the inline-icon headline and the mobile sheet are the only fiddly parts, both contained.

## Library cross-references
- Motif: `icons-inside-the-headline`
- Motif: `colored-glow-cta`
- Motif: `warm-gray-slide-sheet`
- Motif: `two-pill-button-system`
- Motif: `geometric-interlock-logo`
- Typography: `archivo-black-inter-app`
- Color palette: `slate-navy-purple-putty`
