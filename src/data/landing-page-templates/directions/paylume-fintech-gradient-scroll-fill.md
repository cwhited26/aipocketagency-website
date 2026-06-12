---
slug: paylume-fintech-gradient-scroll-fill
name: Paylume — Fintech App / Brand Gradient + Scroll Text Fill
vibe: light, polished, app-first, gradient-accented, calm
industries: fintech apps, payments, neobanks, personal finance tools, expense management, money transfer services, consumer apps, b2c SaaS
last_used: never
last_client: never
source: motionsites.ai archive (catalog title "Veloce Finance", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
---

## Hero treatment
Light fintech hero built around one branded gradient: copper `#B56939` → plum `#5C3779` → blue `#454BBB`, left to right. The hero is a full-screen flex column over a background video, with the navy headline ("Fast payments, your way at lightspeed.") entering through a heavy blur-in — the whole h1 resolves from blur(20px) and transparent over 1.2 seconds, triggered once in view. The final word "lightspeed." wears the brand gradient as a text clip; everything else is near-black navy `#010828`. At the hero's bottom edge a white gradient fade dissolves the video into the white page below, and the conversion is mobile-first: Google Play and App Store badge buttons rather than a web CTA.

Lower on the page, the second signature: a scroll-driven TEXT FILL paragraph. A statement paragraph renders twice, stacked — light gray base layer below, brand-gradient layer above clipped with `clipPath: inset(0 X% 0 0)`. As the section moves between 80% and 20% of viewport height, the clip recedes and the gradient pours across the text left to right, tied 1:1 to scroll position.

## Page layout
Hero screen (sticky header, centered headline, store badges at the bottom), then a white insights section: a left-aligned heading + short paragraph, followed by a 3-up row of rounded-[40px] stat cards — each card is a looping video with a soft translucent color wash and a large stat ("1.6M", "850K", "120+") with a one-line description, bottom-aligned. Cards rise in on a 0.2s stagger. The text-fill section closes. Mobile collapses cards to a column and the nav to an animated hamburger dropdown with staggered link entrances.

## Typography
- Display: Inter (substitute for the prompt's Helvetica Neue) — font-medium, tracking -0.03em, text-4xl up to text-7xl, navy
- Body: Inter / Manrope (Google Fonts) — Manrope semibold for the wordmark, regular weights for UI text
- Stat numbers: 60px medium with tight 60px leading inside the cards

## Color palette
- Ink: deep navy `#00041F` (wordmark, buttons) and `#010828` (headline)
- Brand gradient: `#B56939` → `#5C3779` → `#454BBB` (headline accent word + text fill)
- Muted body: gray `#49484F`
- Light surface: `#EFF4FF` (button text on navy)
- Text-fill base layer: light gray `#B8B7BA`
- Card overlays: translucent washes — `rgba(206,223,235,0.25)`, `rgba(247,236,233,0.6)`, `rgba(218,218,218,0.2)`

## Visual motifs
- **Scroll-driven gradient text fill** — a duplicated paragraph where a gradient top layer is revealed left-to-right via an inset clip-path mapped to scroll progress between 80% and 20% of viewport height
- **One-word gradient headline accent** — the closing word carries the full brand gradient as a text clip while the rest stays navy
- **Heavy blur-in entrance** — headings resolve from blur(20px)/opacity 0 over 1.2s, once, on viewport entry
- **Video stat cards with color washes** — rounded-[40px] cards, looping video behind a translucent tint, big stat + sentence bottom-aligned, staggered rise-in
- **Hero-to-page white fade** — a bottom gradient overlay melts the hero video into the white content below
- **App store badge conversion** — bordered Google Play and App Store buttons replace the usual CTA pair
- **Animated hamburger dropdown** — rotating icon swap and staggered slide-in links on mobile

## When to use
- Consumer fintech, payment, and money-transfer apps whose conversion is an app download
- Neobanks and personal finance tools that want a light, trustworthy look with one memorable accent
- Any app-first brand with a strong product or lifestyle video
- Brands with a multi-color gradient identity that needs a disciplined home
- Pages where one scroll moment (the text fill) should carry the delight

## When to NOT use
- Web-first SaaS where a signup form converts better than store badges
- Dark or cinematic brands — this direction is resolutely light (use `spd-luxury-automation-cinematic`)
- Anyone without lifestyle/product video for the hero and the three stat cards
- Heavy-content marketing sites; this is a short three-section page

## Build complexity
MEDIUM. The scroll text fill and blur-in wrapper are small components, but three card videos plus a hero video need performance care, and the clip-path scroll math must be tuned to feel smooth.

## Library cross-references
- Motif: `scroll-driven-gradient-text-fill`
- Motif: `gradient-accent-headline-word`
- Motif: `blur-in-section-entrance`
- Motif: `video-stat-cards-color-wash`
- Motif: `hero-bottom-white-fade`
- Motif: `app-store-badge-cta`
- Typography: `inter-medium-tight-navy`
- Color palette: `navy-copper-plum-blue-gradient`
