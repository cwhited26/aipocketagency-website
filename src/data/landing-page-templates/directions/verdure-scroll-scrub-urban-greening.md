---
slug: verdure-scroll-scrub-urban-greening
name: Verdure — Scroll-Scrubbed Video / Urban Greening
vibe: cinematic, organic, scroll-driven, oversized-type, dark
industries: landscape architecture, urban design, biophilic design studios, green infrastructure, sustainability consultancies, real estate developers, architecture firms, environmental nonprofits
source: motionsites.ai archive (catalog title "Urban Jungle", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
last_used: never
last_client: never
---

## Hero treatment
The scroll bar is the video's playhead. A fixed full-screen background video (`/placeholder-hero.mp4`, HLS at forced highest quality, scaled 1.35x) does not autoplay — GSAP ScrollTrigger scrubs its `currentTime` to match scroll progress across a 500vh page, with seek-throttling (only seek again once the previous `seeked` event fires) so the decoder never chokes. The video wrapper also drifts up to 30px against the mouse (1.5s power2 tween), so the frame floats even when scroll is parked. A black loading overlay shows "Loading... {percent}%" until the stream can play.

Over the video, a giant two-line display headline ("Unleash The / Full Power") sits anchored to the bottom of the viewport at `clamp(4rem, 15vw, 317px)`, line-height 0.85, in a warped specialty display face. As you scroll, the headline tears itself apart character by character — each letter tweens to `yPercent: 250`, scaleY 1.2, opacity 0, with 0.05 stagger and `scrub: 1.5` — the words fall away as the film advances. At page bottom, a frosted-glass About panel (max 1250px, rounded-3xl, `rgba(0,0,0,0.16)` fill with 160px backdrop blur) slides up from below the fold, tilting in 3D toward the cursor (±4° rotation, 20px translate). Inside: an italic serif "About Us" eyebrow, a 96px serif statement about turning sterile concrete into living green cities (key words italicized), and an infinite logo marquee of client wordmarks along a hairline top border.

## Page layout
One 500vh scroll column, three fixed/absolute layers: video (z-0), falling headline (z-10), rising glass panel (end of scroll). Navigation is a fixed top-center pill bar: a circular black logo button with a four-petal mark that spins 360° on hover, plus pill links (HOME / ABOUT / SERVICES / CONTACT) where hover floods each pill black from the bottom via a GSAP-scaled circle while the label swaps white — a liquid-fill effect. HOME and ABOUT smooth-scroll to the page's two poles over 3s. Mobile collapses to a hamburger popover.

## Typography
- Display: Syne (substitute for the prompt's Dirtyline 36daysoftype) — the giant falling headline, weight-heavy and deliberately odd
- Body: Manrope (Google Fonts, 400–700) — nav pills (600, 14px, uppercase) and UI
- Accent: Instrument Serif italic (Google Fonts) — the About eyebrow and the 96px glass-panel statement

## Color palette
- Background: black `#000000`, text white `#ffffff`
- Glass panel: `rgba(0,0,0,0.16)` with `backdrop-filter: blur(160px)`, border `rgba(255,255,255,0.1)`
- Nav pills: `#f0f0f0` resting, `#000000` flood on hover
- Marquee wordmarks: white at 40% opacity, 100% on hover

## Visual motifs
- **Scroll-scrubbed background film** (the signature) — scroll position drives video playback frame-accurately; the page is a film you scrub
- **Letters that fall away on scroll** — the giant headline disassembles character by character as the visitor advances
- **Rising frosted-glass panel** — a near-black 160px-blur sheet slides up over the film for the About statement
- **3D cursor-tilt panel** — the glass sheet rotates up to 4° toward the mouse with preserve-3d depth
- **Liquid-fill pill navigation** — hover floods each nav pill black from below via a scaling circle, label swaps to white
- **Spinning petal logo button** — circular logo mark rotates a full turn on hover
- **Client wordmark marquee** — infinite text marquee at the panel base, 20s loop, opacity lift on hover

## When to use
- Landscape architecture, biophilic design, and green infrastructure firms with one strong film of their work
- Urban design and sustainability consultancies pitching transformation (before → after lives in the scrubbed footage)
- Real estate developers marketing a flagship green project
- Any brand whose single best asset is a cinematic clip worth scrubbing through
- Portfolio-style studios that want one statement page instead of a deep site

## When to NOT use
- Anyone without a purpose-shot, high-bitrate clip — scrubbing exposes compression and dull footage instantly
- Mobile-heavy audiences; scroll-seek on phones is choppy and the 317px type needs width
- Multi-page content sites — this architecture is a single choreographed column
- Quick-quote service businesses (use `trades-phone-first-emergency`); visitors here are browsing, not buying

## Build complexity
HIGH complexity. HLS quality-pinning, seek-throttled scrubbing, character-split scroll animation, and the GSAP liquid-fill nav are each real engineering; together they need a careful build and a strong video pipeline.

## Library cross-references
- Motif: `scroll-scrubbed-video-playhead`
- Motif: `character-disassembly-on-scroll`
- Motif: `rising-glass-about-panel`
- Motif: `cursor-tilt-3d-panel`
- Motif: `liquid-fill-pill-nav`
- Motif: `client-wordmark-marquee`
- Typography: `syne-manrope-instrument-mixed`
- Color palette: `black-white-frosted-glass`
