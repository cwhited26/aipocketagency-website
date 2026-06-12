---
slug: emberdesk-video-signup-split-card
name: EmberDesk — Sign-Up Page / Dark Split Card on Video
vibe: dark, focused, app-like, glassy, single-purpose
industries: saas onboarding, productivity software, developer tools, ai tools, fintech apps, membership platforms, communities, internal tools
source: motionsites.ai archive (catalog title "NovaDesk Signup", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
last_used: never
last_client: never
---

## Hero treatment
This is a full-screen sign-up page, not a marketing hero. A background video fills the viewport on black; floating dead-center is a two-column card (max 896px wide, fixed 660px tall on desktop, rounded-2xl, heavy shadow). The left half is a near-opaque dark form panel (`rgba(10,10,10,0.92)`); the right half is a glass pane — `rgba(255,255,255,0.05)` with a 1px 8%-white border — that lets the video glow through, holding nothing but the brand mark floated slightly above center.

The form is the entire page's content: brand lockup top (an angular geometric SVG mark plus wordmark in the brand's ember red `#DA3F23`), then a form group pushed to the bottom of the column on desktop. "Sign up" heading at 24px semibold, one line of zinc-400 subtext, email and password inputs in translucent zinc-800 with an eye/eye-off visibility toggle, a custom-built checkbox (16px square, fills white with a black check when ticked) for terms agreement, a full-width white submit button labeled with personality ("Launch Account"), an "or join us via" divider, three equal-width social sign-in buttons, and a final "already have an account" line. Every interactive element transitions colors on hover; there are no keyframe animations anywhere — the motion all comes from the video.

## Page layout
One viewport, one card. Mobile stacks the card to a single column (the glass pane is hidden below the `sm` breakpoint) and lets the page scroll naturally with vertical padding. Desktop locks to exactly 100vh with overflow hidden. There are no other sections — this design is the gate, not the pitch.

## Typography
- Display + body: system sans-serif stack (no custom fonts) — semibold for headings and brand, medium for buttons, tight tracking on the lockup
- All form text runs small: 14px inputs, 12px legal text, 24px heading — app density, not marketing scale

## Color palette
- Brand accent: ember red `#DA3F23` (logo mark and wordmark only — never on buttons)
- Form panel: near-black `rgba(10,10,10,0.92)` over `#000000` page base
- Inputs: translucent zinc `rgba(39,39,42,0.7)`
- Primary button: white `#ffffff` with black text
- Text ladder: white headings, zinc-400 subtext, zinc-500 fine print
- Glass pane: 5% white fill, 8% white 1px border

## Visual motifs
- **Split card: opaque form, glass showcase** — left half solid dark form, right half a transparent glass panel where the background video does the selling
- **Brand color used only as identity** — the red lives exclusively in the logo and wordmark; every action element is white/zinc, which makes the mark feel deliberate
- **White primary button on dark** — the submit action is the brightest thing on the page
- **Custom checkbox with white fill** — hidden native input, hand-built 16px square that inverts to white with a black check
- **Password eye toggle** — inline show/hide control inside the input, zinc that brightens on hover
- **Personality microcopy** — "Launch Account", "or join us via", "Already Hold An Account?" — the form speaks in the brand's voice instead of default form language
- **Three-up social sign-in row** — equal-flex Google/Apple/Twitter buttons in translucent zinc

## When to use
- The sign-up or log-in page for any SaaS, app, or membership product
- Waitlist and early-access gates where the brand wants atmosphere, not a bare form
- Communities and paid memberships where joining should feel like an event
- Products that already have a strong looping brand video to put behind the glass
- Paired with any dark marketing direction as the conversion endpoint

## When to NOT use
- As a homepage or marketing page — it has no pitch, no sections, no story
- Brands without a usable background video; the glass half goes dead without it
- Audiences that distrust dark UIs (some local-service and older demographics) — use a light form treatment instead
- Flows that need long forms; this layout holds 2 fields plus a checkbox comfortably, no more

## Build complexity
LOW complexity. One component, no custom fonts, no animation system — the work is form-state wiring (visibility toggle, checkbox, validation) and getting the glass border right.

## Library cross-references
- Motif: `split-card-form-plus-glass-pane`
- Motif: `brand-color-as-identity-only`
- Motif: `white-primary-button-on-dark`
- Motif: `custom-inverted-checkbox`
- Motif: `personality-form-microcopy`
- Typography: `system-sans-app-density`
- Color palette: `near-black-zinc-ember-red`
