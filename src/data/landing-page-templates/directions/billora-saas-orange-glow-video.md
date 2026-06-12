---
slug: billora-saas-orange-glow-video
name: Billora — Dark SaaS Orange-Glow Video Hero
vibe: dark, energetic, glassy, product-led, conversion-focused
industries: billing software, e-commerce tools, finance SaaS, store management platforms, accounting tools, subscription businesses, B2B SaaS, payments products
source: motionsites.ai archive (catalog title "ClearInvoice SaaS Hero", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
last_used: never
last_client: never
---

## Hero treatment
Dark-mode SaaS hero over a streamed background video at FULL opacity — no dark overlay, the footage carries the atmosphere. The very top of the page is a 5px gradient strip running pale blue → gold → green (`#ccf` → `#e7d04c` → `#31fb78`), a thin signal of color above an otherwise dark page. Headline at `text-6xl` with tight leading ("Manage your online store while save 3x operating cost" — rewrite the grammar for clients), subhead at white/90, then the signature button pair. Text, buttons, and social proof stagger in with fade-up-and-slide entrances.

The primary button is the centerpiece: an orange gradient fill (`#FF3300` → `#EE7926`), a blurred orange glow div floating behind it at 20% opacity, and a 1.5px white/20 inner stroke overlay for a glassy edge. On hover it scales to 1.05, the glow jumps to 60%, and an arrow icon slides in from the left. The secondary button is white/90 with backdrop blur and a hairline black inner stroke, going solid white on hover.

## Page layout
Single hero viewport. Navbar: logo left, three links centered, sign-in/sign-up pair right, full-width dropdown hamburger on mobile. Below the buttons, a social proof row: three overlapping avatars with borders plus "Trusted by 210k+ stores worldwide". Streamed video handled with a memoized background component that cleans up on unmount.

## Typography
- Display: Inter (substitute for the prompt's Switzer) — medium weight, tight tracking
- Body: Geist (Google Fonts) — clean and legible at small sizes
- Headline at text-6xl tight leading; subhead white/90

## Color palette
- Background: near-black behind full-opacity video
- Headline and primary text: white `#ffffff`, subhead at 90% white
- Primary button gradient: `#FF3300` → `#EE7926` with orange glow halo
- Top signal strip: `#ccccff` → `#e7d04c` → `#31fb78`
- Inner strokes: white/20 on dark, black/5 on light

## Visual motifs
- **Glowing gradient button** (the signature) — orange gradient fill, blurred glow halo behind it that triples in strength on hover, glassy inner stroke, and an arrow that slides in from the left
- **Rainbow hairline top strip** — a 5px three-color gradient bar at the very top edge of the page; the only multi-color element
- **Full-opacity streamed video** — the background video plays undimmed; the dark mood comes from the footage itself
- **Inner-stroke glass edges** — both buttons carry a 1.5px translucent border overlay inside their bounds for a lit-edge look
- **Avatar trust row** — overlapping user avatars plus a store-count claim directly under the CTAs
- **Staggered fade-up entrance** — heading, buttons, and proof row arrive in sequence with rise-and-fade motion

## When to use
- Billing, invoicing, and store management SaaS
- E-commerce tooling where the buyer is a store owner who wants energy and numbers
- Finance products that want dark-mode polish with one hot accent
- Conversion-focused hero pages with a single sign-up action
- Brands with abstract or product-flythrough footage ready to run undimmed

## When to NOT use
- Calm, premium service brands — the glow button reads growth-tool, not boutique
- Brands without dark-toned footage; full-opacity bright video will wash out the white type
- Local services and phone-first businesses (use `trades-phone-first-emergency`)
- Anyone who can't commit to orange as the action color — the glow system depends on it

## Build complexity
LOW complexity. One viewport; the button glow is a positioned blurred div, and the streamed video is one reusable component.

## Library cross-references
- Motif: `glowing-gradient-cta-button`
- Motif: `rainbow-hairline-top-strip`
- Motif: `full-bleed-video-no-overlay`
- Motif: `inner-stroke-glass-edges`
- Motif: `avatar-trust-row`
- Typography: `switzer-substitute-geist-saas`
- Color palette: `dark-orange-glow-accent`
