---
slug: nara-stablecoin-light-fintech
name: Nara — Stablecoin Fintech / Light Inset-Card System
vibe: light, premium, fintech, tight-tracked, composed
industries: fintech, crypto and digital assets, payments, wealth management, banking products, savings apps, b2b financial infrastructure, investment platforms
source: motionsites.ai archive (catalog title "USD Halo — Landing Page", free tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: starter
last_used: never
last_client: never
---

## Hero treatment
A light fintech page built on inset media cards: instead of full-bleed video, the hero video lives inside a rounded-2xl card floated within the viewport (height `calc(100vh - 96px)`), leaving a visible `#F5F5F5` frame around it. The navbar floats transparent above — logo mark plus wordmark left, five gray links center, a black pill "Open Wallet" right. Hero copy sits top-left INSIDE the video card in pure black (the footage is light enough to carry dark type): a two-line H1 at 48-60px with -0.04em tracking, a 70%-black paragraph, and the signature button — a black pill with the label left and a white circle holding a black arrow at the right edge.

Below the button, still inside the hero card, runs a partner marquee with a clever cheat: each partner name is plain text styled in a different system font (a 700-weight Georgia serif, a 900-weight uppercase Arial, an italic Trebuchet, a letterspaced Courier...) so the row reads as a real logo wall with zero image assets, scrolling on a duplicated track at 22s per loop.

## Page layout
Four sections, all on `#F5F5F5`, max-width 88rem. (1) Hero card. (2) "Meet the product" intro: a two-column row pairing a 40-48px heading + pill button against an oversized 24-30px explainer paragraph, then a 4-column card grid — one image-backed card spanning two columns plus two solid deep-indigo `#2B2644` cards with white headings and 60%-white body. (3) A backers strip: quarter-width caption next to a three-quarter-width marquee of investor names (same fake-logo font trick, 30s loop). (4) A use-cases split: eyebrow + 56-60px heading + paragraph on the left, and on the right a tall (720px) rounded-3xl video card with its own overlay copy and a "Know more" link led by a frosted white arrow circle. Every section repeats the same grammar: light canvas, rounded media card, black pill, arrow circle.

## Typography
- Display + body: Inter (substitute for the prompt's TT Norms Pro) — weight 600 is the heaviest on the page; every heading carries negative tracking (-0.03em to -0.04em)
- Type scale is the luxury cue: 24-30px paragraphs in the intro section read as editorial confidence

## Color palette
- Canvas: `#F5F5F5` (every section)
- Ink: `#000000`, with 70%/60%/50% black for descending text roles
- Deep indigo feature cards: `#2B2644` with white and 60%-white text
- Buttons: solid black pills; arrow circles in white
- No accent color anywhere — the restraint is the brand

## Visual motifs
- **Inset video cards** — hero and feature videos live inside rounded cards with the light canvas visible around them, never full-bleed; the page feels framed, like product packaging
- **Pill button with arrow circle** — black rounded-full button with a white circle at its right end holding a black arrow; repeated identically across every section
- **Fake-logo text marquee** — partner and backer names rendered as styled text in mismatched system fonts (serif, black-weight sans, mono, italic) on an infinite duplicated track; reads as a logo wall with no assets
- **Deep-indigo feature cards** — solid `#2B2644` rounded-2xl cards with line-broken white headings, mixed into the grid with one image-backed card
- **Oversized explainer paragraph** — the product one-liner set at 24-30px opposite the section heading, treated as display type
- **Black-on-video hero copy** — dark headline directly on light footage inside the card, no scrim

## When to use
- Fintech, payments, and digital-asset products that need to look institutional, not degen
- Savings, yield, and wealth products selling calm and safety
- B2B financial infrastructure with partner logos to flaunt (the marquee handles it without asset wrangling)
- Brands wanting an Apple-adjacent light premium feel on a Tier 1/2 budget
- Products whose explainer fits in one big confident sentence

## When to NOT use
- Brands that need bright accent colors or playfulness — this palette is black, gray, and one indigo
- Dark-mode crypto audiences expecting neon (use `cyberpunk-red-augmented-self` energy instead)
- Hero footage that is dark or busy — the black-on-video copy requires light, calm footage
- Content-heavy sites; the oversized type budgets very few words per section

## Build complexity
MEDIUM complexity. No custom JS beyond two CSS marquees, but four sections of careful grid work, video cards, and type discipline take a full styling pass.

## Library cross-references
- Motif: `inset-rounded-video-card`
- Motif: `pill-button-arrow-circle`
- Motif: `fake-logo-text-marquee`
- Motif: `deep-indigo-feature-cards`
- Motif: `oversized-explainer-paragraph`
- Typography: `inter-tight-tracked-fintech`
- Color palette: `light-gray-black-indigo-restrained`
