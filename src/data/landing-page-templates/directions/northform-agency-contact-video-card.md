---
slug: northform-agency-contact-video-card
name: Northform — Agency Contact / Video Card + Form
vibe: clean, modern, conversion-focused, friendly, editorial-accent
industries: design agencies, dev studios, branding agencies, freelancers, product studios, marketing agencies, consultancies, creative services
source: motionsites.ai archive (catalog title "Build With Us — Contact us", free tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: starter
last_used: never
last_client: never
---

## Hero treatment
A contact page that IS the site. The whole viewport is one large rounded card (`rounded-3xl`, overflow hidden) floating on a white page with a thin padding frame — inside the card, a full-screen background video runs edge to edge (`/placeholder-hero.mp4`; abstract studio or motion-design footage works best). On desktop the card locks to viewport height; on mobile it grows with content.

Two anchors carry the page. Bottom-left: a white headline at 30-48px, "We craft bold ideas / and ship them as products" — with the single word "products" set in Instrument Serif italic, the one editorial flourish on an otherwise sans page. Bottom-right: a solid white contact card (`rounded-3xl`, heavy shadow) holding the entire conversion path — a "Say hello!" heading, an email-plus-socials row on a gray pill (mailto link in blue, four small tinted social buttons), an OR divider, then the form: name/email side by side, a vision textarea, a multi-select row of service chips (Website, Mobile App, Web App, E-Commerce, Visual Identity, 3D & Motion, Digital Marketing, Growth & Consulting, Other), and a full-width black submit button. On submit the form swaps to a success state — green check pill, "You're all set!", "Expect a reply within 24 hours."

## Page layout
Single screen, no scroll on desktop. The nav is a frosted white pill (`bg-white/60`, backdrop blur) top-left with a geometric two-path SVG logo mark, four links (Our story, Expertise, Our work, Journal) and a black "Start a project" pill on the right. A flex spacer pushes headline and form to the card's bottom edge. The form card takes `min(480px, 45%)` on desktop and full width stacked below the headline on mobile. No animation library — hover/focus transitions only.

## Typography
- Display + body: Inter (Google Fonts, weights 300-700) — set globally on everything
- Accent: Instrument Serif (Google Fonts, italic) — used for exactly one word inside the headline
- Form labels and inputs at 14px; chips at 12px

## Color palette
- Page frame and form card: white `#ffffff`
- All buttons and active chip borders: black `#000000`, hover `#1f2937`
- Mailto link: blue `#2563eb`
- Soft surfaces: gray-50 `#f9fafb` email row, gray-200 borders
- Social button tints: pink, orange, and blue at 100-level pastels
- Success check pill: green-50 background

## Visual motifs
- **Rounded video card** (the signature) — the entire site lives inside one big rounded-corner card with a video filling it, framed by a thin white margin
- **One italic word** — a single Instrument Serif italic word inside an otherwise plain sans headline
- **Service chip multi-select** — wrapping tag buttons that toggle on tap; selected state flips to gray fill with black border
- **Frosted pill navigation** — `bg-white/60` with backdrop blur, logo + links + black CTA in one floating bar
- **Email-or-form split** — a mailto-plus-socials row, an OR divider, then the full form; two paths to contact in one card
- **Inline success swap** — the form replaces itself with a check pill and confirmation copy after submit, no redirect

## When to use
- Agencies and studios that want a dedicated "start a project" page that converts
- Freelancers and small shops where contact IS the homepage
- Service businesses with a defined menu of offerings (the chips pre-qualify the lead)
- Paired with any other direction in the library as the contact page of a multi-page build
- Brands with strong motion or showreel footage to put behind the card

## When to NOT use
- As a full marketing homepage — there is no story, proof, or portfolio section; it is a conversion surface
- Brands without usable background footage; a static color behind the card loses the premium feel
- Long, complex intake flows (multi-step qualification) — this card fits one screen of fields
- Dark-brand identities; the white-card-on-white-frame scheme is light by construction (use `cognitra-ai-agency-gray-panel` for a darker agency read)

## Build complexity
LOW. One screen, no animation library, standard form state with a fake-submit success swap. A focused half-day build.

## Library cross-references
- Motif: `rounded-video-card-frame`
- Motif: `one-italic-accent-word`
- Motif: `service-chip-multiselect`
- Motif: `frosted-pill-navigation`
- Motif: `inline-form-success-swap`
- Typography: `inter-instrument-serif-accent`
- Color palette: `white-black-blue-pastel-tints`
