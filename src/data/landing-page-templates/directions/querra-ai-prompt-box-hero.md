---
slug: querra-ai-prompt-box-hero
name: Querra — AI Data Tool / Prompt-Box-as-Hero
vibe: clean, product-led, ai-native, light, demo-forward
industries: ai saas, data analytics, business intelligence, automation tools, productivity software, developer tools, research platforms, document analysis
source: motionsites.ai archive (catalog title "Transform Data — Hero Section", free tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: starter
last_used: never
last_client: never
---

## Hero treatment
Centered light hero over a looping background video, with a working-looking AI prompt box as the conversion element instead of a button. The headline ("Transform Data Quickly") is set in Fustat Bold at 80px with aggressive negative tracking (-4.8px) and zero line-height slack, centered in black over the video. Above it: a two-part badge — a dark `#0e1311` chip with a star icon and "New", joined to a light chip with the announcement text. Below: a 20px medium-weight subtitle in `#505050`.

The signature is the prompt box: a 728px-wide, 200px-tall rounded-18px panel in translucent black (`rgba(0,0,0,0.24)`) with backdrop blur, floating over the video. Top row shows a credits counter ("60/450 credits") with a green Upgrade button and a "Powered by" model label on the right. The middle is a white rounded input with placeholder text and a black circular submit button with an up arrow — the now-universal chat-input pattern. Bottom row: three small gray action chips (Attach, Voice, Prompts, each with an icon) and a character counter. The box makes the product feel live before anyone signs up.

The video itself uses a custom JavaScript fade system rather than CSS transitions: 250ms `requestAnimationFrame` fade-in at load and on each loop start, a 250ms fade-out triggered when 0.55s remain, then reset and replay — so the loop never visibly jumps. The video is scaled to 115% and anchored to the top so the focal point stays put.

## Page layout
Single-viewport hero: top navbar (120px horizontal padding), 60px gap to the badge/headline block, 44px gap down to the prompt box. Navbar has a wordmark left, five text links center (one with a dropdown chevron), and a transparent Sign Up plus a solid black Log In button right. Everything is center-aligned and symmetric; the page reads as one product screenshot.

## Typography
- Display: Fustat (Google Fonts, Bold) — 80px headline, -4.8px tracking, line-height none; also Medium for the 20px subtitle
- Body: Schibsted Grotesk (Google Fonts, Medium/SemiBold) for nav, logo, and prompt-box labels; Inter for the badge text
- The pairing puts a wide warm grotesque (Fustat) against a precise UI sans (Schibsted Grotesk)

## Color palette
- Headline and primary buttons: black `#000000`
- Subtitle: gray `#505050`
- Action chips: light gray `#f8f8f8`
- Upgrade button: bright green `rgba(90,225,76,0.89)`
- Dark badge chip: `#0e1311`
- Prompt-box shell: translucent black `rgba(0,0,0,0.24)` with backdrop blur over the video

## Visual motifs
- **Prompt box as the call to action** — a 728px chat-style input panel (credits row, white input with circular submit arrow, attach/voice/prompt chips, character counter) replaces the standard CTA button; visitors "use" the product from the hero
- **Loop-blind video fades** — `requestAnimationFrame`-driven 250ms fade-out before the video ends and fade-in on restart, with a guard flag so repeated timeupdate events can't double-fire; the loop seam disappears
- **Ultra-tight 80px headline** — Fustat Bold with -4.8px tracking and no line-height padding, centered black on video
- **Two-part announcement badge** — dark icon chip fused to a light text chip, sitting above the headline
- **Credits-and-upgrade strip** — a usage counter with a green Upgrade button inside the prompt box; pricing pressure built into the demo
- **Oversized video with top anchor** — background video at 115% scale, anchored to the top edge so the composition holds while edges bleed off

## When to use
- AI SaaS where typing a question IS the product (analytics, document Q&A, search)
- Data and BI tools that want to demo before the signup wall
- Productivity tools whose pitch is "ask, get an answer"
- Products with usage-based or credit-based pricing — the credits strip pre-sells the model
- Launch pages that need to feel like a working app, not a brochure

## When to NOT use
- Service businesses — a prompt box makes no sense when a human does the work
- Products that can't actually wire the input to anything; a dead demo box erodes trust fast
- Dark-themed brands — this direction depends on the black-on-light contrast (use `cognitra-ai-agency-gray-panel` for a darker AI look)
- Mobile-first audiences with no patience for a 200px-tall input panel on a small screen

## Build complexity
MEDIUM complexity. The layout is simple, but the custom video fade controller and the multi-row prompt box (with icons, counters, and states) take real component work.

## Library cross-references
- Motif: `prompt-box-as-hero-cta`
- Motif: `raf-video-loop-fade`
- Motif: `two-part-announcement-badge`
- Motif: `credits-upgrade-strip`
- Typography: `fustat-schibsted-grotesk-tight`
- Color palette: `black-on-light-green-accent`
