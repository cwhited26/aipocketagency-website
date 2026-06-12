---
slug: milo-hart-solo-studio-narrow-column
name: Milo Hart — Solo Design Studio / Narrow Column Letter
vibe: white, personal, editorial, understated, priced-up-front
industries: solo design studios, freelance designers, boutique agencies, product design consultancies, brand studios, fractional creative directors, developer-designers, portfolio sites
source: motionsites.ai archive (catalog title uncertain — closest "Creative Studio" / "Creative Agency", premium tier assumed — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
last_used: never
last_client: never
---

## Hero treatment
The hero is a LETTER, not a billboard. On a pure white page, a narrow centered column (max 440px) opens with the studio wordmark "Milo Hart" in a quirky serif, a monospace one-line tagline ("The creative studio of Milo Hart"), then a two-line heading — "Build the next wave, / the bold way." — where the emphasized phrases switch into the serif. Below: three short first-person paragraphs (a credibility line about years shipping products at a major consumer-tech company, a "deliberately small studio" line, and the price stated flat: "Projects start at $5,000 per month"). Two pills close it — a dark "Start a chat" with a layered five-stop shadow stack plus an inset white highlight, and a white "View projects" with a feather-soft shadow. Every block fades up in 0.1s steps.

Right after the letter, a full-width marquee of work: large rounded GIF/video thumbnails of past projects (280px tall mobile, 500px desktop) scrolling endlessly at 30s per loop. The page alternates intimate column and full-width proof the whole way down.

## Page layout
Ten sections: hero letter; work marquee; a pull-quote section (quote icon, a large serif-accented quote, three past-employer wordmarks set as plain text, and a portrait image that parallaxes up to 200px as you scroll); two pricing cards in a right-aligned grid (a dark `#051A24` "Monthly Partnership" card and a white "Custom Project" card, both 40px radius, both showing $5,000); an auto-scrolling testimonial carousel (3s interval, pauses on hover, circular prev/next buttons, five-star "Clutch 5/5" header); a three-project case stack with offset captions; a "Partner with us" white panel where work thumbnails SPAWN AT THE CURSOR with random rotation and fade out over a second as the visitor moves the mouse; a footer; a copyright bar; and a fixed floating bottom pill (serif initial + "Start a chat") that follows the visitor everywhere. All entrances are IntersectionObserver fade-ups.

## Typography
- Display: Hanken Grotesk (substitute for the prompt's PP Neue Montreal) — body, headings, buttons
- Serif accent: IBM Plex Serif (substitute for the prompt's PP Mondwest — the original has a bitmap-serif character no Google face matches) — wordmark, emphasized phrases, the giant "Partner with us" line at up to 80px
- Monospace tagline at text-xs/sm for the one-liner under the logo
- Heading scale: 32px mobile to 44px desktop at line-height 1.1, tracking-tight

## Color palette
- Background: white throughout
- Ink: deep blue-black `#051A24`; headings `#0D212C`; muted `#273C46`
- Dark card text: `#F6FCFF` and `#E0EBF0`
- Shadows do the depth: a five-stop stacked shadow on primary buttons (`0 1px 2px` up to `0 26px 7px` at fading opacities) plus `inset 0 2px 8px rgba(255,255,255,0.5)`

## Visual motifs
- **Narrow-column letter hero** — a 440px centered personal note with the price stated in paragraph three; the anti-billboard
- **Serif switch on emphasis** — key phrases flip from grotesque to a characterful serif inside headings and quotes
- **Work marquee** — full-width strip of large rounded project animations scrolling on a loop between text sections
- **Cursor-spawn thumbnail trail** — moving the mouse across the closing panel spawns rotated work thumbnails at the pointer that fade and shrink away
- **Layered-shadow pill buttons** — primary CTAs carry a five-layer shadow stack with an inset top highlight; depth without borders
- **Dark and light pricing pair** — one `#051A24` card, one white card, 40px radius, same price on both, right-aligned as a pair
- **Parallax portrait** — a single photo in the quote section drifting up to 200px against scroll
- **Floating bottom pill nav** — a fixed white capsule with the serif initial and one CTA, present on every scroll position

## When to use
- Solo designers and small studios selling a monthly partnership
- Anyone willing to put the price on the page — the candor is the positioning
- Studios with strong animated work; the marquee and cursor trail are proof engines
- Personal brands where the founder IS the product
- Productized design services (design-as-subscription)

## When to NOT use
- Teams that want to look big — the first person voice is the whole frame
- Brands without recorded work to feed the marquee and cursor trail
- Price-sensitive or quote-by-scope businesses uncomfortable naming a number
- Industrial, legal, or medical buyers expecting institutional polish (use `cognitra-ai-agency-gray-panel`)

## Build complexity
HIGH complexity. Ten sections, an auto-advancing carousel, parallax, a custom cursor-spawn system with spawn throttling and cleanup, and a layered shadow system worth copying exactly.

## Library cross-references
- Motif: `narrow-column-letter-hero`
- Motif: `serif-switch-emphasis`
- Motif: `work-marquee-strip`
- Motif: `cursor-spawn-thumbnail-trail`
- Motif: `layered-shadow-pill-buttons`
- Motif: `dark-light-pricing-pair`
- Motif: `floating-bottom-pill-nav`
- Typography: `hanken-grotesk-plex-serif-personal`
- Color palette: `white-blue-black-shadow-depth`
