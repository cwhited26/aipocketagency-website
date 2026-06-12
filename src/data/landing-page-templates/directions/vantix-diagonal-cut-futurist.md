---
slug: vantix-diagonal-cut-futurist
name: Vantix — Immersive Tech / Diagonal-Cut Light-to-Dark
vibe: futuristic, light-then-dark, thin-type, architectural, editorial
industries: vr and ar studios, immersive tech, metaverse platforms, 3d visualization, game studios, innovation labs, tech consultancies, digital experience agencies
source: motionsites.ai archive (catalog title "NeoVision", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
last_used: never
last_client: never
---

## Hero treatment
A full-viewport LIGHT hero (`#FBFDFD`) where a background video occupies only the RIGHT 55% of the frame (absolute right, object-cover object-top; on mobile it goes full-width at 30% opacity behind everything). The type system is thin and architectural: a tiny uppercase kicker with 0.3em tracking ("FUTURISTIC"), then the headline — "NEW DIGITAL / UNIVERSE" at 5.5rem desktop, font-light, leading 0.95 — prefixed by a small index number ("05") floating at its left like a magazine folio. Below: a near-black "Get Started" button and a plain "Contact Us" text link. The lower half scatters editorial fragments across the grid: a lone stat ("47.2%" over a "Reality" label) pushed toward center, and a bottom bar pairing "Trusted by Clients" with four overlapping avatars and a "20+" count on the left, a circled link icon plus a short description paragraph on the right — each fragment offset with custom margins (20% and 50% right) so nothing aligns to one axis.

The signature move is the exit: a DIAGONAL SVG DIVIDER pinned to the hero's bottom edge — a single polygon (`0,0 0,120 1440,120 1440,80 920,80 680,0`) filled `#0F0F0F` — that slices the light hero with an angled black wedge and pours the page into the dark sections below. The light-to-dark handoff happens mid-viewport on a hard diagonal, not at a straight section edge.

## Page layout
Three sections. After the hero: an ABOUT band on `#0F0F0F` split two ways — left half a full-bleed video at `mix-blend-lighten` (so black footage melts into the background), right half label / "THE DIGITAL FRONTIER" headline up to text-7xl font-light / three rounded-pill tags ("Digital", "Reality", "Next") / paragraph / "Learn More" button beside a circled Play link. Then an INSIGHTS section on the same black: a giant ITALIC light headline ("LIMITLESS POSSIBILITIES WITH VANTIX" at up to 5rem), and below it a vertical TAB LIST on the left (Innovation / Technology / Experience — active white, inactive gray) driving a content pane of rounded image + article teaser with date and author on a hairline-topped footer row. Everything stacks cleanly on mobile; the navbar (logo, four quiet links, a rounded-full "I am looking for..." search input) collapses to a circled hamburger.

## Typography
- Display + body: system sans (Tailwind default stack) — no custom fonts; the design's character comes from weight and tracking, not the face
- Headlines font-light (300) at 2.75-5.5rem, leading 0.95-1.05, tracking tight; the Insights headline adds italic
- Kickers: text-xs, uppercase, 0.3em letterspacing; nav and body in neutral grays

## Color palette
- Hero: ice white `#FBFDFD`, near-black ink `#0F0F0F` accents
- Dark sections: `#0F0F0F` with white display type
- Text grays: Tailwind neutral-400/500 for body and labels
- Pills and circles: neutral-700 borders on dark, neutral-300 on light
- No accent hue at all — the two videos supply every drop of color

## Visual motifs
- **Diagonal section divider** — an angled black SVG polygon pinned to the hero's bottom edge, cutting the light hero into the dark page on a hard diagonal
- **Half-frame hero video** — footage confined to the right 55% of the viewport on desktop, dropping to a faint full-bleed wash on mobile
- **Indexed headline** — a small "05" folio number floating beside the display type, magazine-style
- **Scattered editorial fragments** — stat, avatars, and description each offset with their own custom margin so the lower hero reads as a composed spread, not rows
- **Blend-mode video panel** — the about video at `mix-blend-lighten` so its blacks dissolve into the section background, no mask needed
- **Vertical tab list** — three stacked text tabs on the left switching an image-plus-article pane, with date and author on a hairline footer
- **Giant italic statement headline** — one full-width font-light italic line introducing the insights section
- **Rounded-full search in the nav** — a pill search input with placeholder copy in place of a CTA button

## When to use
- VR/AR, immersive tech, and 3D studios that want futurist without neon
- Innovation labs and experience agencies pitching enterprise clients
- Brands with two strong abstract or atmospheric videos to anchor light and dark halves
- Companies that want a thin, architectural type voice with zero brand color
- Sites that need an insights/articles block built into the main page

## When to NOT use
- Anyone wanting warmth — the palette is ice and carbon, deliberately cool
- Brands that need a strong color identity; there is no accent hue to carry one
- Conversion-first pages — CTAs here are quiet by design
- Neon-cyberpunk briefs — use `cyberpunk-red-augmented-self`; this is the restrained cousin
- Single-section landing pages; the diagonal cut needs the dark half to land

## Build complexity
MEDIUM complexity. The diagonal SVG divider, blend-mode video, and offset-margin fragments are each simple, but the hero's z-index stack (fill, video, content, divider) and per-breakpoint margin choreography need care. Tabs are basic state.

## Library cross-references
- Motif: `diagonal-svg-section-divider`
- Motif: `half-frame-hero-video`
- Motif: `indexed-headline-folio`
- Motif: `blend-mode-video-panel`
- Motif: `vertical-tab-article-pane`
- Motif: `scattered-editorial-fragments`
- Typography: `system-sans-font-light-architectural`
- Color palette: `ice-white-carbon-black-no-accent`
