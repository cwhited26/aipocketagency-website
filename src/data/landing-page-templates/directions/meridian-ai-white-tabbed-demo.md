---
slug: meridian-ai-white-tabbed-demo
name: Meridian AI — White SaaS Hero / Auto-Cycling Demo Tabs
vibe: clean, minimal, white, product-led, trustworthy
industries: ai saas, workflow automation, productivity tools, dev tools, analytics platforms, b2b software, integrations platforms, no-code tools
source: motionsites.ai archive (catalog title "Stellar AI", free tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: starter
last_used: never
last_client: never
---

## Hero treatment
A centered white SaaS hero where the product demo IS the hero. Top to bottom: a small reviews badge (a bordered square holding a filled star, plus "4.9 rating from 18.3K+ users"), then an 80px two-line headline — first line solid black ("Work Smarter. Move Faster."), second line in gradient text (`bg-gradient-to-r from-black via-gray-500 to-gray-400` clipped to text) — then a one-sentence subhead, a single black rounded-full CTA ("Begin Free Trial"), and the centerpiece: a pill tab bar with four product stages (Analyse / Train / Testing / Deploy, each with a lucide icon) sitting above a rounded-3xl video panel.

The tabs AUTO-CYCLE every 4 seconds via setInterval, and each tab swaps a different floating UI overlay onto the video: a setup wizard with a purple progress bar at 25%, a model-training card with orange progress at 67%, a green test-suite result (127/127 passing), and a deploy checklist with a Deploy Now button. Overlays animate in with a 0.4s fade on the backdrop and a 0.5s fade on the centered card. The whole page loads with staggered fade-in-up — every major section starts at opacity 0 and animates up 30px over 0.6s, with inline animationDelay incrementing 0.1s per section (0.1s through 0.8s).

## Page layout
Single max-w-7xl centered column: nav (star-icon wordmark left, four center links with chevron dropdowns, Login + black pill "Get started free" right), the centered hero stack, the 400-500px tall video panel, then a company logo strip (mixed wordmark styles — caps sans, serif italic, dot-grid marks) at mt-24. Tab bar collapses to a 2x2 grid on mobile; desktop shows the four tabs in a row with thin vertical dividers.

## Typography
- Display + body: Inter (Google Fonts, weights 400-700) — the whole page
- Headline text-6xl up to 80px, font-normal (NOT bold — the scale carries it), leading 1.1, tracking tight
- UI text sits at text-sm; subhead text-lg/xl gray-600

## Color palette
- Background: pure white `#ffffff`
- Text: black, with gray-600 `#4b5563` subheads and gray-700 nav links
- Headline gradient: black through mid-gray to light gray (clipped text)
- CTAs: solid black, white text, rounded-full
- Tab bar: gray-100 `#f3f4f6` container, white active tab with subtle shadow
- Overlay accents: purple progress, orange progress, green success — color appears only inside the product UI cards

## Visual motifs
- **Auto-cycling demo tabs** — four product-stage tabs that advance themselves every 4s, each swapping a different floating UI card over the demo video; visitors see the whole product loop without touching anything
- **Gradient second line** — headline line one in solid black, line two in a black-to-gray gradient clipped to the text
- **Staggered fade-in-up page load** — every section starts invisible and rises 30px, delays stepping 0.1s apart so the page assembles top to bottom
- **Reviews badge above the headline** — a tiny bordered star square plus a rating-and-user-count line as the first thing read
- **Floating product-UI overlay cards** — wizard, training metrics, test results, deploy checklist rendered as clean white cards centered on the video
- **Mixed-style logo strip** — six fictional company marks in deliberately different typographic styles so the strip reads as real customers
- **Monochrome shell, colorful product** — the page itself is black/white/gray; the only color lives inside the product screenshots

## When to use
- AI and workflow SaaS that wants the product to sell itself on screen
- B2B tools with a multi-step story (set up, run, verify, ship) that maps to tabs
- Startups that need a credible, mainstream look investors and buyers recognize
- Products with a good screen-recording or abstract motion loop to put under the overlays
- Free-trial businesses where one black CTA is the whole conversion path

## When to NOT use
- Brands that need personality or warmth — this is deliberately neutral
- Service businesses with nothing to demo (the tab-over-video centerpiece is the point)
- Dark-mode-coded developer brands — use `codenest-coding-education-dev-platform`
- Local services where a phone call converts — use `trades-phone-first-emergency`

## Build complexity
LOW complexity. Standard Tailwind layout, one setInterval for the tab cycle, three CSS keyframes. The four overlay cards are the only real content work.

## Library cross-references
- Motif: `auto-cycling-demo-tabs`
- Motif: `gradient-clipped-headline-line`
- Motif: `staggered-fade-in-up-load`
- Motif: `floating-product-ui-overlays`
- Motif: `rating-badge-above-headline`
- Typography: `inter-light-weight-large-scale`
- Color palette: `white-black-gray-product-color`
