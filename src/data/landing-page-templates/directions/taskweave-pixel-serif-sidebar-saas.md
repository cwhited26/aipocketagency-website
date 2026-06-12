---
slug: taskweave-pixel-serif-sidebar-saas
name: TaskWeave — Pixel-Serif Sidebar SaaS
vibe: soft, app-like, off-white, quirky-serif, calm
industries: workflow automation, ai assistants, productivity saas, developer tools, integrations platforms, internal tools, b2b software, agency ops tools
source: motionsites.ai archive (catalog title "FlowMate", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
last_used: never
last_client: never
---

## Hero treatment
A docs-style landing page that borrows the layout of the product itself: on desktop a fixed 240px sidebar runs the left edge (2px border `#dde3dd`, logo on top, nav items Home / Video / Features / Cards with an IntersectionObserver tracking which section is in view and highlighting it `#eef1ed`), and the content area carries a fixed semi-transparent navbar (`bg-[#fefffc]/90`, backdrop-blur) with the wordmark left and Pricing / Community links plus pill Log in / Sign up buttons right. The hero itself is plain and confident: a headline ("Transform your workflow using plain English") in the quirky display serif at 32px mobile up to 70px desktop, line-height 0.95, a 620px-max subheading in `#444141`, and a single "View our intro video" text CTA. Entrances are TextFade spring animations, staggered 0.15s, rising 18px.

The standout moment is the video section: a full-width product video with a liquid-glass prompt card centered over it — `backdrop-filter: blur(16px)`, a white oklab gradient fill, a thick 6px `rgba(255,255,255,0.2)` border, and a typewriter effect typing an example command ("Daily check rival companies and ping me on messenger") at 50ms per character, with a paperclip icon and a circular send button. The card sells the product in one image: type a sentence, the software does the work.

## Page layout
Four anchored sections (hero, video, features, cards), each separated by a hairline `border-t #e8e8e8`, smooth-scrolled from the sidebar. Features is a 6-card grid (3 columns desktop, 2 tablet, 1 mobile) of example commands phrased as user requests, each card 2px-bordered `#dee2de`, rounded-2xl, border darkening on hover, with small circular icon chips at the bottom. The final section is an auto-rotating carousel (4s interval, 3 cards visible desktop, 1 mobile) of 500px-tall audience cards — For Everyone / For Teams / For Enterprises / Platform / Security — with gradient overlays, manual chevron navigation, and slide transitions on a `[0.32, 0.72, 0, 1]` ease.

## Typography
- Display: Pixelify Sans (substitute for the prompt's PPMondwest pixel-serif; use Lora if a clean serif read matters more than the bitmap texture) — wordmark and all headings, `letter-spacing: -0.04em`, `font-kerning: none`
- Body: system sans stack — UI labels, descriptions, feature card copy

## Color palette
- Background: `#fefffc` (off-white with a green cast)
- Text: `#2c2c2c` primary, `#444141` secondary, `#646464` tertiary, `#b4b8b4` muted
- Borders: `#dde3dd` / `#dee2de` / `#e8e8e8`; hover fill `#eef1ed`
- Buttons: black fill with `#2c2c2c` hover; white pill with 2px border for secondary

## Visual motifs
- **App-style fixed sidebar** — 240px left rail with scroll-tracked active states; the marketing page feels like the product UI
- **Pixel-serif wordmark and headlines** — one quirky display face carries the whole brand personality against an otherwise neutral system-font page
- **Glass prompt card over video** — blurred white glass card with a typewriter typing an example command, paperclip and send icons; the product demo as a single still
- **Command-phrased feature cards** — six bordered cards titled as things you'd actually type ("Morning schedule digest"), with tool logos in circular chips
- **Auto-rotating audience carousel** — 4-second rotation through five 500px image cards with gradient overlays and chevron controls
- **Hairline section borders** — 1px `#e8e8e8` rules between sections instead of background color changes
- **Pill buttons throughout** — rounded-full Log in / Sign up pair, white-bordered vs black-filled

## When to use
- Workflow automation and AI assistant products where "type a sentence, it does the task" is the pitch
- Productivity and integrations SaaS that connects to tools people already use
- Developer tools and internal-tools platforms that want a calm, documentation-adjacent feel
- B2B software where trust and clarity beat spectacle
- Brands that want personality from one typeface rather than from color or motion

## When to NOT use
- Local services and trades — app-shell layout means nothing to that buyer (use `contractor-photo-first-trust`)
- Brands chasing a dark, dramatic first impression — this page is deliberately soft and light; `bookedup-deep-shadow-saas` covers dark SaaS
- Mobile-first audiences — the sidebar disappears below 1024px and the page loses its signature
- Single-feature landing pages — the sidebar implies a multi-section story; with two sections it looks empty

## Build complexity
MEDIUM. Layout is conventional, but the scroll-tracked sidebar, typewriter glass card, and AnimatePresence carousel each carry real JavaScript; the custom font needs a self-hosted or substituted file.

## Library cross-references
- Motif: `fixed-sidebar-scroll-tracked-nav`
- Motif: `glass-prompt-card-typewriter`
- Motif: `command-phrased-feature-cards`
- Motif: `auto-rotating-audience-carousel`
- Motif: `hairline-section-borders`
- Typography: `pixel-serif-display-system-body`
- Color palette: `off-white-sage-borders-black-cta`
